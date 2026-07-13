"""
Pure-logic helpers for AlertRoad's video pipeline: cross-timeline object
tracking (potholes/cracks) and the frame-sampling plan for videos.

Deliberately dependency-free (no cv2, torch, ultralytics, numpy) so this
logic can be unit tested directly — see tests/test_video_analysis.py —
without needing model weights, a GPU, or a real video file.
"""


def box_iou(box_a, box_b):
    """Standard intersection-over-union between two [x1, y1, x2, y2] boxes."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def count_distinct_objects(timeline, bucket_name, iou_threshold=0.3, max_gap_frames=3):
    """
    Approximate count of DISTINCT physical objects of a given damage bucket
    across the whole sampled timeline, instead of one frame's count. Keeps
    a persistent list of "known" objects across ALL frames processed so
    far — not just the immediately previous one — so an object that
    briefly drops out of view for a sample or two (occlusion, a missed
    detection) and then reappears is still recognized as the same object
    instead of being counted again.

    Matching: in each frame, a detection is matched against the best-
    overlapping (highest IOU >= iou_threshold) object that's still
    "active" — last seen within max_gap_frames samples ago — and not
    already claimed by another detection in the same frame. A match
    updates that object's last-seen position/frame; no match starts a new
    object. An object unmatched for MORE than max_gap_frames consecutive
    samples stops being eligible for future matches, so the same physical
    spot detected again much later is (reasonably) treated as new rather
    than assumed to be the same object after a long, unexplained gap.

    LIMITATION — read before trusting this as a ground-truth count:
    sampling is only ~1 frame/sec (VIDEO_SAMPLE_FPS) and the footage is a
    moving camera (dashcam/CCTV), so this only tracks by position overlap,
    not true visual identity. This can both undercount (two different
    objects occupying a similar position get merged) and overcount (one
    object's gap exceeds max_gap_frames and gets treated as new). It's a
    best-effort approximation, not a verified count.
    """
    tracks = []  # each: {"box": last known [x1,y1,x2,y2], "last_seen": frame_idx}
    total_created = 0

    for frame_idx, frame in enumerate(timeline):
        cur_boxes = [
            d["bbox_xyxy"] for d in frame["detections"] if d["bucket"] == bucket_name
        ]
        active_indices = [
            i for i, t in enumerate(tracks)
            if frame_idx - t["last_seen"] <= max_gap_frames
        ]
        claimed = set()
        for box in cur_boxes:
            best_iou, best_i = 0.0, -1
            for i in active_indices:
                if i in claimed:
                    continue
                score = box_iou(box, tracks[i]["box"])
                if score > best_iou:
                    best_iou, best_i = score, i
            if best_iou >= iou_threshold:
                tracks[best_i]["box"] = box
                tracks[best_i]["last_seen"] = frame_idx
                claimed.add(best_i)
            else:
                tracks.append({"box": box, "last_seen": frame_idx})
                total_created += 1

    return total_created


def compute_video_sample_plan(duration_sec, total_frames, sample_fps, max_frames):
    """
    Decide how many frames to sample from a video and at what frame
    interval, so the max_frames cap spreads evenly across the FULL video
    duration once it would otherwise need more than max_frames samples at
    sample_fps — instead of always advancing by a fixed 1/sample_fps-second
    step and stopping early, which only ever covered the first
    ~max_frames-at-sample_fps seconds of any longer video (the bug behind
    the "frozen detection box" report on long videos).

    Returns (num_samples, frame_interval_in_frames).
    """
    approx_samples_at_sample_fps = max(1, int(duration_sec * sample_fps))
    num_samples = min(max_frames, approx_samples_at_sample_fps)
    frame_interval = (
        max(1, total_frames // num_samples) if num_samples > 0 else max(1, total_frames)
    )
    return num_samples, frame_interval
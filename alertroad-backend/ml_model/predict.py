"""
AlertRoad ML inference pipeline.

Wraps the two-YOLO + Random Forest pipeline from the training notebook
(predict_road_risk, Part 8a) into a reusable module the FastAPI backend can
import once and call per upload, instead of re-loading the models on every
request.

Models are loaded ONCE at import time (this module is imported once when
uvicorn starts), not per-request — loading YOLO/RF weights from disk on
every single upload would make each classify request extremely slow.
"""

import os
import cv2
import yaml
import joblib
import numpy as np
import pandas as pd
from ultralytics import YOLO

# --- Paths (relative to this file, so it works no matter where uvicorn is
#     launched from) ---
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
YOLO_WEIGHTS_PATH = os.path.join(MODEL_DIR, "alertroad_yolov8_best.pt")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "alertroad_random_forest.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "alertroad_metadata.yaml")

# --- Load metadata (class names, bucket mapping, feature column order) ---
with open(METADATA_PATH) as f:
    _metadata = yaml.safe_load(f)

CLASS_NAMES = _metadata["CLASS_NAMES"]
CLASS_TO_BUCKET = _metadata["class_to_bucket"]
BUCKET_NAMES = _metadata["BUCKET_NAMES"]
FEATURE_COLUMNS = _metadata["FEATURE_COLUMNS"]
CONF_THRESHOLD = _metadata["CONF_THRESHOLD"]

# --- Vehicle/traffic detection constants (from the notebook, Part 5c) ---
VEHICLE_COCO_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
VEHICLE_CONF_THRESHOLD = 0.3

# Congestion anomaly threshold, confirmed from notebook cell 32 and saved
# to alertroad_metadata.yaml — no longer a placeholder estimate.
CONGESTION_UPPER_BOUND = _metadata["CONGESTION_UPPER_BOUND"]

# Folder where annotated (bounding-box) images get saved. Lives next to the
# raw uploads folder so main.py can serve it the same way via StaticFiles.
ANNOTATED_DIR = os.path.join(os.path.dirname(MODEL_DIR), "uploads", "annotated")
os.makedirs(ANNOTATED_DIR, exist_ok=True)

# --- Load models once, at import time ---
print("Loading AlertRoad ML models...")
_yolo_model = YOLO(YOLO_WEIGHTS_PATH)
_vehicle_model = YOLO("yolov8n.pt")  # auto-downloads on first run
_rf_model = joblib.load(RF_MODEL_PATH)
print("AlertRoad ML models loaded.")


# Video sampling settings — how many frames we pull across the clip to
# build the risk timeline. 1 frame/sec, capped, so a long video doesn't
# take forever to process on a single request.
VIDEO_SAMPLE_FPS = 1.0
VIDEO_MAX_FRAMES = 20

# Risk ordering used to pick the "worst" frame across a video's timeline —
# matches the RF's own label strings once " Risk" is stripped.
_RISK_ORDER = {"Low": 0, "Medium": 1, "High": 2}


def _run_frame_pipeline(image_bgr):
    """
    Run the full detection pipeline (damage YOLO + vehicle YOLO + RF risk
    classification) on a single in-memory BGR frame. Used for both a plain
    image upload and each sampled frame of a video upload, so video frames
    don't need to be written to disk first.

    Returns a dict of everything needed to build either an image result or
    one entry in a video timeline, plus the annotated frame as a raw BGR
    array (not yet saved to disk — the caller decides whether/where to
    save it, since a video only needs to save ONE annotated frame, not all
    of them).
    """
    # ---- Damage detection (fine-tuned model) ----
    result = _yolo_model.predict(image_bgr, conf=CONF_THRESHOLD, verbose=False)[0]
    img_h, img_w = result.orig_shape
    annotated_bgr = result.plot()

    bucket_counts = {b: 0 for b in BUCKET_NAMES}
    confidences, box_areas = [], []
    # TEMP DEBUG: per-detection bbox/confidence/class, kept separate from
    # the aggregated features below. Added to investigate the two-pothole
    # false-positive case (joint lines mis-detected as potholes) — revert
    # once that's resolved, this isn't meant to ship long-term.
    raw_detections = []

    boxes = result.boxes
    if boxes is not None and len(boxes) > 0:
        cls_ids = boxes.cls.cpu().numpy().astype(int)
        confs = boxes.conf.cpu().numpy()
        xyxy = boxes.xyxy.cpu().numpy()

        for cls_id, conf, (x1, y1, x2, y2) in zip(cls_ids, confs, xyxy):
            bucket = CLASS_TO_BUCKET.get(int(cls_id), "other")
            if bucket in bucket_counts:
                bucket_counts[bucket] += 1
            confidences.append(float(conf))
            box_areas.append(float((x2 - x1) * (y2 - y1)))
            raw_detections.append({
                "class_id": int(cls_id),
                "class_name": CLASS_NAMES.get(int(cls_id), "unknown"),
                "bucket": bucket,
                "confidence": round(float(conf), 4),
                "bbox_xyxy": [round(float(x1), 1), round(float(y1), 1), round(float(x2), 1), round(float(y2), 1)],
            })

    # ---- Vehicle detection (plain COCO model, traffic-exposure context) ----
    vresult = _vehicle_model.predict(image_bgr, conf=VEHICLE_CONF_THRESHOLD, verbose=False)[0]
    num_vehicles = 0
    vboxes = vresult.boxes
    if vboxes is not None and len(vboxes) > 0:
        vcls_ids = vboxes.cls.cpu().numpy().astype(int)
        for cid in vcls_ids:
            if int(cid) in VEHICLE_COCO_CLASSES:
                num_vehicles += 1

    is_congestion_anomaly = int(num_vehicles > CONGESTION_UPPER_BOUND)
    total_anomalies = len(confidences)

    feat = {
        "num_potholes": bucket_counts["pothole"],
        "num_longitudinal_cracks": bucket_counts["longitudinal_crack"],
        "num_transverse_cracks": bucket_counts["transverse_crack"],
        "num_alligator_cracks": bucket_counts["alligator_crack"],
        "num_repaired_areas": bucket_counts["repaired_area"],
        "num_road_markings": bucket_counts["road_marking"],
        "total_anomalies": total_anomalies,
        "avg_confidence": float(np.mean(confidences)) if confidences else 0.0,
        "max_confidence": float(np.max(confidences)) if confidences else 0.0,
        "avg_bbox_area": float(np.mean(box_areas)) if box_areas else 0.0,
        "max_bbox_area": float(np.max(box_areas)) if box_areas else 0.0,
        "image_width": int(img_w),
        "image_height": int(img_h),
        "anomaly_density": total_anomalies / (img_w * img_h) * 1e6,
        "is_congestion_anomaly": is_congestion_anomaly,
    }

    feat_df = pd.DataFrame([feat])[FEATURE_COLUMNS]
    predicted_risk_raw = _rf_model.predict(feat_df)[0]
    predicted_proba_raw = dict(
        zip(_rf_model.classes_, _rf_model.predict_proba(feat_df)[0])
    )

    # The RF's own labels are "High Risk" / "Medium Risk" / "Low Risk" —
    # strip " Risk" so this matches the app's existing risk_level values
    # ("High" / "Medium" / "Low") used by the frontend's color logic.
    predicted_risk = predicted_risk_raw.replace(" Risk", "")
    predicted_proba = {
        k.replace(" Risk", ""): float(v) for k, v in predicted_proba_raw.items()
    }

    # ---- Explainability: was this risk score driven by actual road
    # damage, or purely by traffic volume?
    damage_detected = total_anomalies > 0

    if not damage_detected and predicted_risk != "Low":
        risk_reason = (
            f"No road damage detected in this frame — risk was raised by "
            f"traffic volume alone ({num_vehicles} vehicles detected, "
            f"above the {CONGESTION_UPPER_BOUND} congestion threshold)."
        )
    elif not damage_detected:
        risk_reason = (
            "No road damage detected, and traffic volume is within the "
            "normal range."
        )
    else:
        risk_reason = (
            f"Risk based on {total_anomalies} detected damage anomal"
            f"{'y' if total_anomalies == 1 else 'ies'} "
            f"({feat['num_potholes']} pothole(s), "
            f"{feat['num_longitudinal_cracks'] + feat['num_transverse_cracks'] + feat['num_alligator_cracks']} "
            f"crack(s)) and {num_vehicles} vehicles in traffic context."
        )

    return {
        "risk_level": predicted_risk,
        "damage_detected": damage_detected,
        "risk_reason": risk_reason,
        "annotated_bgr": annotated_bgr,
        "potholes": feat["num_potholes"],
        "cracks": (
            feat["num_longitudinal_cracks"]
            + feat["num_transverse_cracks"]
            + feat["num_alligator_cracks"]
        ),
        "confidence": round(feat["avg_confidence"] * 100),
        "traffic": num_vehicles,
        "detection_details": {
            "crack_breakdown": {
                "longitudinal": feat["num_longitudinal_cracks"],
                "transverse": feat["num_transverse_cracks"],
                "alligator": feat["num_alligator_cracks"],
            },
            "repaired_areas": feat["num_repaired_areas"],
            "road_markings": feat["num_road_markings"],
            "total_anomalies": feat["total_anomalies"],
            "avg_confidence": feat["avg_confidence"],
            "max_confidence": feat["max_confidence"],
            "anomaly_density": feat["anomaly_density"],
            "is_congestion_anomaly": bool(is_congestion_anomaly),
            "risk_probabilities": predicted_proba,
            "raw_detections_TEMP_DEBUG": raw_detections,
        },
    }


def _save_annotated(annotated_bgr, file_path, suffix=""):
    """Save an annotated frame under a name derived from the original
    upload so the caller (main.py) can hand the filename straight to the
    frontend. Forward slash in the returned path is on purpose (it becomes
    part of a URL, not a filesystem path — must stay "/" even on Windows)."""
    annotated_filename = os.path.basename(file_path) + suffix + "_annotated.jpg"
    annotated_path = os.path.join(ANNOTATED_DIR, annotated_filename)
    cv2.imwrite(annotated_path, annotated_bgr)
    return f"annotated/{annotated_filename}"


def _predict_image(file_path):
    image_bgr = cv2.imread(file_path)
    if image_bgr is None:
        raise ValueError(f"Could not read image: {file_path}")

    r = _run_frame_pipeline(image_bgr)
    annotated_image_filename = _save_annotated(r["annotated_bgr"], file_path)

    return {
        "risk_level": r["risk_level"],
        "damage_detected": r["damage_detected"],
        "risk_reason": r["risk_reason"],
        "annotated_image_filename": annotated_image_filename,
        "potholes": r["potholes"],
        "cracks": r["cracks"],
        "confidence": r["confidence"],
        "traffic": r["traffic"],
        "detection_details": r["detection_details"],
    }


def _box_iou(a, b):
    """Standard intersection-over-union between two [x1,y1,x2,y2] boxes."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
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


def _count_distinct_objects(timeline, bucket_name, iou_threshold=0.3, max_gap_frames=3):
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
                score = _box_iou(box, tracks[i]["box"])
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


def _predict_video(file_path):
    """
    Samples frames across the whole video (~1/sec, capped at
    VIDEO_MAX_FRAMES) instead of just the middle frame, runs the full
    pipeline on each, and builds a timeline the frontend can use to mark
    exactly when damage was detected. risk_level, risk_reason, and the
    annotated image come from the WORST frame in the timeline, not an
    arbitrary one — so a brief pothole in an otherwise-clean video still
    surfaces as the headline risk. potholes/cracks/confidence/traffic, on
    the other hand, are aggregated across the WHOLE timeline (see below) —
    using worst_result alone for those would report only whatever that one
    frame happened to contain, which is misleading whenever the
    worst-risk moment and the actual damage don't coincide in the same
    sampled frame (e.g. a frame flagged purely by traffic volume, with
    zero damage detections of its own).
    """
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {file_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / video_fps if video_fps > 0 else 0

    # VIDEO_SAMPLE_FPS (~1/sec) and VIDEO_MAX_FRAMES (20) were designed
    # together assuming most uploads are roughly <=20s — sampling every
    # video_fps-th frame for up to 20 samples naturally covers a ~20s clip
    # start to finish. For anything LONGER than that, always advancing by
    # a fixed 1-second step and stopping once 20 samples are taken means
    # only the first ~20 seconds ever get analyzed — everything after that
    # is silently never sampled at all, even though the timeline/overlay
    # still "cover" the full duration visually (the last real sample just
    # gets stretched over the unsampled remainder, which looks like a
    # detection box "stuck" near the end when it's actually stale data
    # from ~20s in). Instead, cap at VIDEO_MAX_FRAMES samples spread EVENLY
    # across the whole video when duration would otherwise need more than
    # that many 1-second samples, so long videos get full-duration coverage
    # (at a coarser interval) rather than dense-but-partial coverage.
    approx_samples_at_1fps = max(1, int(duration_sec * VIDEO_SAMPLE_FPS))
    num_samples = min(VIDEO_MAX_FRAMES, approx_samples_at_1fps)
    frame_interval = max(1, total_frames // num_samples) if num_samples > 0 else max(1, total_frames)

    timeline = []
    frame_pipeline_results = []  # keep full results alongside timeline entries
    frame_idx = 0
    sampled_count = 0

    while sampled_count < num_samples:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        success, frame = cap.read()
        if not success:
            break

        timestamp_sec = round(frame_idx / video_fps, 2) if video_fps > 0 else 0
        r = _run_frame_pipeline(frame)

        timeline.append({
            "timestamp_sec": timestamp_sec,
            "risk_level": r["risk_level"],
            "damage_detected": r["damage_detected"],
            "potholes": r["potholes"],
            "cracks": r["cracks"],
            "confidence": r["confidence"],
            "traffic": r["traffic"],
            "detections": r["detection_details"]["raw_detections_TEMP_DEBUG"],
        })
        frame_pipeline_results.append(r)

        sampled_count += 1
        frame_idx += frame_interval

    cap.release()

    if not timeline:
        raise ValueError(f"No frames could be read from video: {file_path}")

    # Pick the worst-risk frame as the "headline" result. Ties broken by
    # earliest timestamp (stable sort / max() keeps first max encountered).
    worst_idx = max(
        range(len(timeline)),
        key=lambda i: _RISK_ORDER.get(timeline[i]["risk_level"], 0),
    )
    worst_result = frame_pipeline_results[worst_idx]
    worst_timestamp = timeline[worst_idx]["timestamp_sec"]

    annotated_image_filename = _save_annotated(worst_result["annotated_bgr"], file_path)

    # Headline traffic = the busiest single sampled frame across the WHOLE
    # video, not just whichever frame was picked as "worst" for risk. Those
    # are two different questions — e.g. an all-Low-risk video has no
    # standout "worst" frame (worst_idx defaults to frame 0, tie-broken by
    # earliest timestamp), but vehicles can still appear later in the clip.
    # Using worst_result["traffic"] alone previously reported frame 0's
    # vehicle count in that case, even when a busier frame existed elsewhere
    # in the same timeline. NOTE: this is a peak-in-one-frame count, not a
    # deduplicated total — the same physical vehicle visible across several
    # consecutive sampled frames is not tracked/merged, so it isn't a true
    # "vehicles that passed through" count.
    peak_traffic = max((entry["traffic"] for entry in timeline), default=0)

    # potholes/cracks previously came from worst_result alone (whichever
    # single frame had the highest risk_level — that frame is picked for
    # RISK, not for damage count), which meant a video could show
    # "potholes: 0" even when a pothole box was plainly visible in the
    # overlay at another timestamp, just because the worst-risk moment
    # happened to be a traffic-driven frame with no damage of its own.
    # Track boxes across the whole video (with a short-gap memory, see
    # _count_distinct_objects) instead, to get an actual "how many
    # separate potholes were seen in this video" count. Cracks are summed
    # across their three sub-buckets separately, since a longitudinal
    # crack should never be matched against an alligator crack as "the
    # same object."
    total_potholes = _count_distinct_objects(timeline, "pothole")
    total_cracks = sum(
        _count_distinct_objects(timeline, bucket)
        for bucket in ("longitudinal_crack", "transverse_crack", "alligator_crack")
    )

    # Same root cause again: confidence previously came from
    # worst_result["confidence"], the average detection confidence of
    # ONLY the worst-risk frame. If that frame had zero damage detections
    # (e.g. flagged purely by traffic volume), its confidence list was
    # empty and this reported a flat 0% — even though real damage with a
    # real confidence score was detected elsewhere in the same video.
    # Average across every individual damage detection found anywhere in
    # the video instead, so the number reflects the whole clip rather than
    # whichever single frame won "worst."
    all_confidences = [
        d["confidence"] for entry in timeline for d in entry["detections"]
    ]
    overall_confidence = (
        round(sum(all_confidences) / len(all_confidences) * 100)
        if all_confidences else 0
    )

    # Prefix the single-frame risk_reason with when in the video it happened,
    # so the explainability banner still makes sense for a video result.
    risk_reason = (
        f"Worst moment found at {worst_timestamp}s into the video "
        f"(of {round(duration_sec, 1)}s total, {len(timeline)} frames sampled). "
        + worst_result["risk_reason"]
    )

    detection_details = dict(worst_result["detection_details"])
    detection_details["video_timeline"] = timeline
    detection_details["video_duration_sec"] = round(duration_sec, 2)
    detection_details["video_frames_sampled"] = len(timeline)
    detection_details["video_worst_timestamp_sec"] = worst_timestamp

    return {
        "risk_level": worst_result["risk_level"],
        "damage_detected": worst_result["damage_detected"],
        "risk_reason": risk_reason,
        "annotated_image_filename": annotated_image_filename,
        "potholes": total_potholes,
        "cracks": total_cracks,
        "confidence": overall_confidence,
        "traffic": peak_traffic,
        "detection_details": detection_details,
    }


def predict_road_risk(file_path):
    """
    Run the full AlertRoad pipeline on a single uploaded file (image or
    video). Returns a dict with the fields the backend needs to save.
    """
    ext = os.path.splitext(file_path)[1].lower()
    video_exts = {".mp4", ".mov", ".avi", ".mkv"}

    if ext in video_exts:
        return _predict_video(file_path)
    return _predict_image(file_path)
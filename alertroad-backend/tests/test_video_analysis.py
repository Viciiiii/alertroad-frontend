"""
Unit tests for ml_model/video_analysis.py — the persistent IOU tracker
(potholes/cracks counting fix) and the full-duration video sampling plan
(long-video coverage fix). These are pure-logic functions with zero heavy
dependencies, so no models, GPU, or real video/image files are needed to
run this file:

    cd alertroad-backend
    pip install pytest --break-system-packages   # if not already installed
    pytest tests/test_video_analysis.py -v
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_model.video_analysis import (
    box_iou,
    count_distinct_objects,
    compute_video_sample_plan,
)


def make_frame(detections):
    """Build a timeline entry with the shape count_distinct_objects expects."""
    return {"detections": detections}


def det(bucket, bbox):
    return {"bucket": bucket, "bbox_xyxy": bbox}


# ---------------------------------------------------------------- box_iou --

def test_box_iou_identical_boxes_is_1():
    box = [10, 10, 50, 50]
    assert box_iou(box, box) == 1.0


def test_box_iou_no_overlap_is_0():
    assert box_iou([0, 0, 10, 10], [100, 100, 110, 110]) == 0.0


def test_box_iou_partial_overlap_between_0_and_1():
    iou = box_iou([0, 0, 10, 10], [5, 5, 15, 15])
    assert 0.0 < iou < 1.0


def test_box_iou_symmetric():
    a, b = [0, 0, 10, 10], [5, 5, 15, 15]
    assert box_iou(a, b) == box_iou(b, a)


# ------------------------------------------------------ count_distinct_objects --

def test_same_object_across_consecutive_frames_counts_once():
    """A pothole visible in 3 straight sampled frames, roughly same spot."""
    timeline = [
        make_frame([det("pothole", [10, 10, 50, 50])]),
        make_frame([det("pothole", [11, 11, 51, 51])]),
        make_frame([det("pothole", [12, 12, 52, 52])]),
    ]
    assert count_distinct_objects(timeline, "pothole") == 1


def test_object_within_gap_tolerance_still_counts_once():
    """Disappears for 2 samples (<= default max_gap_frames=3), reappears same spot."""
    timeline = [
        make_frame([det("pothole", [10, 10, 50, 50])]),
        make_frame([]),
        make_frame([]),
        make_frame([det("pothole", [11, 11, 51, 51])]),
    ]
    assert count_distinct_objects(timeline, "pothole") == 1


def test_object_beyond_gap_tolerance_counts_as_new():
    """Disappears for 4 samples (> default max_gap_frames=3) -> treated as new."""
    timeline = [
        make_frame([det("pothole", [10, 10, 50, 50])]),
        make_frame([]),
        make_frame([]),
        make_frame([]),
        make_frame([]),
        make_frame([det("pothole", [11, 11, 51, 51])]),
    ]
    assert count_distinct_objects(timeline, "pothole") == 2


def test_two_spatially_distinct_objects_in_one_frame_count_as_two():
    timeline = [
        make_frame([
            det("pothole", [10, 10, 50, 50]),
            det("pothole", [200, 200, 250, 250]),
        ]),
    ]
    assert count_distinct_objects(timeline, "pothole") == 2


def test_buckets_are_tracked_independently():
    """A pothole and a crack occupying the same box shouldn't merge counts."""
    timeline = [
        make_frame([
            det("pothole", [10, 10, 50, 50]),
            det("longitudinal_crack", [10, 10, 50, 50]),
        ]),
    ]
    assert count_distinct_objects(timeline, "pothole") == 1
    assert count_distinct_objects(timeline, "longitudinal_crack") == 1


def test_empty_timeline_counts_zero():
    assert count_distinct_objects([], "pothole") == 0


def test_no_detections_of_requested_bucket_counts_zero():
    timeline = [make_frame([det("crack", [10, 10, 50, 50])])]
    assert count_distinct_objects(timeline, "pothole") == 0


def test_two_objects_in_same_frame_both_new_not_merged_into_each_other():
    """Regression guard: a frame with 2 detections of the same bucket must
    not let the second one match against the first purely because both are
    'new this frame' — each unmatched detection should open its own track."""
    timeline = [
        make_frame([
            det("pothole", [0, 0, 10, 10]),
            det("pothole", [500, 500, 510, 510]),
        ]),
        make_frame([
            det("pothole", [0, 0, 10, 10]),
            det("pothole", [500, 500, 510, 510]),
        ]),
    ]
    assert count_distinct_objects(timeline, "pothole") == 2


# ------------------------------------------------------- compute_video_sample_plan --

def test_long_video_spreads_samples_across_full_duration():
    """The original bug report: a 53.4s/30fps video only ever sampled the
    first ~19s. Verify the fix covers 0.0s -> ~50.67s instead."""
    duration_sec = 53.4
    video_fps = 30.0
    total_frames = int(duration_sec * video_fps)

    num_samples, frame_interval = compute_video_sample_plan(
        duration_sec, total_frames, sample_fps=1.0, max_frames=20
    )

    assert num_samples == 20
    assert frame_interval == 80

    last_sample_timestamp = ((num_samples - 1) * frame_interval) / video_fps
    assert round(last_sample_timestamp, 2) == 50.67


def test_short_video_is_unaffected_still_about_1_sample_per_second():
    duration_sec = 15.0
    video_fps = 30.0
    total_frames = int(duration_sec * video_fps)

    num_samples, frame_interval = compute_video_sample_plan(
        duration_sec, total_frames, sample_fps=1.0, max_frames=20
    )

    assert num_samples == 15
    assert frame_interval == 30  # 30 frames @ 30fps == 1s steps


def test_video_at_exactly_the_cap_boundary():
    duration_sec = 20.0
    video_fps = 30.0
    total_frames = int(duration_sec * video_fps)

    num_samples, frame_interval = compute_video_sample_plan(
        duration_sec, total_frames, sample_fps=1.0, max_frames=20
    )

    assert num_samples == 20
    assert frame_interval == 30


def test_very_short_video_still_gets_at_least_one_sample():
    num_samples, frame_interval = compute_video_sample_plan(
        duration_sec=0.2, total_frames=6, sample_fps=1.0, max_frames=20
    )
    assert num_samples >= 1
    assert frame_interval >= 1


def test_zero_total_frames_does_not_divide_by_zero():
    # Defensive case: a corrupt/empty video reporting 0 frames shouldn't crash.
    num_samples, frame_interval = compute_video_sample_plan(
        duration_sec=0.0, total_frames=0, sample_fps=1.0, max_frames=20
    )
    assert num_samples >= 1
    assert frame_interval >= 1
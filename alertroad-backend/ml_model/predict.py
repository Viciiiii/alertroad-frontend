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


def _predict_video(file_path):
    """
    Samples frames across the whole video (~1/sec, capped at
    VIDEO_MAX_FRAMES) instead of just the middle frame, runs the full
    pipeline on each, and builds a timeline the frontend can use to mark
    exactly when damage was detected. The overall result shown on the
    dashboard (risk_level, annotated image, stats) comes from the WORST
    frame in the timeline, not an arbitrary one — so a brief pothole in an
    otherwise-clean video still surfaces as the headline risk.
    """
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {file_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / video_fps if video_fps > 0 else 0
    frame_interval = max(1, int(round(video_fps / VIDEO_SAMPLE_FPS)))

    timeline = []
    frame_pipeline_results = []  # keep full results alongside timeline entries
    frame_idx = 0
    sampled_count = 0

    while sampled_count < VIDEO_MAX_FRAMES:
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
        "potholes": worst_result["potholes"],
        "cracks": worst_result["cracks"],
        "confidence": worst_result["confidence"],
        "traffic": worst_result["traffic"],
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
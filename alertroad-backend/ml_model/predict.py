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

# TODO: PLACEHOLDER — replace with the real value once your groupmate
# re-runs cell 32 of his notebook and sends you the printed
# "Congestion anomaly threshold" number. This value was computed from his
# training data's vehicle-count distribution and was never saved to
# alertroad_metadata.yaml, so this is currently an estimate, not the exact
# number his Random Forest was actually trained against.
CONGESTION_UPPER_BOUND = 4.5

# --- Load models once, at import time ---
print("Loading AlertRoad ML models...")
_yolo_model = YOLO(YOLO_WEIGHTS_PATH)
_vehicle_model = YOLO("yolov8n.pt")  # auto-downloads on first run
_rf_model = joblib.load(RF_MODEL_PATH)
print("AlertRoad ML models loaded.")


def _get_representative_frame(file_path):
    """
    YOLO/the Random Forest were trained on single still images. For a video
    upload, this grabs one representative frame (the middle frame) and saves
    it as a temporary .jpg to run the same image pipeline on.

    This is a simplification — the original project plan called for
    sampling multiple frames across the video (~1 frame per 1-2 seconds),
    which would need frame-by-frame results to be aggregated somehow. Using
    a single middle frame is a reasonable MVP starting point, not the final
    intended video-handling behavior.
    """
    ext = os.path.splitext(file_path)[1].lower()
    video_exts = {".mp4", ".mov", ".avi", ".mkv"}

    if ext not in video_exts:
        return file_path, False  # already an image, nothing to extract

    cap = cv2.VideoCapture(file_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    middle_frame_index = max(total_frames // 2, 0)
    cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame_index)
    success, frame = cap.read()
    cap.release()

    if not success:
        raise ValueError(f"Could not read a frame from video: {file_path}")

    frame_path = file_path + "_frame.jpg"
    cv2.imwrite(frame_path, frame)
    return frame_path, True  # True = caller should delete this temp file after


def predict_road_risk(file_path):
    """
    Run the full AlertRoad pipeline on a single uploaded file (image or
    video). Returns a dict with the fields the backend needs to save.
    """
    image_path, is_temp_frame = _get_representative_frame(file_path)

    try:
        # ---- Damage detection (fine-tuned model) ----
        result = _yolo_model.predict(
            image_path, conf=CONF_THRESHOLD, verbose=False
        )[0]
        img_h, img_w = result.orig_shape

        bucket_counts = {b: 0 for b in BUCKET_NAMES}
        confidences, box_areas = [], []

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

        # ---- Vehicle detection (plain COCO model, traffic-exposure context) ----
        vresult = _vehicle_model.predict(
            image_path, conf=VEHICLE_CONF_THRESHOLD, verbose=False
        )[0]
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

        return {
            "risk_level": predicted_risk,
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
            },
        }
    finally:
        if is_temp_frame and os.path.exists(image_path):
            os.remove(image_path)
from ultralytics import YOLO

model = YOLO("ml_model/alertroad_yolov8_best.pt")

# Very low threshold on purpose — we want to see EVERYTHING the model
# considered, not just what passed the normal 0.25 cutoff.
result = model.predict("uploads/dee94002-dc39-4183-b02f-1d8993333362.jpg", conf=0.01, verbose=False)[0]

boxes = result.boxes
print(f"Total raw detections (conf >= 0.01): {len(boxes) if boxes is not None else 0}")

if boxes is not None and len(boxes) > 0:
    for cls_id, conf in zip(boxes.cls.cpu().numpy(), boxes.conf.cpu().numpy()):
        class_name = model.names[int(cls_id)]
        print(f"  - {class_name}: confidence {conf:.3f}")
else:
    print("  Model detected literally nothing on this image, even at conf=0.01.")
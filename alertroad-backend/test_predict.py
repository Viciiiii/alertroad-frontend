from ml_model.predict import predict_road_risk
import json

# Point this at any real image already sitting in your uploads/ folder
result = predict_road_risk("uploads/c691c2f1-7538-4d1f-92e8-5a11acc7f2ef.jpg")
print(json.dumps(result, indent=2))
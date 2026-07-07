import random
import uuid
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import Camera, ScanResult, User
from schemas import CameraSchema, CameraCreate, ScanResultSchema, ScanCreate, UserCreate, UserLogin, Token
from auth import hash_password, verify_password, create_access_token
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "AlertRoad API is running"}

@app.post("/api/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(email=user.email, hashed_password=hash_password(user.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.email})
    return {"access_token": token}

@app.post("/api/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": user.email})
    return {"access_token": token}

@app.get("/api/cameras", response_model=List[CameraSchema])
def get_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).all()

@app.post("/api/cameras", response_model=CameraSchema)
def create_camera(camera: CameraCreate, db: Session = Depends(get_db)):
    new_camera = Camera(
        id=str(uuid.uuid4()),
        name=camera.name,
        location=camera.location,
        lat=camera.lat,
        lng=camera.lng,
    )
    db.add(new_camera)
    db.commit()
    db.refresh(new_camera)
    return new_camera

@app.delete("/api/cameras/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    db.delete(camera)
    db.commit()
    return {"message": "Camera deleted"}

@app.get("/api/scans", response_model=List[ScanResultSchema])
def get_scans(db: Session = Depends(get_db)):
    return db.query(ScanResult).order_by(ScanResult.id.desc()).all()

@app.post("/api/scans", response_model=ScanResultSchema)
def create_scan(scan: ScanCreate, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == scan.camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    # PLACEHOLDER: replace this block once the real detection model is ready.
    potholes = random.randint(0, 6)
    cracks = random.randint(0, 6)
    confidence = random.randint(70, 99)
    traffic = random.randint(0, 30)

    total_damage = potholes + cracks
    if total_damage >= 6:
        risk_level = "High"
    elif total_damage >= 3:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    new_scan = ScanResult(
        location=camera.location,
        risk_level=risk_level,
        potholes=potholes,
        cracks=cracks,
        confidence=confidence,
        traffic=traffic,
        camera_name=camera.name,
        lat=camera.lat,
        lng=camera.lng,
    )
    db.add(new_scan)
    db.commit()
    db.refresh(new_scan)
    return new_scan
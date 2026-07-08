import random
import uuid
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import Camera, ScanResult, User
from schemas import (
    CameraSchema, CameraCreate,
    ScanResultSchema, ScanCreate,
    UserCreate, UserLogin, Token, UserSchema, PasswordReset,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_current_admin,
)
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

# --- Auth ---

@app.post("/api/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token({"sub": user.username, "is_admin": user.is_admin})
    return {"access_token": token}

# --- Staff management (admin-only) ---

@app.post("/api/users", response_model=UserSchema)
def create_staff(
    user: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(
        username=user.username,
        hashed_password=hash_password(user.password),
        is_admin=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/api/users", response_model=List[UserSchema])
def list_users(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return db.query(User).all()

@app.delete("/api/users/{user_id}")
def delete_staff(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@app.put("/api/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password reset successfully"}

# --- Cameras ---

@app.get("/api/cameras", response_model=List[CameraSchema])
def get_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).all()

@app.post("/api/cameras", response_model=CameraSchema)
def create_camera(
    camera: CameraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
def delete_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    db.delete(camera)
    db.commit()
    return {"message": "Camera deleted"}

# --- Scans ---

@app.get("/api/scans", response_model=List[ScanResultSchema])
def get_scans(db: Session = Depends(get_db)):
    return db.query(ScanResult).order_by(ScanResult.id.desc()).all()

@app.post("/api/scans", response_model=ScanResultSchema)
def create_scan(
    scan: ScanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

@app.delete("/api/scans/{scan_id}")
def delete_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    scan = db.query(ScanResult).filter(ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    db.delete(scan)
    db.commit()
    return {"message": "Scan deleted"}
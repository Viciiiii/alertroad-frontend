from sqlalchemy import Column, String, Float, Integer, Boolean, JSON, DateTime
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location = Column(String, nullable=False)
    risk_level = Column(String, nullable=False)
    potholes = Column(Integer, default=0)
    cracks = Column(Integer, default=0)
    confidence = Column(Integer, default=0)
    traffic = Column(Integer, default=0)
    camera_name = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    image_filename = Column(String, nullable=True)
    annotated_image_filename = Column(String, nullable=True)
    damage_detected = Column(Boolean, nullable=True)
    risk_reason = Column(String, nullable=True)
    detection_details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
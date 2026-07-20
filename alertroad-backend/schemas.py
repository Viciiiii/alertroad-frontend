from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CameraSchema(BaseModel):
    id: str
    name: str
    location: str
    lat: float
    lng: float

    class Config:
        from_attributes = True


class CameraCreate(BaseModel):
    name: str = Field(min_length=1)
    location: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ScanResultSchema(BaseModel):
    id: int
    location: str
    risk_level: str
    potholes: int
    cracks: int
    confidence: int
    traffic: int
    camera_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    image_filename: Optional[str] = None
    annotated_image_filename: Optional[str] = None
    damage_detected: Optional[bool] = None
    risk_reason: Optional[str] = None
    detection_details: Optional[dict] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserSchema(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool

    class Config:
        from_attributes = True


class PasswordReset(BaseModel):
    new_password: str
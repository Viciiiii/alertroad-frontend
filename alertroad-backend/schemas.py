from pydantic import BaseModel
from typing import Optional

class CameraSchema(BaseModel):
    id: str
    name: str
    location: str
    lat: float
    lng: float

    class Config:
        from_attributes = True


class CameraCreate(BaseModel):
    name: str
    location: str
    lat: float
    lng: float


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

    class Config:
        from_attributes = True


class PasswordReset(BaseModel):
    new_password: str
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

    class Config:
        from_attributes = True


class ScanCreate(BaseModel):
    camera_id: str


class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
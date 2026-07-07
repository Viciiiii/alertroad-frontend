from pydantic import BaseModel

class CameraSchema(BaseModel):
    id: str
    name: str
    location: str
    lat: float
    lng: float

    class Config:
        from_attributes = True


class ScanResultSchema(BaseModel):
    id: int
    location: str
    risk_level: str
    potholes: int
    cracks: int
    confidence: int
    traffic: int

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
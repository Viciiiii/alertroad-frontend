from sqlalchemy import Column, String, Float, Integer
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)


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
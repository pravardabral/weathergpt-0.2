import uuid
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    last_location = Column(String, nullable=True)
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    weather_snapshots = relationship("WeatherSnapshot", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("DisasterWarningRecord", back_populates="user", cascade="all, delete-orphan")

class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("user_profiles.id"), index=True)
    location_name = Column(String)
    temperature = Column(Float)
    feels_like = Column(Float)
    humidity = Column(Integer)
    wind_speed = Column(Float)
    pressure = Column(Integer)
    uv_index = Column(Float)
    aqi = Column(Integer)
    condition = Column(String)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("UserProfile", back_populates="weather_snapshots")

class DisasterWarningRecord(Base):
    __tablename__ = "disaster_warnings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("user_profiles.id"), index=True)
    location_name = Column(String)
    title = Column(String)
    description = Column(Text)
    severity = Column(String)
    source = Column(String)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("UserProfile", back_populates="alerts")
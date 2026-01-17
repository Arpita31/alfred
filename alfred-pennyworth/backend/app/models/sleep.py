"""
Sleep tracking model for rest and recovery monitoring.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Sleep(Base):
    __tablename__ = "sleep"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    sleep_start = Column(DateTime(timezone=True), nullable=False, index=True)
    sleep_end = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer)
    
    quality_score = Column(Float)
    deep_sleep_minutes = Column(Integer)
    light_sleep_minutes = Column(Integer)
    rem_sleep_minutes = Column(Integer)
    awake_minutes = Column(Integer)
    
    time_in_bed_minutes = Column(Integer)
    sleep_efficiency = Column(Float)
    
    wake_count = Column(Integer)
    restlessness_score = Column(Float)
    
    avg_heart_rate = Column(Float)
    min_heart_rate = Column(Float)
    max_heart_rate = Column(Float)
    hrv_score = Column(Float)
    
    avg_respiratory_rate = Column(Float)
    oxygen_saturation = Column(Float)
    
    room_temperature = Column(Float)
    noise_level = Column(String(50))
    
    caffeine_consumed = Column(Boolean, default=False)
    alcohol_consumed = Column(Boolean, default=False)
    exercise_hours_before = Column(Float)
    screen_time_before_bed = Column(Integer)
    
    feeling_on_wake = Column(String(50))
    subjective_quality = Column(Integer)
    
    data_source = Column(String(50))
    external_id = Column(String(100))
    
    calculated_features = Column(JSON, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", backref="sleep_records")
    
    def __repr__(self):
        return f"<Sleep(id={self.id}, date={self.sleep_start.date()}, quality={self.quality_score})>"

################################################################################

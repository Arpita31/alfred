"""
Activity and exercise tracking model.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    activity_type = Column(String(100), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    
    distance_km = Column(Float)
    steps = Column(Integer)
    calories_burned = Column(Float)
    avg_heart_rate = Column(Float)
    max_heart_rate = Column(Float)
    
    intensity_level = Column(String(50))
    exertion_rating = Column(Integer)
    
    specific_metrics = Column(JSON, default={})
    
    location = Column(String(200))
    indoor = Column(Boolean)
    weather = Column(String(100))
    temperature = Column(Float)
    
    planned = Column(Boolean, default=False)
    with_others = Column(Boolean, default=False)
    notes = Column(String(500))
    
    post_activity_hrv = Column(Float)
    recovery_time_hours = Column(Float)
    muscle_soreness = Column(Integer)
    
    data_source = Column(String(50))
    external_id = Column(String(100))
    
    calculated_features = Column(JSON, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", backref="activities")
    
    def __repr__(self):
        return f"<Activity(id={self.id}, type={self.activity_type}, duration={self.duration_minutes}min)>"

################################################################################

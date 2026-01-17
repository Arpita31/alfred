"""
User model for authentication and preferences.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Float
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    timezone = Column(String, default="UTC")
    quiet_hours_start = Column(String, default="22:00")
    quiet_hours_end = Column(String, default="07:00")
    
    telegram_chat_id = Column(String, nullable=True)
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    
    max_interventions_per_day = Column(Integer, default=6)
    intervention_cooldown_hours = Column(Integer, default=2)
    intervention_confidence_threshold = Column(Float, default=0.70)
    
    health_goals = Column(JSON, default={})
    dietary_preferences = Column(JSON, default={})
    fitness_goals = Column(JSON, default={})
    
    google_calendar_enabled = Column(Boolean, default=False)
    apple_health_enabled = Column(Boolean, default=False)
    whoop_enabled = Column(Boolean, default=False)
    oura_enabled = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"

################################################################################

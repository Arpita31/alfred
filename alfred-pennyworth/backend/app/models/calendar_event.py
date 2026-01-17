"""
Calendar events model for schedule tracking.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer)
    all_day = Column(Boolean, default=False)
    
    event_type = Column(String(100))
    event_category = Column(String(100))
    
    attendees = Column(JSON, default=[])
    organizer = Column(String(200))
    
    status = Column(String(50))
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(String(200))
    
    reminders = Column(JSON, default=[])
    
    calendar_name = Column(String(100))
    calendar_id = Column(String(200))
    
    external_id = Column(String(200), index=True)
    external_url = Column(String(500))
    
    ai_classification = Column(JSON, default={})
    predicted_impact = Column(JSON, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_synced = Column(DateTime(timezone=True))
    
    user = relationship("User", backref="calendar_events")
    
    def __repr__(self):
        return f"<CalendarEvent(id={self.id}, title={self.title}, start={self.start_time})>"

################################################################################

"""
Intervention model for storing AI-generated recommendations.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class InterventionType(str, enum.Enum):
    MEAL = "meal"
    HYDRATION = "hydration"
    MOVEMENT = "movement"
    REST = "rest"
    FOCUS = "focus"
    ENERGY = "energy"
    GENERAL = "general"


class InterventionStatus(str, enum.Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"
    EXPIRED = "expired"


class Intervention(Base):
    __tablename__ = "interventions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    type = Column(Enum(InterventionType), nullable=False, index=True)
    status = Column(Enum(InterventionStatus), default=InterventionStatus.PENDING, index=True)
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    reasoning = Column(Text)
    
    confidence_score = Column(Float, nullable=False)
    priority = Column(Integer, default=5)
    
    triggering_signals = Column(JSON, default=[])
    recommendation_data = Column(JSON, default={})
    
    user_response = Column(String(50))
    user_feedback = Column(Text)
    response_time = Column(DateTime(timezone=True))
    
    context_features = Column(JSON, default={})
    
    delivered_at = Column(DateTime(timezone=True))
    delivery_channel = Column(String(50))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True))
    
    user = relationship("User", backref="interventions")
    
    def __repr__(self):
        return f"<Intervention(id={self.id}, type={self.type}, confidence={self.confidence_score:.2f})>"

################################################################################

"""
Meal tracking model for nutrition monitoring.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Meal(Base):
    __tablename__ = "meals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    meal_time = Column(DateTime(timezone=True), nullable=False, index=True)
    meal_type = Column(String(50))
    
    description = Column(Text)
    foods = Column(JSON, default=[])
    
    calories = Column(Float)
    protein_g = Column(Float)
    carbs_g = Column(Float)
    fat_g = Column(Float)
    fiber_g = Column(Float)
    sugar_g = Column(Float)
    
    water_ml = Column(Float)
    servings = Column(Float)
    
    location = Column(String(100))
    social_context = Column(String(100))
    mood_before = Column(String(50))
    mood_after = Column(String(50))
    
    data_source = Column(String(50))
    external_id = Column(String(100))
    
    calculated_features = Column(JSON, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", backref="meals")
    
    def __repr__(self):
        return f"<Meal(id={self.id}, type={self.meal_type}, time={self.meal_time})>"

################################################################################

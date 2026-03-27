"""
Interventions API endpoint - Main Alfred functionality.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.models.intervention import Intervention, InterventionStatus, InterventionType
from app.models.user import User
from app.services.alfred_agent import alfred_agent, Signal, SignalType
from app.services.signal_detector import detect_signals

router = APIRouter()


class InterventionResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    reasoning: str
    confidence_score: float
    status: str
    created_at: datetime
    recommendation_data: Optional[dict] = None
    class Config:
        from_attributes = True


@router.post("/generate", response_model=InterventionResponse)
async def generate_intervention(
    user_id: int = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Generate AI-powered intervention for user"""
    logger.info(f"Generating intervention for user {user_id}")
    
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        from app.models.meal import Meal
        from app.models.sleep import Sleep
        from app.models.activity import Activity
        from app.models.calendar_event import CalendarEvent
        
        # Get current UTC time and ensure timezone consistency
        current_time = datetime.now(timezone.utc)

        window = timedelta(days=settings.PATTERN_DETECTION_WINDOW_DAYS)

        # Get meals within detection window
        recent_meals_result = await db.execute(
            select(Meal).where(
                and_(
                    Meal.user_id == user_id,
                    Meal.meal_time >= current_time - window
                )
            ).order_by(Meal.meal_time.desc())
        )
        recent_meals = [{"meal_time": m.meal_time, "meal_type": m.meal_type,
                        "calories": m.calories, "water_ml": m.water_ml,
                        "description": m.description}
                       for m in recent_meals_result.scalars().all()]

        # Get sleep within detection window
        recent_sleep_result = await db.execute(
            select(Sleep).where(
                and_(
                    Sleep.user_id == user_id,
                    Sleep.sleep_start >= current_time - window
                )
            ).order_by(Sleep.sleep_start.desc())
        )
        recent_sleep = [{"sleep_start": s.sleep_start, "sleep_end": s.sleep_end,
                        "duration_minutes": s.duration_minutes, "quality_score": s.quality_score}
                       for s in recent_sleep_result.scalars().all()]

        # Get activities within detection window
        recent_activities_result = await db.execute(
            select(Activity).where(
                and_(
                    Activity.user_id == user_id,
                    Activity.start_time >= current_time - window
                )
            ).order_by(Activity.start_time.desc())
        )
        recent_activities = [{"start_time": a.start_time, "activity_type": a.activity_type,
                              "duration_minutes": a.duration_minutes, "calories_burned": a.calories_burned,
                              "intensity_level": a.intensity_level}
                             for a in recent_activities_result.scalars().all()]

        # Get upcoming calendar
        upcoming_calendar_result = await db.execute(
            select(CalendarEvent).where(
                and_(
                    CalendarEvent.user_id == user_id,
                    CalendarEvent.start_time >= current_time,
                    CalendarEvent.start_time <= current_time + timedelta(days=1)
                )
            ).order_by(CalendarEvent.start_time)
        )
        upcoming_calendar = [{"title": e.title, "start_time": e.start_time,
                             "end_time": e.end_time, "duration_minutes": e.duration_minutes}
                            for e in upcoming_calendar_result.scalars().all()]

        # ML-based signal detection across all wellness dimensions
        signal = detect_signals(
            meals=recent_meals,
            sleep_records=recent_sleep,
            activities=recent_activities,
            now=current_time,
        )

        if not signal:
            return JSONResponse(status_code=204, content={"detail": "No intervention needed at this time"})
        
        # Get recent interventions
        recent_interventions_result = await db.execute(
            select(Intervention).where(
                and_(
                    Intervention.user_id == user_id,
                    Intervention.created_at >= current_time - timedelta(hours=24)
                )
            ).order_by(Intervention.created_at.desc()).limit(10)
        )
        recent_interventions = [{"type": i.type.value, "title": i.title,
                                "created_at": i.created_at.isoformat(), 
                                "user_response": i.user_response}
                               for i in recent_interventions_result.scalars().all()]
        
        user_data = {
            "timezone": user.timezone,
            "dietary_preferences": user.dietary_preferences,
            "fitness_goals": user.fitness_goals,
            "upcoming_calendar": upcoming_calendar
        }
        
        intervention_data = await alfred_agent.generate_intervention(
            user_data=user_data,
            signal=signal,
            user_patterns={"meals": recent_meals[:7], "sleep": recent_sleep[:7]},
            recent_interventions=recent_interventions
        )
        
        if not intervention_data:
            logger.warning("Intervention generator returned no result, returning no content")
            return JSONResponse(status_code=204, content={"detail": "No intervention needed at this time"})
        
        # Map AI signal type to intervention type enum safely
        signal_to_intervention_type = {
            SignalType.MEAL_GAP: InterventionType.MEAL,
            SignalType.LOW_ENERGY: InterventionType.ENERGY,
            SignalType.POOR_SLEEP: InterventionType.REST,
            SignalType.DEHYDRATION: InterventionType.HYDRATION,
            SignalType.CALENDAR_CONFLICT: InterventionType.FOCUS,
            SignalType.RECOVERY_NEEDED: InterventionType.REST,
            SignalType.STRESS_HIGH: InterventionType.GENERAL,
        }

        intervention_type = signal_to_intervention_type.get(signal.type, InterventionType.GENERAL)

        # Keep generated source in recommendation_data for observability
        rec_data = intervention_data.get("recommendation_data", {})
        if intervention_data.get("generated_by"):
            rec_data = {**rec_data, "generated_by": intervention_data.get("generated_by")}

        intervention = Intervention(
            user_id=user_id,
            type=intervention_type,
            status=InterventionStatus.PENDING,
            title=intervention_data["title"],
            message=intervention_data["message"],
            reasoning=intervention_data["reasoning"],
            confidence_score=intervention_data["confidence"],
            triggering_signals=[signal.to_dict()],
            recommendation_data=rec_data
        )
        
        db.add(intervention)
        await db.commit()
        await db.refresh(intervention)
        
        logger.info(f"Created intervention {intervention.id}")
        return intervention
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[InterventionResponse])
async def list_interventions(
    user_id: int = Query(...),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of interventions"""
    result = await db.execute(
        select(Intervention)
        .where(Intervention.user_id == user_id)
        .order_by(Intervention.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{intervention_id}/feedback")
async def submit_feedback(
    intervention_id: int,
    response: str,
    db: AsyncSession = Depends(get_db)
):
    """Submit user feedback"""
    result = await db.execute(
        select(Intervention).where(Intervention.id == intervention_id)
    )
    intervention = result.scalar_one_or_none()
    if not intervention:
        raise HTTPException(status_code=404, detail="Not found")
    
    intervention.user_response = response
    intervention.response_time = datetime.now(timezone.utc)
    if response == "accepted":
        intervention.status = InterventionStatus.ACCEPTED
    elif response == "rejected":
        intervention.status = InterventionStatus.REJECTED
    await db.commit()
    
    return {"status": "success"}

################################################################################

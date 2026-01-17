"""
Activities API endpoint.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.activity import Activity

router = APIRouter()


class ActivityCreate(BaseModel):
    activity_type: str
    start_time: datetime
    duration_minutes: int
    calories_burned: Optional[float] = None


@router.post("/")
async def create_activity(
    activity: ActivityCreate,
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    end_time = activity.start_time + timedelta(minutes=activity.duration_minutes)
    new_activity = Activity(
        user_id=user_id,
        end_time=end_time,
        **activity.dict()
    )
    db.add(new_activity)
    await db.commit()
    await db.refresh(new_activity)
    return new_activity


@router.get("/")
async def list_activities(
    user_id: int = Query(...),
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Activity)
        .where(Activity.user_id == user_id)
        .order_by(Activity.start_time.desc())
        .limit(limit)
    )
    return result.scalars().all()

################################################################################

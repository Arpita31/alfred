"""
Calendar API endpoint.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.models.calendar_event import CalendarEvent

router = APIRouter()


class CalendarEventCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime


@router.post("/")
async def create_event(
    event: CalendarEventCreate,
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    duration = int((event.end_time - event.start_time).total_seconds() / 60)
    new_event = CalendarEvent(
        user_id=user_id,
        duration_minutes=duration,
        **event.dict()
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    return new_event


@router.get("/upcoming")
async def get_upcoming(
    user_id: int = Query(...),
    hours: int = 24,
    db: AsyncSession = Depends(get_db)
):
    until = datetime.now() + timedelta(hours=hours)
    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.user_id == user_id,
                CalendarEvent.start_time >= datetime.now(),
                CalendarEvent.start_time <= until
            )
        )
    )
    return result.scalars().all()

################################################################################

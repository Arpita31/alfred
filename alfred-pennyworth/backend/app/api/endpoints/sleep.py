"""
Sleep API endpoint.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.sleep import Sleep

router = APIRouter()


class SleepCreate(BaseModel):
    sleep_start: datetime
    sleep_end: datetime
    quality_score: Optional[float] = None


@router.post("/")
async def create_sleep_record(
    sleep: SleepCreate,
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    duration = int((sleep.sleep_end - sleep.sleep_start).total_seconds() / 60)
    new_sleep = Sleep(
        user_id=user_id,
        duration_minutes=duration,
        **sleep.dict()
    )
    db.add(new_sleep)
    await db.commit()
    await db.refresh(new_sleep)
    return new_sleep


@router.get("/")
async def list_sleep(
    user_id: int = Query(...),
    limit: int = 30,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Sleep)
        .where(Sleep.user_id == user_id)
        .order_by(Sleep.sleep_start.desc())
        .limit(limit)
    )
    return result.scalars().all()

################################################################################

"""
Meals API endpoint.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.meal import Meal

router = APIRouter()


class MealCreate(BaseModel):
    meal_time: datetime
    meal_type: str
    description: str
    calories: Optional[float] = None


@router.post("/")
async def create_meal(
    meal: MealCreate,
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    new_meal = Meal(user_id=user_id, **meal.dict())
    db.add(new_meal)
    await db.commit()
    await db.refresh(new_meal)
    return new_meal


@router.get("/")
async def list_meals(
    user_id: int = Query(...),
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Meal)
        .where(Meal.user_id == user_id)
        .order_by(Meal.meal_time.desc())
        .limit(limit)
    )
    return result.scalars().all()

################################################################################

"""
Meals API endpoint.

On POST /meals/ the rule-based nutrition engine automatically fills in
calories and macros from the free-text description when the caller does
not supply them.  A confidence score and parse method are stored in
calculated_features so the frontend can show a disclaimer for estimates.

POST /meals/parse  — analyse description without saving, for live preview.
GET  /meals/suggest — top suggested dishes based on user history.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
from dataclasses import asdict

from app.core.database import get_db
from app.models.meal import Meal
from app.services.nutrition import estimate_nutrition_async, suggest_dishes

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class MealCreate(BaseModel):
    meal_time: datetime
    meal_type: str
    description: str
    servings: Optional[float] = 1.0
    # Caller may supply explicit values; if omitted, engine fills them in
    calories:  Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g:   Optional[float] = None
    fat_g:     Optional[float] = None
    fiber_g:   Optional[float] = None
    water_ml:  Optional[float] = None
    location:  Optional[str]   = None
    mood_before: Optional[str] = None


class ParseRequest(BaseModel):
    description: str
    servings: Optional[float] = 1.0


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _nutrition_response(result) -> dict:
    """Serialise NutritionResult to a JSON-friendly dict."""
    ingredients_out = []
    for ing in result.ingredients:
        ingredients_out.append({
            "name":        ing.name,
            "matched_key": ing.matched_key,
            "amount_g":    ing.amount_g,
            "confidence":  ing.confidence,
        })
    return {
        "calories":     result.calories,
        "protein_g":    result.protein_g,
        "carbs_g":      result.carbs_g,
        "fat_g":        result.fat_g,
        "fiber_g":      result.fiber_g,
        "confidence":   result.confidence,
        "method":       result.method,
        "dish_matched": result.dish_matched,
        "ingredients":  ingredients_out,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/parse")
async def parse_meal(body: ParseRequest):
    """
    Analyse a meal description without saving.
    Returns full nutrition estimate + per-ingredient breakdown.
    Useful for live preview in the frontend before the user confirms logging.
    """
    result = await estimate_nutrition_async(body.description, servings=body.servings or 1.0)
    return _nutrition_response(result)


@router.get("/suggest")
async def suggest(
    user_id: int = Query(...),
    limit: int = 8,
    db: AsyncSession = Depends(get_db),
):
    """Return dish suggestions ranked by user history frequency."""
    rows = await db.execute(
        select(Meal.description)
        .where(Meal.user_id == user_id)
        .order_by(Meal.meal_time.desc())
        .limit(200)
    )
    history = [r[0] for r in rows.all() if r[0]]
    return {"suggestions": suggest_dishes(history, limit=limit)}


@router.post("/")
async def create_meal(
    meal: MealCreate,
    user_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Log a meal.  Nutrition fields are auto-estimated from description when
    not explicitly provided.  Confidence and method are stored in
    calculated_features for transparency.
    """
    servings = meal.servings or 1.0

    # Auto-estimate if any macro field is missing
    needs_estimation = any(
        v is None for v in [meal.calories, meal.protein_g, meal.carbs_g, meal.fat_g]
    )

    nutrition_meta: dict = {}
    calories  = meal.calories
    protein_g = meal.protein_g
    carbs_g   = meal.carbs_g
    fat_g     = meal.fat_g
    fiber_g   = meal.fiber_g

    if needs_estimation and meal.description:
        result = await estimate_nutrition_async(meal.description, servings=servings)
        calories  = calories  if calories  is not None else result.calories
        protein_g = protein_g if protein_g is not None else result.protein_g
        carbs_g   = carbs_g   if carbs_g   is not None else result.carbs_g
        fat_g     = fat_g     if fat_g     is not None else result.fat_g
        fiber_g   = fiber_g   if fiber_g   is not None else result.fiber_g
        nutrition_meta = {
            "nutrition_confidence": result.confidence,
            "nutrition_method":     result.method,
            "dish_matched":         result.dish_matched,
            "estimated":            True,
        }

    new_meal = Meal(
        user_id     = user_id,
        meal_time   = meal.meal_time,
        meal_type   = meal.meal_type,
        description = meal.description,
        servings    = servings,
        calories    = calories,
        protein_g   = protein_g,
        carbs_g     = carbs_g,
        fat_g       = fat_g,
        fiber_g     = fiber_g,
        water_ml    = meal.water_ml,
        location    = meal.location,
        mood_before = meal.mood_before,
        calculated_features = nutrition_meta,
    )
    db.add(new_meal)
    await db.commit()
    await db.refresh(new_meal)
    return new_meal


@router.get("/")
async def list_meals(
    user_id: int = Query(...),
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meal)
        .where(Meal.user_id == user_id)
        .order_by(Meal.meal_time.desc())
        .limit(limit)
    )
    return result.scalars().all()

################################################################################

"""
Alfred AI Chat endpoint — conversational wellness assistant.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from openai import AsyncOpenAI

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.models.meal import Meal
from app.models.sleep import Sleep
from app.models.activity import Activity

router = APIRouter()

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

SYSTEM_PROMPT = """You are Alfred Pennyworth, a sophisticated AI wellness assistant.
You help users with nutrition, sleep, hydration, exercise, and general wellbeing.
Be warm, concise, and practical. Use the user's recent health data when relevant.
Never give medical diagnoses. Keep responses under 120 words unless detail is truly needed."""


class ChatRequest(BaseModel):
    message: str


@router.post("/")
async def chat(
    body: ChatRequest,
    user_id: int = Query(default=1),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=3)

    # Fetch recent context to ground the AI
    meals_res = await db.execute(
        select(Meal).where(and_(Meal.user_id == user_id, Meal.meal_time >= cutoff))
        .order_by(Meal.meal_time.desc()).limit(5)
    )
    sleep_res = await db.execute(
        select(Sleep).where(and_(Sleep.user_id == user_id, Sleep.sleep_start >= cutoff))
        .order_by(Sleep.sleep_start.desc()).limit(3)
    )
    act_res = await db.execute(
        select(Activity).where(and_(Activity.user_id == user_id, Activity.start_time >= cutoff))
        .order_by(Activity.start_time.desc()).limit(3)
    )

    meals     = meals_res.scalars().all()
    sleeps    = sleep_res.scalars().all()
    activities = act_res.scalars().all()

    context_lines = [f"Current time: {datetime.now(timezone.utc).strftime('%A %B %d at %H:%M UTC')}"]
    if meals:
        last = meals[0]
        context_lines.append(f"Last meal: {last.meal_type} ({last.description}) at {last.meal_time.strftime('%H:%M')}")
    if sleeps:
        s = sleeps[0]
        hrs = round((s.sleep_end - s.sleep_start).total_seconds() / 3600, 1) if s.sleep_end else None
        context_lines.append(f"Last sleep: {hrs}h, quality {s.quality_score}/10" if hrs else "Sleep data available")
    if activities:
        a = activities[0]
        context_lines.append(f"Last activity: {a.activity_type}, {a.duration_minutes} min")

    context = "\n".join(context_lines)

    try:
        resp = await _client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nUser context:\n{context}"},
                {"role": "user",   "content": body.message},
            ],
            max_tokens=200,
            temperature=0.7,
        )
        reply = resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.error(f"Chat completion failed: {exc}")
        reply = "I'm having trouble thinking right now. Please try again shortly."

    return {"reply": reply}

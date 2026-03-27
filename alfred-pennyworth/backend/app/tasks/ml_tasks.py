"""
Celery tasks for ML pattern analysis.

Runs daily at 2 AM. Computes per-user rolling wellness statistics and
writes derived features back to the database so that signal_detector.py
has pre-computed baselines available at inference time.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.core.celery_app import celery_app
from app.core.logging import logger


@celery_app.task
def retrain_prediction_models():
    """
    Nightly task: compute 14-day rolling wellness baselines for all users.

    For each user we calculate:
      - mean / std of sleep quality and duration
      - mean / std of daily calorie intake and burn
      - meal timing regularity score
    and persist these as calculated_features on the most recent records
    so they are available instantly at inference time.
    """
    logger.info("Starting nightly ML baseline computation...")
    try:
        asyncio.run(_compute_baselines())
        logger.info("ML baseline computation complete.")
        return {"status": "ok"}
    except Exception as exc:
        logger.error(f"ML baseline computation failed: {exc}", exc_info=True)
        return {"status": "error", "detail": str(exc)}


async def _compute_baselines():
    import numpy as np
    from sqlalchemy import select, and_
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    from app.core.config import settings
    from app.models.user import User
    from app.models.sleep import Sleep
    from app.models.meal import Meal
    from app.models.activity import Activity

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    window = timedelta(days=settings.PATTERN_DETECTION_WINDOW_DAYS)
    now = datetime.now(timezone.utc)
    cutoff = now - window

    async with async_session() as session:
        users_result = await session.execute(select(User.id))
        user_ids = [row[0] for row in users_result.fetchall()]

    for uid in user_ids:
        try:
            await _compute_user_baselines(async_session, uid, cutoff, now)
        except Exception as exc:
            logger.warning(f"Baseline computation failed for user {uid}: {exc}")

    await engine.dispose()


async def _compute_user_baselines(async_session, user_id: int, cutoff: datetime, now: datetime):
    import numpy as np
    from sqlalchemy import select, and_
    from app.models.sleep import Sleep
    from app.models.meal import Meal
    from app.models.activity import Activity

    async with async_session() as session:
        # --- Sleep ---
        sleep_result = await session.execute(
            select(Sleep).where(
                and_(Sleep.user_id == user_id, Sleep.sleep_start >= cutoff)
            ).order_by(Sleep.sleep_start.desc())
        )
        sleep_records = sleep_result.scalars().all()

        qualities = [s.quality_score for s in sleep_records if s.quality_score is not None]
        durations = [s.duration_minutes for s in sleep_records if s.duration_minutes is not None]

        sleep_baseline = {}
        if len(qualities) >= 3:
            q = np.array(qualities, dtype=float)
            sleep_baseline["quality_mean"] = round(float(q.mean()), 2)
            sleep_baseline["quality_std"] = round(float(q.std()), 2)
        if len(durations) >= 3:
            d = np.array(durations, dtype=float)
            sleep_baseline["duration_mean_min"] = round(float(d.mean()), 1)
            sleep_baseline["duration_std_min"] = round(float(d.std()), 1)

        # Write baseline back to most recent sleep record
        if sleep_records and sleep_baseline:
            most_recent_sleep = sleep_records[0]
            existing = most_recent_sleep.calculated_features or {}
            most_recent_sleep.calculated_features = {**existing, "baseline": sleep_baseline}

        # --- Meals ---
        meal_result = await session.execute(
            select(Meal).where(
                and_(Meal.user_id == user_id, Meal.meal_time >= cutoff)
            ).order_by(Meal.meal_time.desc())
        )
        meals = meal_result.scalars().all()

        daily_cals: dict = {}
        meal_hours: list = []
        for m in meals:
            day = m.meal_time.date().isoformat()
            daily_cals[day] = daily_cals.get(day, 0.0) + (m.calories or 0)
            meal_hours.append(m.meal_time.hour + m.meal_time.minute / 60)

        meal_baseline = {}
        if len(daily_cals) >= 3:
            cals = np.array(list(daily_cals.values()), dtype=float)
            meal_baseline["daily_cal_mean"] = round(float(cals.mean()), 1)
            meal_baseline["daily_cal_std"] = round(float(cals.std()), 1)
        if len(meal_hours) >= 5:
            hrs = np.array(meal_hours, dtype=float)
            meal_baseline["meal_hour_mean"] = round(float(hrs.mean()), 2)
            meal_baseline["meal_hour_std"] = round(float(hrs.std()), 2)

        if meals and meal_baseline:
            existing = meals[0].calculated_features or {}
            meals[0].calculated_features = {**existing, "baseline": meal_baseline}

        # --- Activities ---
        activity_result = await session.execute(
            select(Activity).where(
                and_(Activity.user_id == user_id, Activity.start_time >= cutoff)
            ).order_by(Activity.start_time.desc())
        )
        activities = activity_result.scalars().all()

        daily_burn: dict = {}
        for a in activities:
            day = a.start_time.date().isoformat()
            daily_burn[day] = daily_burn.get(day, 0.0) + (a.calories_burned or 0)

        activity_baseline = {}
        if len(daily_burn) >= 3:
            burns = np.array(list(daily_burn.values()), dtype=float)
            activity_baseline["daily_burn_mean"] = round(float(burns.mean()), 1)
            activity_baseline["daily_burn_std"] = round(float(burns.std()), 1)

        if activities and activity_baseline:
            existing = activities[0].calculated_features or {}
            activities[0].calculated_features = {**existing, "baseline": activity_baseline}

        await session.commit()

    logger.debug(
        f"User {user_id} baselines — sleep: {sleep_baseline}, "
        f"meals: {meal_baseline}, activity: {activity_baseline}"
    )

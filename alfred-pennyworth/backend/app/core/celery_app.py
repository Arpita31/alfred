"""
Celery configuration for background tasks and scheduling.
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "alfred_pennyworth",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.intervention_tasks",
        "app.tasks.ml_tasks",
        "app.tasks.data_sync_tasks",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

celery_app.conf.beat_schedule = {
    "check-interventions": {
        "task": "app.tasks.intervention_tasks.check_and_generate_interventions",
        "schedule": crontab(minute="*/15"),
    },
    "retrain-ml-models": {
        "task": "app.tasks.ml_tasks.retrain_prediction_models",
        "schedule": crontab(hour=2, minute=0),
    },
    "sync-calendar": {
        "task": "app.tasks.data_sync_tasks.sync_calendar_events",
        "schedule": crontab(minute=0),
    },
    "cleanup-old-data": {
        "task": "app.tasks.data_sync_tasks.cleanup_old_data",
        "schedule": crontab(day_of_week=0, hour=3, minute=0),
    },
}

################################################################################

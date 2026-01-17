"""
Celery tasks for data synchronization.
"""
from app.core.celery_app import celery_app
from app.core.logging import logger


@celery_app.task
def sync_calendar_events():
    """Sync calendar events from Google Calendar."""
    logger.info("Syncing calendar events...")
    return {"status": "synced"}


@celery_app.task
def cleanup_old_data():
    """Clean up old data."""
    logger.info("Cleaning up old data...")
    return {"status": "cleaned"}

################################################################################

"""
Health API endpoint.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/status")
async def health_status(db: AsyncSession = Depends(get_db)):
    """System health check"""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except:
        db_status = "error"
    
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
        "database": db_status
    }


@router.get("/config")
async def get_config():
    """Get non-sensitive configuration"""
    return {
        "confidence_threshold": settings.ML_CONFIDENCE_THRESHOLD,
        "max_interventions_per_day": settings.MAX_INTERVENTIONS_PER_DAY,
        "gpt_model": settings.GPT_MODEL
    }

################################################################################

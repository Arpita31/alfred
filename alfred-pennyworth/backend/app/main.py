"""
Main FastAPI application for Alfred Pennyworth system.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.logging import logger
from app.api.endpoints import interventions, meals, sleep, activities, calendar, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting Alfred Pennyworth system...")
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    logger.info("Shutting down Alfred Pennyworth system...")
    await close_db()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-powered wellness assistant for nutrition, rest, and performance",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    interventions.router,
    prefix=f"{settings.API_V1_PREFIX}/interventions",
    tags=["interventions"]
)
app.include_router(
    meals.router,
    prefix=f"{settings.API_V1_PREFIX}/meals",
    tags=["meals"]
)
app.include_router(
    sleep.router,
    prefix=f"{settings.API_V1_PREFIX}/sleep",
    tags=["sleep"]
)
app.include_router(
    activities.router,
    prefix=f"{settings.API_V1_PREFIX}/activities",
    tags=["activities"]
)
app.include_router(
    calendar.router,
    prefix=f"{settings.API_V1_PREFIX}/calendar",
    tags=["calendar"]
)
app.include_router(
    health.router,
    prefix=f"{settings.API_V1_PREFIX}/health",
    tags=["health"]
)


@app.get("/")
async def root():
    return {
        "message": "Alfred Pennyworth API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

################################################################################

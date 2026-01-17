# Alfred Pennyworth - AI Wellness Assistant

AI-powered wellness assistant using GPT-4 for intelligent health interventions.

## Quick Start

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 2. Start services
docker-compose up -d

# 3. Initialize database
docker-compose exec api python -c "from app.core.database import init_db; import asyncio; asyncio.run(init_db())"

# 4. Test it
curl http://localhost:8000/health
```

## API Documentation

Once running, visit: http://localhost:8000/docs

## Features

- ✅ AI-powered interventions (GPT-4)
- ✅ Meal, sleep, activity tracking
- ✅ Calendar integration
- ✅ REST API
- ✅ Docker deployment

## Tech Stack

- FastAPI (Python 3.11+)
- PostgreSQL 16
- Redis 7
- Celery
- OpenAI GPT-4
- Docker

## API Endpoints

- POST `/api/v1/interventions/generate` - Generate AI intervention
- GET `/api/v1/interventions/` - List interventions
- POST `/api/v1/meals/` - Log meal
- GET `/api/v1/meals/` - List meals
- POST `/api/v1/sleep/` - Log sleep
- GET `/api/v1/sleep/` - List sleep records
- POST `/api/v1/activities/` - Log activity
- GET `/api/v1/activities/` - List activities
- POST `/api/v1/calendar/` - Create event
- GET `/api/v1/calendar/upcoming` - Get upcoming events
- GET `/api/v1/health/status` - Health check

################################################################################

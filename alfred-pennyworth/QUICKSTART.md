# Alfred Pennyworth - Quick Start Guide

## Prerequisites

- Docker & Docker Compose
- OpenAI API Key

## Installation (5 minutes)

### Step 1: Create Project Structure
```bash
mkdir -p alfred-pennyworth/backend/app/{core,models,services,api/endpoints,tasks}
mkdir -p alfred-pennyworth/backend/alembic
cd alfred-pennyworth
```

### Step 2: Copy All Files
Copy each file from `COMPLETE_ALFRED_41_FILES.txt` into the correct location.

### Step 3: Configure Environment
```bash
cp .env.example .env
nano .env  # Add your OPENAI_API_KEY
```

### Step 4: Start Services
```bash
docker-compose up -d
```

### Step 5: Initialize Database
```bash
docker-compose exec api python -c "from app.core.database import init_db; import asyncio; asyncio.run(init_db())"
```

## Test It

```bash
# Health check
curl http://localhost:8000/health

# Create a test user (optional)
docker-compose exec api python
>>> from app.models.user import User
>>> # Create user in Python shell

# Generate intervention
curl -X POST "http://localhost:8000/api/v1/interventions/generate?user_id=1"
```

## View API Docs

Open: http://localhost:8000/docs

## Common Commands

```bash
# View logs
docker-compose logs -f api

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Run migrations
docker-compose exec api alembic upgrade head
```

## Troubleshooting

**Port already in use?**
Edit `docker-compose.yml` and change the port numbers.

**Database errors?**
```bash
docker-compose down -v
docker-compose up -d
```

**API not starting?**
```bash
docker-compose logs api
```

## Next Steps

1. Create test user via API or Python shell
2. Add sample data (meals, sleep)
3. Test intervention generation
4. Integrate with frontend
5. Enable Google Calendar sync (optional)

################################################################################

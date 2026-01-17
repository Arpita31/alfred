#!/bin/bash

echo "🎩 Alfred Pennyworth Setup"
echo "=========================="
echo ""

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not installed. Install from https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not installed. Install from https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose installed"
echo ""

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env and add your OPENAI_API_KEY!"
    echo ""
    read -p "Press Enter after adding your API key to .env..."
else
    echo "✅ .env file exists"
fi

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services..."
sleep 5

echo ""
echo "🗄️  Initializing database..."
docker-compose exec -T api python -c "
import asyncio
from app.core.database import init_db
asyncio.run(init_db())
print('✅ Database initialized')
"

echo ""
echo "🎉 Alfred Pennyworth is ready!"
echo ""
echo "📍 Services:"
echo "   - API: http://localhost:8000"
echo "   - Docs: http://localhost:8000/docs"
echo ""
echo "📚 Commands:"
echo "   - Logs: docker-compose logs -f api"
echo "   - Stop: docker-compose down"
echo ""

################################################################################

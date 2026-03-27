# 🎩 A.L.F.R.E.D. — Adaptive Life Framework for Rest, Energy & Decisions

## A Proactive, Context-Aware AI Wellness Assistant

Alfred is an **AI-driven personal wellness system** that delivers **high-impact, well-timed, and respectful interventions** to help users improve **nutrition, rest, recovery, and daily performance**.

Unlike typical health apps that overwhelm users with dashboards and notifications, Alfred is built around **decision quality**:

> **When to act, what to recommend, and when to do nothing.**

---

## 🧠 Core Philosophy

Alfred follows five guiding principles:

1. **Signal-Driven Intelligence**
   Interventions are triggered only by strong, explainable signals.

2. **Restraint Over Frequency**
   Fewer, higher-confidence recommendations build trust.

3. **Context Awareness**
   Time of day, calendar events, recent behavior, and preferences are always considered.

4. **Transparent Reasoning**
   Every recommendation explains *why* it was made.

5. **Human-Centered Tone**
   Calm, respectful, non-judgmental — like a good butler, not a boss.

---

## ✨ What Alfred Does

### Tracks Wellness Signals

* 🍽️ Meals & nutrition
* 😴 Sleep & recovery
* 🏃 Activity & exertion
* 🗓️ Calendar & schedule context

### Detects Patterns

* Meal gaps
* Poor sleep trends
* Recovery debt
* Schedule overload
* Energy & focus risks

### Generates AI-Powered Interventions

* Uses **GPT-4** to generate:

  * Short, actionable recommendations
  * Clear reasoning
  * Confidence scores
  * Alternatives and timing guidance

### Learns From Feedback

* Accepted / rejected interventions are recorded
* Prevents repetition
* Designed for future ML-based personalization

---

## 🏗️ System Architecture (High Level)

```
┌──────────────────────────┐
│        API Layer         │
│  FastAPI (Async REST)    │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│     Decision Engine      │
│  Signal Detection + AI   │
│  (GPT-4 Agent)           │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│     Context & Signals    │
│  Meals • Sleep •         │
│  Activity • Calendar     │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│   Persistence Layer      │
│  PostgreSQL + Redis      │
└──────────────────────────┘
```

Background processing (scheduled checks, retraining, syncing) is handled via **Celery + Redis**.

---

## 🧩 Tech Stack

* **Backend:** FastAPI (Python 3.11+)
* **AI:** OpenAI GPT-4
* **Database:** PostgreSQL 16
* **Cache / Queue:** Redis 7
* **Async Tasks:** Celery + Celery Beat
* **ORM:** SQLAlchemy (async)
* **Migrations:** Alembic
* **Deployment:** Docker & Docker Compose

---

## 📁 Project Structure (Simplified)

```
backend/
 ├─ app/
 │   ├─ core/          # config, db, logging, celery
 │   ├─ models/        # User, Intervention, Meal, Sleep, Activity, Calendar
 │   ├─ services/      # Alfred AI agent
 │   ├─ api/endpoints/ # REST endpoints
 │   └─ tasks/         # Celery tasks
 ├─ alembic/           # migrations
docker-compose.yml
Dockerfile
.env.example
README.md
```

---

## 🚀 Quick Start (Docker – Recommended)

### Prerequisites

* Docker
* Docker Compose
* OpenAI API Key

### 1️⃣ Configure Environment

```bash
cp .env.example .env
# Add your OPENAI_API_KEY
```

### 2️⃣ Start Services

```bash
docker-compose up -d
```

### 3️⃣ Initialize Database

```bash
docker-compose exec api python -c "\
from app.core.database import init_db
import asyncio
asyncio.run(init_db())
"
```

### 4️⃣ Verify Health

```bash
curl http://localhost:8000/health
```

### 5️⃣ Open API Docs

```
http://localhost:8000/docs
```

---

## 🔌 API Overview

### Interventions

* `POST /api/v1/interventions/generate`
* `GET  /api/v1/interventions/`
* `POST /api/v1/interventions/{id}/feedback`

### Data Logging

* Meals: `/api/v1/meals`
* Sleep: `/api/v1/sleep`
* Activities: `/api/v1/activities`
* Calendar: `/api/v1/calendar`

### System

* Health: `/api/v1/health/status`
* Config: `/api/v1/health/config`

---

## 🧪 Example Decision Flow

1. User logs meals & sleep

---

## 📱 Frontend UI (React + React Native)

### 1. React web

Folder: `frontend-web`

Commands:

- `cd frontend-web && npm install`
- `npm run dev`

Features included:

- Health status check
- Generate intervention button
- Meal/Sleep/Activity logging forms
- Intervention display card

### 2. React Native mobile

Folder: `frontend-mobile`

Commands:

- `cd frontend-mobile && npm install`
- `npm run start`

This is an Expo-based app with:

- Health status display
- Generate intervention button
- Example data submission for meal/sleep/activity

> Backend API base URL is hard-coded as `http://localhost:8000/api/v1` in both clients.

## 🔧 Where to modify

- Web API wrappers: `frontend-web/src/api.ts`
- Web app UI: `frontend-web/src/App.tsx`
- Mobile API wrappers: `frontend-mobile/src/api.ts`
- Mobile app UI: `frontend-mobile/App.tsx`

## 🧾 Notes

- Ensure backend is running first (`docker-compose up -d`).
- Use `user_id=1` for initial testing until auth is implemented.

## 🧪 Example Decision Flow

1. User logs meals & sleep
2. System detects a **4+ hour meal gap**
3. Confidence exceeds threshold (e.g. 0.85)
4. Alfred checks:

   * Quiet hours
   * Upcoming meetings
   * Recent interventions
5. GPT-4 generates:

   * Short suggestion
   * Reasoning
   * Alternatives
6. User accepts or rejects → feedback stored

---

## ⚙️ Key Configuration Options

| Setting                       | Purpose                         |
| ----------------------------- | ------------------------------- |
| `ML_CONFIDENCE_THRESHOLD`     | Minimum confidence to intervene |
| `QUIET_HOURS_START / END`     | Do-not-disturb window           |
| `MAX_INTERVENTIONS_PER_DAY`   | Prevent spam                    |
| `INTERVENTION_COOLDOWN_HOURS` | Avoid repetition                |
| `GPT_MODEL`                   | LLM used for reasoning          |

---

## 🛠️ Common Commands

```bash
# View logs
docker-compose logs -f api

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

---

## 🧠 Why This System Is Different

❌ Not a chatbot
❌ Not a calorie tracker
❌ Not notification spam

✅ A **decision-first AI system**
✅ Designed for **trust and restraint**
✅ Built for **research-grade iteration**

---

## 🛣️ Roadmap Ideas

* Wearable integrations (Oura, Whoop, Apple Health)
* ML-based signal confidence scoring
* Personalized intervention styles
* Frontend dashboard (signals → decisions → outcomes)
* Long-term habit modeling

---

## 👩‍🔬 Ideal Use Cases

* Research prototypes
* Hackathons
* Personal AI assistant experiments
* Decision-intelligence systems
* Health & wellness R&D

---

## 📜 Disclaimer

This project is for **research and experimentation purposes only**.
It is **not medical advice** and should not replace professional care.

---

## 🎩 Final Note

Alfred is not about *doing more* —
it’s about **doing the right thing at the right moment**.

# 🎩 A.L.F.R.E.D. — Adaptive Life Framework for Rest, Energy & Decisions

## A Proactive, Context-Aware AI Health & Wealth Assistant

Alfred is an **AI-driven personal wellness and finance system** that delivers **high-impact, well-timed, and respectful interventions** to help users improve **nutrition, rest, recovery, daily performance, and financial health**.

Unlike typical health apps that overwhelm users with dashboards and notifications, Alfred is built around **decision quality**:

> **When to act, what to recommend, and when to do nothing.**

---

## 🧠 Core Philosophy

Alfred follows five guiding principles:

1. **Signal-Driven Intelligence** — Interventions are triggered only by strong, explainable signals.
2. **Restraint Over Frequency** — Fewer, higher-confidence recommendations build trust.
3. **Context Awareness** — Time of day, recent behavior, and preferences are always considered.
4. **Transparent Reasoning** — Every recommendation explains *why* it was made.
5. **Human-Centered Tone** — Calm, respectful, non-judgmental — like a good butler, not a boss.

---

## ✨ What Alfred Does

### Tracks Wellness & Finance Signals

* 🍽️ Meals & nutrition (AI-parsed descriptions → macros)
* 😴 Sleep & recovery
* 🏃 Activity & exertion
* 💧 Hydration (daily reset + streak tracking)
* 💰 Net worth, cash flow, debt, and investments

### Detects Patterns

* Meal gaps and macro imbalances
* Poor sleep trends and recovery debt
* Negative cash flow and overspend by category
* Under-optimized tax-advantaged accounts
* High-interest debt situations

### Generates AI-Powered Interventions

* Uses **GPT-4** to generate short, actionable recommendations with confidence scores
* Rule-based financial intelligence (savings rate, FI progress, passive income ratio, debt strategy)

### Learns From Feedback

* Accepted / rejected interventions are recorded and prevent repetition

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────┐
│            Client Layer             │
│  Web (Vite + React)  ·  Mobile      │
│       (Expo / React Native)         │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│             API Layer               │
│       FastAPI (Async REST)          │
│   Auth · Meals · Sleep · Activity   │
│       Interventions · Chat          │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│          Decision Engine            │
│   Signal Detection + GPT-4 Agent    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│        Persistence Layer            │
│       PostgreSQL  ·  Redis          │
│   (Celery for background tasks)     │
└─────────────────────────────────────┘
```

---

## 🧩 Tech Stack

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| Backend      | FastAPI (Python 3.11+), SQLAlchemy async, Alembic |
| Auth         | JWT (python-jose) · pbkdf2_sha256 (passlib)    |
| AI           | OpenAI GPT-4                                    |
| Database     | PostgreSQL 16                                   |
| Cache/Queue  | Redis 7 + Celery + Celery Beat                  |
| Web Frontend | Vite + React 18 + TypeScript                    |
| Mobile       | Expo SDK 55 + React Native + TypeScript         |
| Deployment   | Docker & Docker Compose                         |

---

## 📁 Project Structure

```
alfred-pennyworth/
 ├── backend/
 │   ├── app/
 │   │   ├── core/           # config, database, security (JWT + hashing), celery
 │   │   ├── models/         # User, Intervention, Meal, Sleep, Activity
 │   │   ├── services/       # Alfred AI agent
 │   │   ├── api/endpoints/  # auth, meals, sleep, activities, interventions, chat
 │   │   └── tasks/          # Celery scheduled tasks
 │   └── alembic/            # DB migrations
 ├── frontend-web/           # Vite + React web app
 │   └── src/
 │       ├── App.tsx          # Auth gate + AppShell
 │       ├── LoginPage.tsx    # JWT login with field validation
 │       ├── SignupPage.tsx   # Registration with password strength meter
 │       ├── FinancePage.tsx  # Full personal finance module
 │       ├── api.ts           # apiFetch wrapper (auto Bearer token + 401 logout)
 │       └── auth.ts          # localStorage token/session helpers
 ├── frontend-mobile/        # Expo React Native app
 │   └── src/
 │       ├── screens/         # Dashboard, Nutrition, Sleep, Activity, Hydration,
 │       │                    #   AI, Finance, Profile, Login
 │       ├── context/         # Auth, App, Hydration, Sleep, Activity, Finance, Profile
 │       ├── components/      # Shared UI + domain components
 │       ├── hooks/           # useNutrition, useSleep, useActivity, useFinance, etc.
 │       ├── ml.ts            # On-device ML predictions (sleep score, recovery, etc.)
 │       └── storage.ts       # Async storage helpers
 ├── docker-compose.yml
 ├── Dockerfile
 └── .env.example
```

---

## 🚀 Quick Start (Docker — Recommended)

### Prerequisites

* Docker & Docker Compose
* OpenAI API Key

### 1. Configure Environment

```bash
cp .env.example .env
# Fill in: SECRET_KEY, OPENAI_API_KEY, and any other required values
```

### 2. Start All Services

```bash
docker-compose up -d
```

This starts: PostgreSQL, Redis, FastAPI (with hot-reload), Celery worker, and Celery Beat.

### 3. Initialize Database

```bash
docker-compose exec api python -c "
from app.core.database import init_db
import asyncio
asyncio.run(init_db())
"
```

### 4. Verify

```bash
curl http://localhost:8000/health
# Open API docs: http://localhost:8000/docs
```

---

## 🌐 Web Frontend

```bash
cd frontend-web
npm install
npm run dev        # http://localhost:5175
```

Proxies `/api/*` to `http://localhost:8000` automatically (configured in `vite.config.ts`).

### Web Features

| Page | Features |
| --- | --- |
| **Login / Signup** | JWT auth · field-level validation · password strength bar · auto-redirect |
| **Dashboard** | Health status · AI intervention · body state panel · predictive alerts · timeline |
| **Hydration** | Water tracker · daily streak · intake log |
| **Nutrition** | AI meal parser (description → macros) · meal history |
| **Sleep** | Sleep log · quality score |
| **Activity** | Workout log · duration + calories |
| **AI Insights** | Chat with Alfred · generate interventions |
| **Finance** | Full personal finance module (see below) |

### Finance Module

The Finance page is a standalone wealth management tool with six tabs:

* **Overview** — Net worth hero, 4-metric grid (cash flow, savings rate, passive income %, runway), asset layer breakdown bar, NW trajectory chart, all AI insights with urgency badges, income pipeline split
* **Balance Sheet** — Assets grouped by layer (Operating → Reserve → Investments → Opportunity) with inline edit + delete, liabilities with APR, net worth summary
* **Cash Flow** — Income streams (active/passive), expenses with category colors, budget limits per category (actual vs budgeted, over-budget warnings), subscription filter with annual total, spending-by-category bar chart, savings rate tracker
* **Portfolio** — Tax efficiency score, allocation rings (Core / Growth / Asymmetric) vs targets with rebalance warnings, tax-advantaged priority stack
* **FI Tracker** — FI number (4% rule), years-to-FI, compound growth projector with sliders (contribution · return % · time horizon) showing 3 scenarios, phase roadmap, wealth equation
* **Debt** — Avalanche vs Snowball toggle, extra payment slider, side-by-side interest + time comparison, per-debt payoff order with months and interest cost, savings vs minimum payments

**Finance engine functions:**
- `simulatePayoff()` — Month-by-month cascade simulation for both debt strategies
- `projectGrowth()` — Compound interest projection with multiple contribution scenarios
- `calcTaxEfficiency()` — % of investable assets in tax-advantaged accounts
- `generateInsights()` — 15+ rule-based insights across critical / warning / tip urgency levels

---

## 📱 Mobile App (Expo)

```bash
cd frontend-mobile
npm install
npx expo start       # Scan QR with Expo Go, or press w for web
```

### Mobile Screens

| Screen | Features |
| --- | --- |
| **Login** | Username/email + password, JWT auth |
| **Dashboard** | Summary cards, body state, quick-log shortcuts |
| **Hydration** | Water intake buttons, daily progress ring, streak, daily reset with history archive |
| **Nutrition** | Meal logging, macro breakdown, meal history |
| **Sleep** | Native TimePicker (iOS spinner / Android clock), sleep log, quality picker, sleep score ring |
| **Activity** | Workout type, duration, calories, training load card |
| **AI** | Chat with Alfred, intervention cards |
| **Finance** | Balance sheet, cash flow, FI tracker (mobile layout) |
| **Profile** | Edit name/weight/height/age/sex, sign out |

### Mobile Architecture

* **AuthContext** — token persistence via SecureStore (native) or localStorage (web shim)
* **AppContext** — shared refresh, 401 auto-logout subscription
* **Domain contexts** — Hydration, Sleep, Activity, Finance, Profile each own their state + persistence
* **ErrorBoundary** — catches render crashes with "Try again" reset
* **useRefreshOnFocus** — refreshes shared context when navigating back to a screen
* **ml.ts** — on-device ML layer for sleep score, recovery index, hydration risk, energy level, focus score, and meal gap detection (no API call required)

---

## 🔌 API Reference

### Auth
```
POST /api/v1/auth/register   — Create account, returns JWT
POST /api/v1/auth/token      — Login (OAuth2 password flow), returns JWT
```

### Health Data
```
POST   /api/v1/meals             — Log a meal
GET    /api/v1/meals             — Get meal history
POST   /api/v1/meals/parse       — AI-parse meal description → macros
POST   /api/v1/sleep             — Log a sleep session
POST   /api/v1/activities        — Log an activity
```

### AI & Interventions
```
POST /api/v1/interventions/generate        — Trigger Alfred to analyze + generate
GET  /api/v1/interventions                 — Get intervention history
POST /api/v1/interventions/{id}/feedback   — Submit accepted/snoozed feedback
POST /api/v1/chat                          — Chat with Alfred
```

### System
```
GET /api/v1/health/status   — Backend + DB health
GET /api/v1/health/config   — Active configuration
```

---

## 🧪 Example Decision Flow

1. User logs meals and sleep via app
2. System detects a 4+ hour meal gap
3. Confidence exceeds threshold (e.g. 0.85)
4. Alfred checks: quiet hours, recent interventions, cooldown
5. GPT-4 generates a short suggestion with reasoning and alternatives
6. User accepts or rejects → feedback stored, prevents repetition

---

## ⚙️ Key Configuration

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | JWT signing key (min 32 chars) |
| `OPENAI_API_KEY` | GPT-4 access |
| `ML_CONFIDENCE_THRESHOLD` | Minimum confidence to trigger an intervention |
| `QUIET_HOURS_START / END` | Do-not-disturb window |
| `MAX_INTERVENTIONS_PER_DAY` | Prevent notification spam |
| `INTERVENTION_COOLDOWN_HOURS` | Minimum gap between interventions |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) |

---

## 🛠️ Common Commands

```bash
# View API logs
docker-compose logs -f api

# Restart all services
docker-compose restart

# Stop
docker-compose down

# Full reset (drops DB volumes)
docker-compose down -v && docker-compose up -d
```

---

## 🛣️ Roadmap

* [ ] Backend persistence for Finance module (currently localStorage)
* [ ] Wearable integrations (Oura, Whoop, Apple Health)
* [ ] ML-based signal confidence scoring (replace rule-based thresholds)
* [ ] Personalized intervention styles per user
* [ ] Long-term habit modeling and trend visualization
* [ ] Push notifications (mobile)
* [ ] CSV export for finance and health data

---

## 📜 Disclaimer

This project is for **research and experimentation purposes only**.
It is **not medical or financial advice** and should not replace professional guidance.

---

## 🎩 Final Note

Alfred is not about *doing more* —
it's about **doing the right thing at the right moment**.

# VoltLedger

**Financial-grade EV battery risk intelligence for lenders, auction houses, and secondary markets.**

VoltLedger is a B2B SaaS platform that answers the core financial questions about any EV battery:

- What is this battery's **risk grade** (A–F, like a FICO score for batteries)?
- What is its **residual value** today and in 12/24/36/60 months?
- What **LTV ratio** and **risk-adjusted interest rate** should a lender apply?
- Is this battery viable for **second-life reuse** (grid storage, refurbishment) or only recycling?

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Lender Portal (Next.js 14)          :3002               │
│  Fleet Overview · Battery Detail · Billing · Admin       │
└────────────────────┬────────────────────────────────────┘
                     │ SERVICE_TOKEN (server-to-server)
┌────────────────────▼────────────────────────────────────┐
│  REST API (Fastify 4)                :3001               │
│  /v1/batteries · /v1/risk · /v1/ltv                      │
│  /v1/residual-value · /v1/second-life · /v1/fleet        │
└──────┬─────────────────────────────────────┬────────────┘
       │ Prisma                              │ BullMQ
┌──────▼──────────┐              ┌───────────▼────────────┐
│  PostgreSQL 16  │              │  Ingestion Workers      │
│  (Prisma ORM)   │              │  Telemetry → Scoring    │
└─────────────────┘              └───────────┬────────────┘
                                             │
                                 ┌───────────▼────────────┐
                                 │  Scoring Engine         │
                                 │  Risk · RV · LTV        │
                                 │  Second-Life · Forecast │
                                 └────────────────────────┘
```

### Monorepo Layout

```
apps/
  api/           Fastify REST API
  dashboard/     Next.js 14 lender portal
  ingestion/     BullMQ telemetry pipeline workers
packages/
  db/            Prisma schema, client, migrations, seed
  scoring/       Intelligence engine (risk, LTV, RV, second-life)
  types/         Shared TypeScript types
tools/
  synthetic-generator/  Generate realistic fake battery + telemetry data
  bulk-score/           CLI to score all batteries in DB
  generate-key/         API key generator
infra/
  docker-compose.yml    Postgres 16 + Redis 7 for local dev
docs/
  index.html            Static marketing landing page
data/
  synthetic/            Pre-generated battery JSON files + NDJSON stream
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts |
| Backend API | Fastify 4, TypeScript, Zod |
| Auth | Clerk (`@clerk/nextjs`) |
| Billing | Stripe (checkout, billing portal, webhooks) |
| Database | PostgreSQL 16, Prisma 5 |
| Queue / Cache | BullMQ + Redis 7 |
| Email | Resend |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment | Railway (Docker-based) |

---

## Intelligence Engine

All scoring logic lives in `packages/scoring/src/`:

### Risk Score (0–1000, grade A–F)

Five weighted sub-scores compose the final grade:

| Sub-score | Weight | Signal |
|---|---|---|
| Degradation | 30% | Actual vs. expected SoH decline by chemistry/age |
| Thermal | 20% | Cell temperature vs. chemistry-specific thresholds |
| Usage Pattern | 20% | DCFC ratio penalty, deep-discharge frequency |
| Capacity Retention | 20% | Direct SoH function |
| Age-Adjusted | 10% | SoH vs. expected benchmark for chemistry/age |

Grade thresholds: **A** ≥ 800 · **B** ≥ 650 · **C** ≥ 500 · **D** ≥ 350 · **F** < 350

### Residual Value

`vehicleValue × batteryValuePct × sohFactor × marketDepreciation^age`

Produces a current USD estimate and a 60-month monthly forecast.

### LTV Recommendation

Starts at 75% base, scales 85% max / 40% floor based on risk score. Deducts for abnormal degradation, thermal anomalies, high DCFC usage, and deep-discharge events. Risk premium: 15 bps per 100-point score drop below 1000.

### Second-Life Assessment

Use-case ladder (by minimum SoH threshold):

| Use Case | Min SoH |
|---|---|
| EV Fleet reuse | ≥ 75% |
| Stationary grid storage | ≥ 70% |
| Commercial stationary | ≥ 65% |
| Residential stationary | ≥ 60% |
| Refurbishment | ≥ 55% |
| Recycling only | < 55% |

---

## Subscription Tiers

| Plan | Battery Quota | VIN Lookups | Price |
|---|---|---|---|
| Starter | 100 / month | 25 / month | Trial |
| Professional | 500 / month | Unlimited | $799 / month |
| Enterprise | Unlimited | Unlimited | Contact sales |

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in required values (see Environment Variables below)

# 3. Start Postgres + Redis
pnpm infra:up

# 4. Run database migrations
pnpm db:migrate

# 5. Seed reference data (battery models + demo lender)
pnpm db:seed

# 6. Generate and seed synthetic battery data
pnpm generate:synthetic:seed        # 50 batteries, 5 years of telemetry
# pnpm generate:synthetic:small     # smaller dataset for fast iteration

# 7. Start all services
pnpm dev
```

Services will be available at:
- Dashboard: http://localhost:3002
- API: http://localhost:3001
- API health: http://localhost:3001/health

### Useful Commands

```bash
pnpm api:dev            # API only
pnpm dashboard:dev      # Dashboard only
pnpm ingestion:dev      # Ingestion workers only

pnpm ingestion:load     # Load NDJSON telemetry stream into queue
pnpm bulk-score         # Score all batteries in DB

pnpm db:studio          # Open Prisma Studio
pnpm db:migrate         # Run pending migrations
pnpm db:seed            # Reseed reference data

pnpm infra:up           # Start Postgres + Redis
pnpm infra:down         # Stop infrastructure containers
```

---

## Environment Variables

### Root `.env`

```env
DATABASE_URL="postgresql://voltledger:voltledger@localhost:5433/voltledger?schema=public"
REDIS_URL="redis://localhost:6379"
API_PORT=3001
DEV_SKIP_AUTH=true   # set to false in production
```

### API Service

```env
PORT=3001
CORS_ORIGIN=             # dashboard URL
SERVICE_TOKEN=           # shared secret for dashboard→API calls
RESEND_API_KEY=          # transactional email
EMAIL_FROM=              # sender address
EMAIL_NOTIFY=            # admin inbox for early access notifications
LOG_LEVEL=info
NODE_ENV=development
```

### Dashboard Service

```env
NEXT_PUBLIC_APP_URL=
INTERNAL_API_URL=        # API base URL for server-to-server calls
SERVICE_TOKEN=           # must match API
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
ADMIN_CLERK_USER_ID=     # Clerk user ID granted admin access
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PROFESSIONAL=
NEXT_TELEMETRY_DISABLED=1
```

---

## API Authentication

All API endpoints require an `X-Api-Key` header:

```
X-Api-Key: vl_live_<key>
```

API keys are provisioned per lender organization. In development, set `DEV_SKIP_AUTH=true` to bypass auth entirely.

Internal dashboard-to-API calls use `X-Service-Token` (bypasses per-lender quota enforcement).

**Rate limit:** 100 requests / minute per API key or IP.

---

## Key API Endpoints

```
GET  /health

GET  /v1/batteries/:serial           Battery summary + latest risk grade
POST /v1/batteries/:serial/score     Trigger re-score

GET  /v1/risk/:serial                Full risk score + sub-scores + flags
GET  /v1/residual-value/:serial      Current value + 60-month forecast
GET  /v1/ltv/:serial                 LTV recommendation + risk premium
GET  /v1/second-life/:serial         Second-life viability + use case

GET  /v1/fleet/stats                 Aggregate fleet KPIs
GET  /v1/fleet/batteries             Paginated battery list
GET  /v1/fleet/flagged               High-risk batteries
GET  /v1/fleet/:serial/telemetry     Time-series telemetry
GET  /v1/fleet/:serial/detail        Full battery detail bundle

GET  /v1/lookup?vin=&id=             Resolve VIN or battery ID to serial

GET  /v1/account                     Lender account + subscription info
POST /v1/account/sync                Sync Stripe subscription state
```

---

## Deployment

VoltLedger is deployed on [Railway](https://railway.app) using Docker. Each service (`api`, `dashboard`) has its own `Dockerfile` and is configured in `railway.toml`.

Required Railway plugins: **PostgreSQL** and **Redis**.

Set all environment variables listed above as Railway service variables before deploying.

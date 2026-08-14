# VoltLedger

**Financial-grade EV battery risk intelligence for lenders, fleet operators, and secondary markets.**

VoltLedger answers the core financial questions about any EV battery:

- What is this battery's **risk grade** (A–F, like a FICO score for batteries)?
- What is its **residual value** today, and in 12/24/36/60 months?
- What **LTV ratio** and **risk-adjusted interest rate** should a lender apply?
- Is this battery viable for **second-life reuse** (grid storage, refurbishment) or only recycling?
- Can VoltLedger **prove** any of the above — with real data, not just a plausible-looking model?

That last question is what most of this document is about. VoltLedger's "Evidence Layer" — seven
workstreams (WS-A through WS-G), all shipped as of 2026-08-13 — exists to turn a working demo into
a due-diligence-ready product: real degradation data anchoring the scoring model, a validation
harness proving its accuracy, a residual-value back-test against real market data, a counterfactual
loss-reduction simulator, a mock loan-origination-system proving the API integration contract, a
passport-resolver layer that can demonstrate every "ugly" data-completeness scenario a real lender
will hit, and a provenance system that labels every number as real or simulated so nothing
overclaims.

---

## Table of contents

1. [System architecture](#system-architecture)
2. [Monorepo layout](#monorepo-layout)
3. [Tech stack](#tech-stack)
4. [The Evidence Layer](#the-evidence-layer)
5. [Domain model](#domain-model)
6. [The intelligence engine](#the-intelligence-engine)
7. [WS-A — Real degradation anchor](#ws-a--real-degradation-anchor)
8. [WS-B — Scoring validation harness](#ws-b--scoring-validation-harness)
9. [WS-C — Residual-value calibration + market back-test](#ws-c--residual-value-calibration--market-back-test)
10. [WS-D — Portfolio loss simulator](#ws-d--portfolio-loss-simulator-counterfactual)
11. [WS-E — Mock LOS + decision embed](#ws-e--mock-los--decision-embed)
12. [WS-F — Coverage-state simulation](#ws-f--coverage-state-simulation)
13. [WS-G — Provenance & the validation surface](#ws-g--provenance--the-validation-surface)
14. [EU Battery Passport (Regulation 2023/1542)](#eu-battery-passport-regulation-20231542)
15. [API reference](#api-reference)
16. [Actions & use cases](#actions--use-cases)
17. [Subscription tiers](#subscription-tiers)
18. [Local development](#local-development)
19. [Environment variables](#environment-variables)
20. [Deployment](#deployment)
21. [Known limitations & honesty notes](#known-limitations--honesty-notes)
22. [Appendix — full script reference](#appendix--full-script-reference)

---

## System architecture

```mermaid
graph TB
    subgraph Client Apps
        LP["Lender Portal<br/>Next.js 14 · :3002<br/>Clerk auth"]
        MLOS["Mock LOS<br/>Next.js 14 · :3003<br/>external-lender simulator"]
        PSU["Portfolio Sim UI<br/>Next.js 14 · :3004<br/>no auth, direct DB read"]
    end

    subgraph API Layer
        API["REST API — Fastify 4 · :3001<br/>X-Api-Key / X-Service-Token auth"]
    end

    subgraph Domain Logic
        SCORING["packages/scoring<br/>Risk · RV · LTV · Second-Life<br/>Forecast · Provenance"]
        RESOLVERS["Passport Resolvers<br/>Catena-X · GS1 · Direct-OEM<br/>Aggregator · Mock"]
    end

    subgraph Data Layer
        PG[("PostgreSQL 16<br/>via Prisma 5")]
        REDIS[("Redis 7<br/>BullMQ queues")]
    end

    subgraph Async Ingestion
        ING["apps/ingestion<br/>BullMQ Workers<br/>telemetry -> scoring"]
    end

    subgraph Public Data Sources — WS-A / WS-C research
        NASA["NASA PCoE<br/>real cell degradation cycles"]
        CALCE["CALCE CS2/CX2<br/>real cell degradation cycles"]
        MANHEIM["Manheim / Cox Automotive<br/>Used Vehicle Value Index"]
        AUTOVISTA["Autovista / JD Power<br/>EU BEV %RV (secondary)"]
    end

    LP -- "X-Service-Token" --> API
    MLOS -- "X-Api-Key (external-LOS pattern)" --> API
    PSU -. "direct Prisma read, same DB" .-> PG

    API --> SCORING
    API --> RESOLVERS
    API --> PG
    ING --> REDIS
    ING --> PG
    RESOLVERS -.-> PG

    SCORING -. "calibrated from (WS-A)" .-> NASA
    SCORING -. "cross-checked against (WS-A)" .-> CALCE
    SCORING -. "back-tested against (WS-C)" .-> MANHEIM
    SCORING -. "sanity-checked against (WS-C)" .-> AUTOVISTA
```

Four independent apps, one Postgres database, one Fastify API as the single write/read gateway for
everything except `portfolio-sim-ui` (which reads the shared DB directly via Prisma — it's an
internal tool, not lender-facing, so it skips the API layer and has no auth of its own).

---

## Monorepo layout

```
apps/
  api/                  Fastify 4 REST API — the single source of truth for all lender-facing data
  dashboard/             Next.js 14 lender portal (fleet + fleet-ops + validation + billing)
  ingestion/             BullMQ telemetry -> scoring pipeline workers
  mock-los/               WS-E: external-lender loan-origination-system simulator
  portfolio-sim-ui/       WS-D: portfolio loss-simulation viewer + live parameter editor

packages/
  db/                    Prisma schema, generated client, migrations, seed script
  scoring/                The intelligence engine: risk, RV, LTV, second-life, forecast, provenance
  types/                 Shared TypeScript types (zero runtime deps — types only)
  calibration/            WS-A: real degradation-data ingest, fit, holdout validation
  validation/             WS-B: scoring-accuracy validation harness (vs. WS-A's real cells)
  rv-calibration/         WS-C: residual-value calibration + Manheim/Autovista market back-test

tools/
  synthetic-generator/    Generates realistic fake battery + telemetry data for demos/dev
  bulk-score/             CLI: score every battery in the DB missing a RiskScore
  generate-key/           CLI: issue a lender API key
  portfolio-sim/          WS-D: the counterfactual "with vs. without VoltLedger" loss simulator

infra/
  docker-compose.yml      Postgres 16 + Redis 7 (+ optional pgAdmin) for local dev

docs/
  VoltLedger - Build Spec v2.md   The Evidence Layer build spec (WS-A through WS-G)
  validation/                      Generated evidence docs + JSON chart sidecars (see WS-G)

data/
  synthetic/              Pre-generated battery JSON files + NDJSON stream for ingestion testing
```

`packages/scoring` and `packages/rv-calibration` are matched by `pnpm-workspace.yaml`'s
`packages/*` glob even though they're absent from the root `package.json`'s (unused, npm/yarn-era)
`"workspaces"` array — pnpm ignores that field when `pnpm-workspace.yaml` exists. A harmless,
pre-existing inconsistency, not a bug.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts, `react-markdown` |
| Backend API | Fastify 4, TypeScript, Zod |
| Auth | Clerk (`@clerk/nextjs`) — dashboard only; API uses per-lender API keys |
| Billing | Stripe (Checkout, Billing Portal, webhooks) |
| Database | PostgreSQL 16, Prisma 5 |
| Queue / Cache | BullMQ + Redis 7 |
| Email | Resend |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment (current) | Railway (Docker-based) |

---

## The Evidence Layer

The build spec (`docs/VoltLedger - Build Spec v2.md`) frames VoltLedger's value as six "levers":
scoring accuracy, a real degradation dataset, RV-vs-market validation, loss reduction, an LOS
embed, and LTV/pricing-change evidence — each implemented as a workstream. All seven shipped:

```mermaid
flowchart TD
    WSA["WS-A: Real Degradation Anchor<br/>NASA PCoE + CALCE CS2/CX2"] --> WSB["WS-B: Scoring Validation Harness"]
    WSB --> ENGINE["packages/scoring<br/>Risk · RV · LTV · Second-Life · Forecast"]
    WSC["WS-C: RV Calibration + Market Back-Test<br/>Manheim (primary) + Autovista (secondary)"] --> ENGINE
    ENGINE --> WSD["WS-D: Portfolio Loss Simulator<br/>counterfactual WITH vs WITHOUT"]
    ENGINE --> WSE["WS-E: Mock LOS + Decision Embed"]
    WSF["WS-F: Coverage-State Simulation<br/>passport resolver scenario forcing"] --> ENGINE
    WSA --> WSG["WS-G: Provenance + Validation Surface"]
    WSB --> WSG
    WSC --> WSG
    WSD --> WSG
    WSF --> WSG
    WSG --> DASH["Dashboard /validation section"]
```

| WS | Lever | What it proves | Status |
|---|---|---|---|
| **A** | Degradation dataset | The scoring model's cycle-loss assumptions are checked against real cells, not just hand-tuned. | Done |
| **B** | Scoring accuracy | The model's SoH/RUL error is a measured number (MAE/RMSE), not a claim. | Done |
| **C** | RV-vs-market validation | The residual-value model is back-tested against real public market indices. | Done |
| **D** | Loss reduction | A counterfactual portfolio simulation quantifies "with vs. without VoltLedger" credit loss. | Done |
| **E** | LOS embed | A real external-lender integration pattern is proven against the actual public API. | Done |
| **F** | (feeds G) | Every "ugly" data-completeness scenario a real lender will hit is demonstrably handled. | Done |
| **G** | Evidence packaging | Nothing simulated is ever displayed without saying so; all of the above is reachable from the lender portal. | Done |

Two decisions apply across every workstream and are **locked** (don't relitigate without a new
reason):
- **Currency: USD stays canonical**, not EUR — the build spec's original Gate C recommendation
  assumed a EUR/EU-market pivot; the whole codebase (DB, scoring, types) was already all-USD, so
  there was nothing to convert away from.
- **Backend: Fastify + Prisma + Postgres.** An early, ~1.3MB unused Xano workspace was found and
  deleted before this build started.

---

## Domain model

27 Prisma models across 7 logical groups. Two ERDs — splitting battery/intelligence from
lender/billing keeps each one legible.

### Battery & intelligence domain

```mermaid
erDiagram
    BatteryModel ||--o{ Battery : "spec sheet for"
    Battery ||--o{ BatteryTelemetryPoint : has
    Battery ||--o{ RiskScore : "scored as"
    Battery ||--o{ ResidualValueEstimate : "valued as"
    Battery ||--o{ DegradationForecast : "forecast as"
    Battery ||--o{ LtvRecommendation : "priced as"
    Battery ||--o{ SecondLifeAssessment : "assessed as"
    Battery ||--o{ LifecycleEvent : logs
    Battery ||--o{ Certification : "certified by"
    Battery ||--o| SupplyChain : "sourced via"
    Battery ||--o| BatteryPassport : "documented by"
    Battery ||--o{ Loan : "collateral for"
    Battery ||--o{ OriginationAudit : "audited at"
    BatteryPassport ||--o| PassportVerification : "verified by"
    BatteryPassport ||--o{ OriginationAudit : "referenced in"
    Loan ||--o{ OriginationAudit : "originated with"
    Loan ||--o{ SimLoanOutcome : "simulated as"
```

**`Battery`** is the central entity — one row per physical pack. Key fields: `serialNumber`
(unique), `vin?`, `chemistry` (`LFP|NMC|NCA|LTO|UNKNOWN`), `nominalCapacityKwh`, `status`
(`ACTIVE|FLAGGED|DECOMMISSIONED|SECOND_LIFE`), `dataSource` (`OEM_API|MQTT_TELEMATICS|
MANUAL_UPLOAD|AUCTION_SCAN|SYNTHETIC|EU_PASSPORT` — this single field is what WS-G's whole
provenance system derives from), `manufacturedAt?`.

The five **computed-output** models (`RiskScore`, `ResidualValueEstimate`, `DegradationForecast`,
`LtvRecommendation`, `SecondLifeAssessment`) are all point-in-time, append-only, indexed
`[batteryId, <timestamp> desc]` — every scoring run writes a new row rather than updating one, so
history is preserved automatically.

`OriginationAudit` is the compliance artifact: a frozen JSON snapshot (`evidenceSnapshot`) of
everything known about a battery at the moment a loan decision is made, plus human-readable
`attestationText` and (WS-G) a persisted `provenance` value — none of which can drift after the
fact even if the battery's live data later changes.

### Lender, billing & portfolio-sim domain

```mermaid
erDiagram
    Organization ||--o| Lender : "billed as"
    Lender ||--o{ LenderUser : employs
    Lender ||--o{ ApiKey : issues
    ApiKey ||--o{ ApiUsageRecord : logs
    Lender ||--o{ ApiUsageRecord : logs
    Lender ||--o{ WebhookSubscription : configures
    WebhookSubscription ||--o{ WebhookDelivery : attempts
    Lender ||--o{ LtvRecommendation : receives
    Lender ||--o{ OriginationAudit : originates
    PortfolioSimRun ||--o{ SimLoanOutcome : produces
```

`Organization` → `Lender` is a 1:1 split: `Organization` is the tenant identity, `Lender` is the
billable, tier-scoped account (Stripe customer/subscription IDs, `LenderTier`
`STARTER|PROFESSIONAL|ENTERPRISE`, monthly battery/VIN-lookup quotas). `ApiKey.keyHash` is
bcrypt-hashed; the raw key (`vl_<env>_<32 hex>`) is shown exactly once at generation time.
`PortfolioSimRun`/`SimLoanOutcome` (WS-D) are intentionally disconnected from the rest of the
schema except an optional `Loan` link — a pure counterfactual sandbox, not live lender data.

### All 14 enums

| Enum | Values |
|---|---|
| `Chemistry` | `LFP, NMC, NCA, LTO, UNKNOWN` |
| `BatteryStatus` | `ACTIVE, FLAGGED, DECOMMISSIONED, SECOND_LIFE` |
| `DataSource` | `OEM_API, MQTT_TELEMATICS, MANUAL_UPLOAD, AUCTION_SCAN, SYNTHETIC, EU_PASSPORT` |
| `PassportTier` | `PUBLIC, RESTRICTED, CONFIDENTIAL` |
| `DataExchangeFramework` | `CATENA_X, GS1, DIRECT_OEM, THIRD_PARTY_AGGREGATOR, MOCK` |
| `SubscriptionStatus` | `TRIALING, ACTIVE, PAST_DUE, CANCELLED, INCOMPLETE` |
| `LenderTier` | `STARTER, PROFESSIONAL, ENTERPRISE` |
| `LenderType` | `BANK, CREDIT_UNION, CAPTIVE_FINANCE, AUTO_FINTECH, AUCTION_HOUSE, INSURANCE, REMARKETING` |
| `ApiKeyStatus` | `ACTIVE, REVOKED, EXPIRED` |
| `RiskGrade` | `A, B, C, D, F` |
| `Provenance` (WS-G) | `REAL_ANCHORED, SIMULATED_CALIBRATED, ILLUSTRATIVE` |
| `SecondLifeUseCase` | `STATIONARY_STORAGE_GRID, STATIONARY_STORAGE_COMMERCIAL, STATIONARY_STORAGE_RESIDENTIAL, EV_FLEET_LOWER_DEMAND, REFURBISHMENT_RESALE, RECYCLING_ONLY` |
| `LifecycleEventType` | `MANUFACTURED, SOLD, REGISTERED, SERVICE, SWAP, DAMAGE, REPAIR, CERTIFICATION, DECOMMISSIONED, SECOND_LIFE_ENTRY, RECYCLED` |
| `LenderUserRole` | `OWNER, MEMBER, VIEWER` |

---

## The intelligence engine

All scoring logic lives in `packages/scoring/src/`, orchestrated by `engine.ts`'s
`runIntelligenceEngine()` — one function that runs all five models and persists their outputs in a
single transaction.

```mermaid
sequenceDiagram
    participant Client as Lender / mock-los
    participant API as apps/api
    participant Engine as runIntelligenceEngine()
    participant Recon as reconcileSoH()
    participant DB as PostgreSQL

    Client->>API: POST /v1/batteries/:serial/score
    API->>DB: fetch battery + last 12wk telemetry
    API->>DB: fetch passport (explicit passportId or auto-attach)
    API->>Engine: {battery, recentPoints, passportContext}
    Engine->>Recon: reconcileSoH(latestTelemetrySoH, passportContext)
    Recon-->>Engine: ReconciledSoH {value, source, confidence, delta}
    Engine->>Engine: computeRiskScore() — 5 weighted sub-scores
    Engine->>Engine: computeResidualValue(reconciledSoH) — WS-C
    Engine->>Engine: computeLtv()
    Engine->>Engine: assessSecondLife()
    Engine->>Engine: computeDegradationForecast()
    Engine->>DB: persist RiskScore + ResidualValueEstimate + LtvRecommendation + SecondLifeAssessment + DegradationForecast (1 transaction)
    Engine-->>API: EngineResult {sohSource, passportVerified}
    API-->>Client: 200 {batteryId, riskScoreId, sohSource, ...}
```

### SoH reconciliation (`passport.ts`'s `reconcileSoH`)

Before anything else runs, telemetry-derived SoH and EU Battery Passport-derived SoH (if present)
are reconciled into one authoritative value with a confidence score:

| Data available | Source | Confidence |
|---|---|---|
| Neither | `NONE` | 0.10 (falls back to `DATALESS_SOH_ASSUMPTION = 85%`) |
| Telemetry only | `TELEMETRY` | 0.70 |
| Passport (restricted tier) only, verified + chain-valid | `PASSPORT` | 0.80 |
| Passport only, unverified | `PASSPORT` | 0.60 |
| Both, verified + chain-valid | `BLENDED` (65% passport / 35% telemetry) | 0.92, or reduced if they disagree |
| Both, unverified | `BLENDED` (45% passport / 55% telemetry) | 0.78, or reduced if they disagree |

When passport and telemetry SoH disagree by **more than 8 percentage points**, confidence is cut
(`max(0.40, baseConfidence − |delta| × 0.02)`) — an honest-instrument-disagreement signal, not
necessarily fraud. `computePassportAdjustment()` layers a second, independent score adjustment on
top (identity verification +1 to +3, `FAULTY` status −15, `DEGRADED` −5, lifetime max temp >65°C
−8, and a discrepancy penalty of −5 to −12 depending on delta magnitude), clamped to [−30, +10].

### Risk score (0–1000, grade A–F)

Five weighted sub-scores, each 0–100:

| Sub-score | Weight | Signal |
|---|---|---|
| Degradation | 30% | Actual vs. expected SoH decline rate for chemistry/age, plus an absolute-SoH-for-age penalty |
| Thermal | 20% | Average/peak cell temperature vs. chemistry-specific optimal/warn/critical thresholds |
| Usage Pattern | 20% | DCFC ratio penalty (>50% = critical) + deep-discharge frequency (<10% SoC readings) |
| Capacity Retention | 20% | Direct linear function of reconciled SoH: 100% SoH → 100, 60% SoH → 0 |
| Age-Adjusted | 10% | Reconciled SoH vs. the chemistry's expected-SoH-at-age curve |

`compositeScore = round((weighted sum + passport adjustment) × 10)` → 0–1000. Grade thresholds:
**A** ≥ 800 · **B** ≥ 650 · **C** ≥ 500 · **D** ≥ 350 · **F** < 350. `confidenceLevel` blends
telemetry volume (`min(1, points/12) × 0.7`) with reconciliation confidence (`× 0.3`).

### Residual value (WS-C methodology, `soh-market-v2`)

```
originalBatteryValue = vehicleValueUsd × BATTERY_VALUE_PCT[chemistry]
sohFactor            = max(0, (soh − 60) / 40)              — 1.0 at 100% SoH, 0 at 60%
marketFactor         = (1 − MARKET_DEPRECIATION_RATE[chemistry]) ^ ageYears
currentBatteryValueUsd = originalBatteryValue × sohFactor × marketFactor
```

`soh` is the **reconciled** SoH (WS-C fixed a real bug here — see below), not a re-derived proxy.
Produces a current USD estimate, a 60-month monthly forecast, and (WS-C) a
`verificationUpliftUsd` — the dollar difference between the value computed with real
verified/reconciled SoH vs. a counterfactual "no data at all" run
(`DATALESS_SOH_ASSUMPTION = 85%`), i.e. the literal dollar value of having real data.

| Chemistry | `BATTERY_VALUE_PCT` | `MARKET_DEPRECIATION_RATE` (annual) |
|---|---|---|
| LFP | 0.42 | 6% |
| NMC | 0.48 | 9% |
| NCA | 0.52 | 11% |
| LTO | 0.45 | 5% |

### LTV recommendation

`recommendedLtv` scales linearly from `LTV_MIN=40%` (composite score 350) to `LTV_MAX=85%`
(composite score 1000), then takes hard deductions: −5pp abnormal degradation, −3pp thermal
anomaly, −2pp high DCFC, −2pp deep-discharge history, plus a confidence penalty
(`(0.5 − confidence) × 10pp` when confidence < 50%). `riskPremiumBps = round((1000 − score)/100 ×
15)` — 15bps per 100-point score drop below 1000, added to a caller-supplied base rate (mock-los
uses 500bps). A loan is `flagged` for manual review whenever `riskPremiumBps > 45`.

### Second-life assessment

```mermaid
flowchart LR
    A["Reconciled SoH"] --> B{">=75% and no<br/>disqualifiers?"}
    B -->|Yes| C["EV Fleet reuse"]
    B -->|No| D{">=70%?"}
    D -->|Yes| E["Stationary grid storage"]
    D -->|No| F{">=65%?"}
    F -->|Yes| G["Stationary commercial"]
    F -->|No| H{">=60%?"}
    H -->|Yes| I["Stationary residential"]
    H -->|No| J{">=55%?"}
    J -->|Yes| K["Refurbishment / reconditioning"]
    J -->|No| L["Recycling only"]
```

Hard disqualifiers (thermal anomaly, abnormal degradation, grade F) bump a battery down from
`EV_FLEET` even if SoH alone would qualify. Remaining useful life is a simple linear
extrapolation of the chemistry's degradation rate down to a 60% SoH floor.

### Degradation forecast

Projects future SoH using the *observed* degradation rate from recent telemetry when available,
falling back to the chemistry benchmark curve otherwise; produces forecast points at 6/12/24/36/60
months plus the projected calendar dates SoH crosses 80% (typical EoL for primary use), 70%
(second-life threshold), and 60% (recycling floor).

---

## WS-A — Real degradation anchor

**Problem it solves:** before this workstream, the synthetic-generator's degradation physics and
the scoring model's `EXPECTED_SOH_BY_CHEMISTRY` expectations were two independently hand-tuned
tables that had never been checked against a real cell — a circularity landmine the build spec
flags explicitly (§1.1). WS-A is the first real anchor.

```mermaid
flowchart LR
    RAW["Raw .mat / .xlsx files<br/>(not committed, ~190MB/880MB)"] -->|"scripts/convert_*.py<br/>one-time, offline"| CSV["Checked-in CSV/JSON<br/>data/nasa-pcoe, data/calce"]
    CSV --> INGEST["ingest.ts"]
    INGEST --> SPLIT["split.ts<br/>deterministic per-cell holdout"]
    SPLIT --> FIT["fit.ts<br/>OLS: loss-rate vs. cycle, vs. ambient temp"]
    FIT --> GATE{"R2 >= 0.5<br/>per cell?"}
    GATE -->|pass| CARD["DATA_CARD.md<br/>+ holdout MAE/RMSE"]
    GATE -->|fail| EXCLUDE["excluded from fit"]
    CSV --> CROSS["cross-check.ts<br/>CALCE vs. NASA, independent"]
    CROSS --> REPORT["CROSS_CHECK.md"]
```

### Data sources — exact facts

**NASA PCoE** — B. Saha and K. Goebel (2007), "Battery Data Set," NASA Prognostics Data
Repository, NASA Ames Research Center. Downloaded from the official S3 mirror
(`phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip`), linked from NASA's own PCoE
data-set repository page. 18650 Li-ion cells, LCO/graphite chemistry, ~2Ahr rated — a cycling-aging
study: 34 cells run through repeated charge/discharge cycles at three fixed ambient chambers (4°C,
~22–24°C, 43°C) down to 20–30% capacity fade, fixed 1.5A CC/CV charge protocol (only discharge
current varied).

**CALCE CS2/CX2** — He, W., Williard, N., Osterman, M., Pecht, M. (2011), "Prognostics of
lithium-ion batteries based on Dempster-Shafer theory and the Bayesian Monte Carlo method,"
*Journal of Power Sources*, 196(23), 10314-10321. From `calce.umd.edu/battery-data` — direct
downloadable zips, confirmed **not** actually gated behind a manual request form (an earlier
assumption, repeating the build spec's own characterization, was wrong and corrected once
verified). Type 1 (0.5C) / Type 2 (1C) protocols, also LCO chemistry, 13 cells used. Ambient
temperature not documented per-cell (unlike NASA's fixed chambers), so treated as an uncontrolled
room-temperature cross-check only, not a second fit.

**Blocked** (confirmed, not just unexplored): **Sandia (SNL)** lives inside batteryarchive.org's
interactive JS data explorer — API-backed, not a scriptable static download. **Oxford** is hosted
on ora.ox.ac.uk and returns 403 to non-browser fetches.

Neither NASA nor CALCE is chemistry-matched to VoltLedger's LFP/NMC/NCA/LTO taxonomy — both are
LCO. They prove the ingest → fit → holdout → wire-in *pipeline* works against real, physically
messy, independently-sourced data; neither can chemistry-calibrate LFP/NMC/NCA on its own.

### Numbers

- NASA: 32 of 34 raw cells ingested (2 excluded — B0039, B0041 — implausible first-cycle capacity
  readings, <0.5Ahr vs. ~2Ahr rated). 2,481 discharge-cycle data points across 4/22/24/43°C.
- Split: 24 train cells / 8 holdout cells, by cell ID (not by cycle).
- Reliability gate: **R² ≥ 0.5** per-cell, applied uniformly to train and holdout.
- Fit: reference loss rate at 24°C = **22.065%/100 cycles**; thermal sensitivity =
  **−0.1200%/100cyc per °C** (R²=0.056 — loss *decreases* as ambient temp rises from 4→43°C, the
  opposite sign of every chemistry's hand-set thermal-loss assumption in the synthetic generator;
  plausibly explained by cold-charge lithium plating, since charge rate was fixed regardless of
  ambient temperature — stated as a plausible explanation, not confirmed).
- Holdout: 4 of 8 cells passed the gate; **MAE 8.321%/100cyc, RMSE 9.812%/100cyc**.
- CALCE cross-check: 13 cells, mean **4.086%/100cyc** vs. NASA's 22.065% — CALCE is **81% lower**,
  a **~5.4x gap** between the two independent LCO sources. Reported as a genuine finding (plausibly
  explained by NASA's harsher discharge protocol reaching 20-30% fade in <200 cycles vs. CALCE's
  gentler protocol taking 700-2000+ cycles), not smoothed over.
- Explicitly **not** calibratable from this data: calendar aging (cells were never rested) and
  DCFC sensitivity (charge protocol held constant throughout).

**Key files:** `packages/calibration/README.md` (full research history), `data/nasa-pcoe/DATA_CARD.md`,
`data/calce/CROSS_CHECK.md`, `src/{ingest,split,fit,calce-ingest,cross-check}.ts`,
`src/holdout-guard.test.ts` (enforces `packages/scoring` never imports this package, keeping
holdout cells out of the model it's meant to validate — verified to actually fail if violated).

---

## WS-B — Scoring validation harness

**Problem it solves:** turns WS-A's real-cell fits into a repeatable, numeric check of the scoring
model's and synthetic generator's chemistry assumptions.

**Methodology** (`packages/validation/src/compare.ts`): reuses WS-A's NASA fit and CALCE
cross-check directly (same `R² ≥ 0.5` gate, not re-implemented), and compares each gated real
cell's fitted loss rate against `CHEMISTRY_PARAMS[chem].cycleLossPctPer100Cycles` for **all three**
of LFP/NMC/NCA — deliberately run against all three "so nothing is cherry-picked," even though the
underlying cells are LCO for every comparison. RUL (remaining useful life, cycles to 80% SoH — "the
standard EV-industry end-of-life threshold") is derived identically for real cells and model as a
validation-only construct; no RUL estimator exists anywhere in `packages/scoring` itself. Three
breakdowns are produced: overall by chemistry, by temperature band (NASA only), and by source
(NASA vs. CALCE separately).

### Current numbers (`docs/validation/SOH_RUL_VALIDATION.md`, n=31 gated cells)

| Chemistry | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) |
|---|---|---|---|
| LFP | 14.62 | 18.39 | 3,692 |
| NMC | 14.12 | 17.99 | 1,692 |
| NCA | 13.92 | 17.84 | 1,359 |

By source, the ~5x NASA-vs-CALCE gap from WS-A propagates directly (e.g. NMC: NASA MAE 22.08 vs.
CALCE MAE 3.09).

### What is and isn't validated — stated explicitly in both `SOH_RUL_VALIDATION.md` and
`packages/scoring/MODEL_CARD.md`

**Validated (plausibility-checked):** the cycle-loss-rate assumption behind
`EXPECTED_SOH_BY_CHEMISTRY`, against real (if chemistry-mismatched) cells.

**Not validated, explicitly:** the composite A–F risk grade itself — *"No one publishes battery
risk grades, so there is no ground truth to score against. The grade is a transparent, auditable
rule... never a 'validated N%-accurate' number."* Also unvalidated: calendar-aging sensitivity,
DCFC sensitivity, and same-chemistry accuracy for LFP/NMC/NCA/LTO specifically (every real cell is
LCO). The MAE/RMSE figures measure *plausibility*, not same-chemistry accuracy.

---

## WS-C — Residual-value calibration + market back-test

**Problem it solves:** the RV model's constants (`BATTERY_VALUE_PCT`, `MARKET_DEPRECIATION_RATE`)
were hand-set with no external check, and the formula was silently re-deriving SoH from a lossy
proxy instead of using real reconciled data.

### The bug fix

`residual-value.ts` was computing `currentSoH = riskScore.capacityRetentionScore × 0.4 + 60` — an
inversion of `scoreCapacityRetention()`'s own clamp (`(soh − 60) / 40 × 100`), which floors at
exactly SoH=60 for any real SoH at or below that. `computeResidualValue` now takes an optional
`reconciledSoH` parameter and uses `.value` directly, removing the floor. Verified via a
regression test proving a stale/noisy proxy (implying 95% SoH) is corrected by a real, verified
70% SoH reading. Backward-compatible: when `reconciledSoH` is omitted (as in `tools/portfolio-sim`,
deliberately not wired into this by WS-C — see WS-D), behavior is byte-identical to the old formula.

### Public data-source research

Live research (not assumed from the build spec) into whether the spec's proposed calibration
sources are actually reachable:

| Source | Verdict | Detail |
|---|---|---|
| **Autovista/JD Power** (EU BEV %RV) | Scattered point figures real; bulk feed gated | The old public site (`autovista24.autovistagroup.com`) has been absorbed into JD Power — its URLs now 301-redirect to a bot-protected `jdpower.com` domain. Real, dated figures do exist in free editorial articles (confirmed via search-index snippets): a April 2026 piece cites **Austria 45.1%, Germany 40.1%, Italy 35.9%** BEV %RV at 3yr/60,000km. Systematic per-segment/chemistry data lives behind paid products (Residual Value Monitor, AutovistaVALUATION) — no public API or download. |
| **Manheim/Cox Automotive** (US wholesale index) | Genuinely public, ongoing | The aggregate Manheim Used Vehicle Value Index is published free, monthly and mid-month, with real numeric levels and %MoM/%YoY changes. As of **May 2026**, Cox Automotive began publishing a **public EV vs. non-EV index split** in the same free releases. Granular guide-value/conversion data (the MMR Valuations API, including an EV-battery-health-adjusted `evbh` parameter) is paid-API-gated via a sales conversation — no public self-serve access. |

Given the earlier USD-canonical decision, **Manheim was chosen as the primary back-test anchor**
(US, USD-native, genuinely free) with Autovista's points used only as a secondary/illustrative
EU-market sanity check — never blended into the primary back-test's figures.

Exact source data checked into `packages/rv-calibration/data/`:

```json
// data/manheim/muvvi_ev_index.json — 3 hand-curated observation points
{"period": "2026-05", "evIndexPctYoY": 11.9, "evIndexPctMoM": 3.5,
 "sourceUrl": "coxautoinc.com/insights/manheim-used-vehicle-value-index-may-2026-trends/"}
{"period": "2026-06-mid", "evIndexPctYoY": 13.7, "overallMuvviPctMoM": 2.6,
 "sourceUrl": "autobodynews.com/news/ev-wholesale-values-climb-13-7-as-manheim-index-rises-2-6-in-mid-june"}
{"period": "2026-07-mid", "evIndexPctYoY": 12.4, "evIndexPctMoM": -0.4, "overallMuvviLevel": 211.5,
 "sourceUrl": "coxautoinc.com/insights/manheim-used-vehicle-value-index-mid-july-2026-trends/"}
```

```json
// data/autovista/eu_bev_retention_points.json — 3 hand-curated points, April 2026
{"market": "Austria", "ageYears": 3, "mileageKm": 60000, "pctRetention": 45.1}
{"market": "Germany", "ageYears": 3, "mileageKm": 60000, "pctRetention": 40.1}
{"market": "Italy",   "ageYears": 3, "mileageKm": 60000, "pctRetention": 35.9}
```

No live scraper was built for either source — both were confirmed to block/gate bulk automated
access this session, so both datasets are small, hand-curated, source-cited JSON files, in the
same file-based spirit as WS-A's checked-in CSVs.

### The major finding: battery value ≠ whole-vehicle value

Running the actual numbers surfaced a real methodological mismatch. This model's `residualPct` is
**battery-value-only** retention (`sohFactor × marketFactor`), while Autovista's %RV anchor is
**whole-vehicle** retention (glider wear, mileage, brand depreciation — none of which this model
represents). Computed with today's constants, implied 3-year battery retention is:

| Chemistry | Implied battery retention @ 3yr | Autovista whole-vehicle anchor |
|---|---|---|
| LFP | 74.8% | ~36–45% |
| NMC | 62.2% | ~36–45% |
| NCA | 52.9% | ~36–45% |
| LTO | 82.5% | ~36–45% |

Closing that gap by hiking `MARKET_DEPRECIATION_RATE` alone would require roughly a **3–4x
increase per chemistry** — which would make that constant silently absorb non-battery depreciation
it was never defined to represent, corrupting a value also used by the RV forecast curves,
second-life valuation, and WS-D's portfolio-sim recovery model.

**Decision: report the gap honestly, don't force-fit.** `packages/rv-calibration/CALIBRATION_NOTE.md`
documents this; `MARKET_DEPRECIATION_RATE`/`BATTERY_VALUE_PCT` remain unchanged. Real
battery-value-only market data — a source that isolates battery value from whole-vehicle value —
would be needed to responsibly calibrate this constant. None was found to be publicly accessible.

### The back-test itself — directional, not a curve fit

Since public Manheim data has no age/chemistry axis, the back-test compares a small synthetic
cohort's modeled portfolio-value trend against the real Manheim EV Index's %MoM movement over the
same calendar window — direction and magnitude of *change*, not absolute levels:

| Release | Modeled %MoM | Real EV Index %MoM | Direction |
|---|---|---|---|
| May 2026 | — (base) | +3.5% | N/A |
| Mid-June 2026 | −0.2% | — (not reported) | N/A |
| Mid-July 2026 | −0.5% | −0.4% | **AGREE** |

`verificationUpliftUsd` (the $ value of verified vs. data-less SoH) and the recalculated
`sohSourceUsed`/`PROXY` distinction are surfaced in `/v1/batteries/:serial/residual-value`'s
response and the dashboard's battery-detail RV panel.

**Key files:** `packages/rv-calibration/{CALIBRATION_NOTE.md,README.md}`,
`data/{manheim,autovista}/DATA_CARD.md`, `src/{calibrate,backtest,run}.ts`,
`docs/validation/RV_MARKET_BACKTEST.md` (+ `.json` chart sidecar, WS-G).

---

## WS-D — Portfolio loss simulator (counterfactual)

**Problem it solves:** produces a defensible "with VoltLedger vs. without" counterfactual credit-loss
number for a synthetic loan portfolio, with a written methodology shipped alongside it — "without
it the number is unusable," per the build spec.

```mermaid
flowchart TB
    PORT["Synthetic portfolio<br/>identical borrowers, vehicles,<br/>true battery trajectories"] --> WITH
    PORT --> WITHOUT

    subgraph WITH["WITH VoltLedger arm"]
        W1["computeRiskScore() -> computeResidualValue()<br/>-> computeLtv() — real production functions"]
    end
    subgraph WITHOUT["WITHOUT VoltLedger arm"]
        WO1["Flat 70% LTV cap, flat 650bps rate<br/>— zero battery-signal visibility"]
    end

    WITH --> HAZARD["Monthly default-hazard walk<br/>(baselinePD x LTV-band x grade-multiplier) / 12<br/>grade re-evaluated monthly from TRUE condition"]
    WITHOUT --> HAZARD
    HAZARD --> RECOVERY["On default: computeResidualValue() at month of default<br/>x 80% (20% repo/liquidation discount)<br/>capped at outstanding balance"]
    RECOVERY --> DELTA["Loss delta = WITHOUT net loss - WITH net loss"]
```

### Gate D methodology (signed off 2026-08-12)

1. **WITHOUT-VoltLedger baseline**: flat 70% LTV cap, flat 650bps rate for every loan regardless
   of battery condition.
2. **WITH-VoltLedger arm**: the real production `computeRiskScore → computeResidualValue →
   computeLtv` functions from `@voltledger/scoring`.
3. **Default hazard**: `monthlyPD = (baselineAnnualPD × ltvBandMultiplier × gradeMultiplier) / 12`.
   LTV-band multiplier fixed at origination; grade multiplier **re-evaluated every month** from the
   loan's *true* simulated condition, independent of what was priced at origination — "real-world
   default risk tracks true condition, not what a lender believed." Linear apportionment, not a
   compounded/fitted survival curve. Current parameters: baseline annual PD **3.0%**; LTV-band
   multipliers `{<60%: 0.8, 60-75%: 1.0, 75-85%: 1.4, >85%: 2.0}`; grade multipliers `{A: 0.5, B:
   0.8, C: 1.2, D: 2.0, F: 3.5}`.
4. **Recovery**: on default, the *same production* `computeResidualValue` at the month of default,
   minus a 20% repossession/liquidation discount, capped at outstanding loan balance.
5. **Held constant across both arms**: identical portfolio, borrowers, vehicle values, and true
   week-by-week battery degradation trajectories — only the *origination decision* differs.
   Matched-pair RNG (`seed × 1_000_003 + loanIndex`, shared by both arms) isolates the loss delta
   to the policy difference, not to different random default-timing "luck."

### Known simplifications (stated, not hidden)

- No loan amortization — balance held flat for the loan's life (affects both arms roughly equally).
- Monthly hazard is a linear apportionment of the annual rate, not a compounded hazard curve.
- Chemistry mismatch carries forward from WS-A/B (the scoring functions used are validated only
  against LCO cells).
- **Not bit-for-bit reproducible even with a fixed seed** — the synthetic generator's sensor noise
  uses raw `Math.random()`, not the seeded RNG. Two otherwise-identical n=300/seed=42 runs produced
  loss deltas of $1,229,998 and $1,255,869 — "close, not identical." Treat repeated runs as "the
  same regime," not "the same number."

### Latest run (seed=42, n=300 loans)

- **WITH VoltLedger**: $148,943 net credit loss (18.33% default rate, 40.72% LGD)
- **WITHOUT** (flat baseline): $1,451,638 net credit loss (20.00% default rate, 84.65% LGD)
- **Loss delta: $1,302,695**
- By chemistry: NMC delta $566,740 (n=109) largest; LFP $317,802 (n=136); NCA $418,154 (n=55)
- By segment: `COMMERCIAL_DELIVERY` delta $480,441 largest; `WEEKEND_DRIVER` $78,500 smallest

**`apps/portfolio-sim-ui`** (port 3004, no auth — internal tool, reads Postgres directly):
`/` latest run, `/runs` history, `/runs/[id]` detail, `/parameters` — a client page to edit
`MethodologyParams` (baseline PD, multipliers, WITHOUT-arm terms, repo discount, loan term) and
trigger a fresh run inline. Every page carries a persistent `SIMULATED_CALIBRATED` header badge,
and (WS-G) the actual per-run `provenance` field is now also displayed on `RunSummary`.

**Key files:** `tools/portfolio-sim/{METHODOLOGY.md,src/{run,hazard,score-loan}.ts}`,
`docs/validation/PORTFOLIO_LOSS_SIMULATION.md`.

---

## WS-E — Mock LOS + decision embed

**Problem it solves:** a thin external-lender loan-origination-system harness that calls
VoltLedger's real public `/v1/*` HTTP API mid-underwriting — never `@voltledger/db` or
`@voltledger/scoring` directly, "that would defeat the point of this app, which is to validate the
real API contract" — demonstrating and testing the actual integration pattern a real lender uses.

```mermaid
sequenceDiagram
    participant U as Underwriter (mock-los UI)
    participant LOS as apps/mock-los :3003
    participant API as VoltLedger public API :3001
    participant Policy as policy.ts

    U->>LOS: Submit application (applicant, battery serial, requested terms)
    par parallel enrichment calls
        LOS->>API: GET /v1/batteries/:serial/risk
        LOS->>API: GET /v1/batteries/:serial/ltv
        LOS->>API: GET /v1/batteries/:serial/residual-value
    end
    API-->>LOS: RiskResponse, LtvResponse, ResidualValueResponse
    LOS->>Policy: apply lender policy table (score band -> LTV cap / rate premium / decision)
    Policy-->>LOS: {finalDecision: ACCEPT | REFER | DECLINE, reason}
    alt ACCEPT
        LOS->>API: POST /v1/origination/attest
        API-->>LOS: AttestResponse (frozen evidence + attestationText + provenance)
    else REFER or DECLINE
        LOS->>LOS: generateDecisionNarrative() — local only, never calls attest
    end
    LOS-->>U: Decision + narrative + full inspectable request/response trace
```

### Policy table (`data/policy.json`, user-editable via `/policy`)

| Grade | LTV cap | Rate premium | Decision |
|---|---|---|---|
| A | 85% | 0bps | ACCEPT |
| B | 80% | 15bps | ACCEPT |
| C | 70% | 45bps | REFER |
| D | 55% | 90bps | REFER |
| F | 0% | 0bps | DECLINE |

`finalLtvPct = min(voltledgerRecommendedMaxLtvPct, policyBand.ltvCapPct)` — the policy cap and
VoltLedger's own recommendation are both respected. One extra real check: even a policy-ACCEPT
grade gets downgraded to REFER if the *requested* loan amount implies an LTV exceeding
`finalLtvPct` — "what keeps this credible rather than a pass-through echo of the policy table."

### Decision narrative

For REFER/DECLINE (and any ACCEPT where the attest call unexpectedly fails), a locally-generated
narrative is built — explicitly **not** an origination attestation, carries no audit ID. Includes
applicant/battery/grade/score/confidence, requested amount and implied LTV, VoltLedger's
recommendation and rationale, residual value, the decision and reason, active risk flags, a
data-provenance line (WS-G: *"This is demonstration data; no design-partner performance claim is
being made"* when `SIMULATED_CALIBRATED`), and a timestamp. For ACCEPT with a successful attest
call, the real `attestationText` from the API is used instead.

**Pages:** `/` (lookup + submit), `/policy` (edit policy table), `/decisions` (full decision log
with preserved API traces). Runs on **port 3003**; talks to the API at `VOLTLEDGER_API_URL`
(default `http://localhost:3001`) using a real generated key.

---

## WS-F — Coverage-state simulation

**Problem it solves:** the build spec calls data-completeness "the differentiator" — *"anyone
scores a battery with perfect data; VoltLedger's value shows in the ugly cells."* The reconciliation
logic for those ugly cells (`reconcileSoH`/`computePassportAdjustment`) already worked — WS-F's job
was making the passport resolvers actually *produce* messy inputs on demand, not by hash-luck.

### Resolver architecture

```mermaid
sequenceDiagram
    participant Client
    participant API as POST /v1/passport/resolve
    participant Factory as resolvePassport()
    participant CX as CatenaXResolver
    participant GS1 as GS1Resolver
    participant OEM as DirectOemResolver
    participant AGG as AggregatorResolver
    participant Mock as MockResolver
    participant Gen as scenario-generator.ts
    participant DB

    Client->>API: {identifier, preferRestrictedTier?}
    API->>Factory: resolvePassport(identifier, options)
    Factory->>Factory: getResolver(identifier) — canHandle() chain, PASSPORT_RESOLVER env override
    alt identifier matches BPNL / urn:catena-x
        Factory->>CX: resolve(identifier)
        CX-->>Factory: not yet implemented (honest stub)
    else identifier matches GS1 Digital Link / 30PPID / GTIN
        Factory->>GS1: resolve(identifier)
        GS1-->>Factory: not yet implemented (honest stub)
    else identifier contains TESLA / BMW / RIVIAN
        Factory->>OEM: resolve(identifier)
        OEM-->>Factory: not yet implemented (honest stub)
    else AGGREGATOR_API_URL + KEY configured
        Factory->>AGG: resolve(identifier)
        AGG-->>Factory: not yet implemented (honest stub)
    else universal fallback
        Factory->>Mock: resolve(identifier, options)
        Mock->>Gen: generatePassportForScenario(identifier, 'MOCK', options)
        Note over Gen: organic seeded-random distribution,<br/>or forced CoverageScenario for demo/test
        Gen-->>Mock: PassportResolveResult
        Mock-->>Factory: PassportResolveResult
    end
    Factory-->>API: result + resolverUsed
    API->>DB: upsert BatteryPassport
    API-->>Client: {hasPassport, passportId, tierAccess, restrictedAccessStatus, ...}
```

Five resolvers implement one `PassportResolver` interface (`canHandle(identifier)`,
`resolve(identifier, options)`, `readonly framework`). Only **Mock** is live; the other four
(Catena-X, GS1, Direct-OEM, Aggregator) are honest stubs — real identifier-format detection
(`canHandle`) plus a detailed comment describing the real integration path, but no actual network
call implemented. In production, `PASSPORT_RESOLVER=catena_x|gs1|direct_oem|aggregator|mock`
forces a specific resolver; omitted, auto-detection picks the first `canHandle()` match, always
falling through to Mock.

### The `forceScenario` mechanism

A key architectural finding: **the resolver only ever controls the passport side** of a battery's
data — telemetry presence is a separate, independent fact. So "telemetry-only" vs. "passport-only"
vs. "full" aren't resolver scenarios, they're (resolver scenario) × (telemetry present or not)
combinations.

`ResolveOptions.forceScenario` deterministically forces one of seven `CoverageScenario` values,
short-circuiting the resolver's organic hash-random distribution:

| Scenario | What it produces | Mechanism |
|---|---|---|
| `NO_PASSPORT` | `resolve()` fails entirely | Skips the organic ~60%-coverage roll |
| `PUBLIC_ONLY` | Resolves, `PUBLIC` tier, no restricted fields | Skips the organic ~30%-restricted roll |
| `RESTRICTED_CONSISTENT` | Resolves, `RESTRICTED`, SoH matches the expected chemistry/age curve | Organic restricted-tier path |
| `RESTRICTED_CONFLICTING` | Resolves, `RESTRICTED`, SoH deliberately diverges from the curve by 12–20pp | Always *subtracts* from the curve (never adds — the curve is always high, ~87–99%, so adding could clip the 100% ceiling and shrink the delta below the fraud-signal threshold) |
| `TAMPERED` | Resolves, `RESTRICTED`, `passportUniqueId` doesn't contain the real serial | Reuses the **existing** `/verify` route's `passportUniqueId.includes(serial)` check as-is — zero changes to verification logic |
| `REISSUED_IDENTITY` | Resolves, `RESTRICTED`, `batteryStatusCode: 'REPURPOSED'`, `priorPassportId` set, identity chain still valid | Reuses the existing `BatteryStatusCode.REPURPOSED` value rather than inventing new identity-continuity machinery |
| `ACCESS_PENDING` | Resolves, tier is RESTRICTED-eligible but fields withheld, `restrictedAccessStatus: 'PENDING_LEGITIMATE_INTEREST'` | Spec-mandated (build spec §8: *"Restricted passport fields are shown as access-gated pending the Commission implementing act, with a working fallback that doesn't depend on the outcome"*) |

`forceScenario` is honored by **all five** resolvers (the four stubs gained one line each: `if
(options?.forceScenario) return generatePassportForScenario(...)`), but their *default* (no
scenario) behavior is untouched — still an honest failure. When no scenario is forced, the Mock
resolver's behavior is byte-identical to before WS-F (verified via a regression test), so existing
demo batteries are unaffected.

**Deliberately not exposed over the public HTTP API.** `POST /v1/passport/resolve` is reachable by
any authenticated lender API key and its output gets persisted and feeds real scoring/LTV —
letting external callers inject fabricated scenario data was judged a real (if narrow) integrity
risk. `forceScenario` only exists as an in-process capability for the coverage-matrix proof below.
Whether/how to expose it live (a demo-picker UI) was deliberately left to WS-G — and WS-G also left
it undecided; it remains open for whenever the "weave it all together" demo flow gets scoped.

### The coverage-matrix proof

`apps/api/src/lib/passport/coverage-matrix.test.ts` (11 passing assertions) + `pnpm coverage-matrix`
→ `docs/validation/COVERAGE_MATRIX.md`, which runs all 9 matrix cells — including the
access-pending/granted pair **side by side, on the same battery** (build spec §7 item 5: "model
both outcomes") — through the real resolver and `reconcileSoH`, in-process, no DB or HTTP,
narrating each precondition → verification → results run.

**Key files:** `apps/api/src/lib/passport/{scenario-generator.ts,mock.resolver.ts,
resolvers/*.resolver.ts,coverage-matrix.test.ts,run-coverage-matrix.ts}`,
`packages/types/src/passport.ts`.

---

## WS-G — Provenance & the validation surface

**Problem it solves:** build spec §1.3's transparency guardrail — *"Everything the layer surfaces
carries provenance... Strong wording is reserved for real design-partner data and never applied to
simulated portfolios"* — plus making WS-A through WS-F's evidence actually reachable from the
lender portal instead of only readable by opening the repo.

```mermaid
flowchart LR
    A["Battery.dataSource"] --> B{"dataSource == SYNTHETIC?"}
    B -->|Yes| C["SIMULATED_CALIBRATED"]
    B -->|No| D["REAL_ANCHORED"]
    E["No real-or-synthetic battery backing<br/>(no producer yet)"] -.reserved.-> F["ILLUSTRATIVE"]
    C --> G["/risk /ltv /residual-value<br/>/batteries/:serial/detail responses"]
    D --> G
    C --> H["OriginationAudit.provenance<br/>(persisted) + attestation text line"]
    D --> H
    G --> I["Dashboard ProvenanceBadge"]
    H --> I
```

### Provenance is derived, not duplicated

`tools/synthetic-generator` is the only thing that ever writes a `Battery` row today, and it always
sets `dataSource: 'SYNTHETIC'`. Rather than hand-setting a provenance field independently on four
different output models, `deriveProvenance(dataSource)` (`packages/scoring/src/provenance.ts`) is a
one-line ternary — `SYNTHETIC → SIMULATED_CALIBRATED`, everything else → `REAL_ANCHORED` — called
at the API route layer where `battery` is already loaded. `ILLUSTRATIVE` has no producer yet
(nothing creates data untethered from a real-or-synthetic battery) and is documented as reserved,
not built speculatively.

`OriginationAudit` is the one place that got an actual **persisted** field — it already had a
frozen-snapshot pattern (`evidenceSnapshot`) for exactly this purpose, and it's the real
exported/audit artifact the spec means by "any exported report." A first-draft implementation plan
covered `risk.ts`/`ltv.ts`/`residual-value.ts` but **missed that the dashboard's own battery
detail page doesn't call any of those** — it hits a separate `/detail` route in `fleet.ts`. Caught
on a second verification pass before shipping, not after.

### The Validation section (`/validation` in the dashboard)

- **Evidence document manifest** — 12 documents spanning WS-A through WS-F (data cards, model
  cards, back-test reports), each with a hand-written one-line summary (explicitly not
  auto-parsed from the markdown — stated as an accepted limitation that can drift if a doc
  regenerates with materially different numbers), rendered as full markdown via `react-markdown`
  on click.
- **Live portfolio-sim loss-delta card** — queries the latest `PortfolioSimRun` directly, links out
  to `apps/portfolio-sim-ui` (not embedded — a real cross-app link, consistent with not
  pre-emptively merging the demo apps before the user has scoped that).
- **Two charts** fed by small JSON sidecars added to the *existing* `packages/validation` and
  `packages/rv-calibration` generators (one more `writeFileSync` each, no new computation): a
  WS-B bar chart (MAE by chemistry) and a WS-C line chart comparing **rates** (`modeledPctChangeFromPrev`
  vs. `realEvIndexPctMoM` — not raw index levels against %-change fields, an apples-to-oranges
  mismatch an earlier draft of this chart almost shipped).

New `apps/api/src/routes/validation.ts` (`GET /documents`, `GET /documents/:id`, `GET
/portfolio-sim-latest`, `GET /charts/{soh-rul,rv-backtest}`) serves all of this — the manifest's
`:id` lookup is the entire path-traversal defense (a request can never drive an arbitrary
filesystem read; `id` must match a fixed, hardcoded manifest entry).

**Key files:** `packages/types/src/battery.ts` (`Provenance` type), `packages/scoring/src/provenance.ts`,
`apps/api/src/routes/validation.ts`, `apps/dashboard/src/app/(lender)/validation/page.tsx`,
`apps/dashboard/src/components/{ProvenanceBadge,SohAccuracyChart,RvBacktestChart,
EvidenceDocumentList}.tsx`.

---

## EU Battery Passport (Regulation 2023/1542)

VoltLedger models the EU's Battery Passport regulation as a two-tier data-access system:

- **`PUBLIC` tier** — always available when a passport exists: manufacturer/category/manufacturing
  date, carbon footprint + intensity class, material composition (%cobalt/lithium/nickel/manganese),
  performance specs, circularity/recycling data.
- **`RESTRICTED` tier** — "legitimate interest" parties only: `unitSoH`, `unitSoC`,
  `chargeCycleCount`, capacity, temperature history, `batteryStatusCode`
  (`GOOD|DEGRADED|FAULTY|REPURPOSED`), negative events (thermal/deep-discharge incidents).
- **`CONFIDENTIAL` tier** — defined in the type system, never produced by any resolver today.

`restrictedAccessStatus` (`GRANTED | PENDING_LEGITIMATE_INTEREST`, WS-F) distinguishes "no
restricted data exists" from "data exists, VoltLedger hasn't been granted access yet, pending the
EU Commission's implementing act" — the dashboard's `PassportPanel` shows different copy for each,
rather than one message for every "no restricted data" reason.

**Identity verification** (`POST /v1/passport/verify/:batteryId`) checks: does the passport's
unique ID contain the battery's serial; does a VIN/manufacturer match exist; is the cell→pack→
vehicle chain verifiable (restricted tier only); is the pack→vehicle chain linked via VIN. A
`confidenceScore` (0–1) weights each check, and `identityChainValid` requires the serial/VIN/model
checks to all pass — this is also what WS-F's `TAMPERED` scenario exploits (a mismatched
`passportUniqueId` fails the first check automatically, no verification-logic changes needed).

---

## API reference

All routes are prefixed as shown and registered in `apps/api/src/index.ts`. **Auth**: every route
requires `X-Api-Key` by default; `X-Service-Token` (matching `SERVICE_TOKEN`) bypasses per-lender
quota globally; `/health`, `/`, `/v1/early-access/*`, `/v1/provision/*` skip auth entirely;
`/v1/admin/*` is service-token-only; `DEV_SKIP_AUTH=true` disables auth everywhere (dev only).

### Health

| Method & path | Description |
|---|---|
| `GET /` | Service banner `{service, version, status}`. No auth. |
| `GET /health` | DB connectivity check. No auth. |

### Battery core (`/v1/batteries`)

| Method & path | Description |
|---|---|
| `GET /v1/batteries/:serial` | Battery profile + latest risk score summary. |
| `POST /v1/batteries/:serial/score` | Run the scoring engine on-demand (needs telemetry in the last 12 weeks; optionally blends passport data). |
| `GET /v1/batteries/:serial/risk` | Latest `RiskScore`: composite, grade, confidence, all sub-scores, flags, provenance. |
| `GET /v1/batteries/:serial/residual-value` | Latest RV estimate + 12/24/36/60mo forecast + verification uplift + provenance. |
| `GET /v1/batteries/:serial/ltv` | Latest LTV recommendation + pricing + `flagged` (manual-review) boolean + provenance. |
| `GET /v1/batteries/:serial/second-life` | Viability score, recommended use case, remaining life, disqualifiers. |
| `GET /v1/batteries/lookup?vin=\|id=` | Resolve a VIN/serial/CUID to a full report; enforces the lender's monthly VIN-lookup quota. |

### Fleet views (internal-dashboard-facing, `/v1/batteries/fleet/*` and `/v1/fleet/ops/*`)

| Method & path | Description |
|---|---|
| `GET /v1/batteries/fleet/stats` | Aggregate counts, grade distribution, batteries scored in the last 24h. |
| `GET /v1/batteries/fleet/batteries` | Paginated battery list, optional grade filter. |
| `GET /v1/batteries/fleet/flagged` | Batteries with abnormal degradation, thermal anomaly, or grade D/F. |
| `GET /v1/batteries/:serial/telemetry` | SoH/temp/SoC time series for the sparkline chart. |
| `GET /v1/batteries/:serial/detail` | Full detail bundle — risk, RV, LTV, second-life, forecast + provenance, all included. |
| `GET /v1/fleet/ops/stats` | Fleet-operator readiness: shift-ready/limited-range/grounded counts, SoH histogram, replacement-queue cost. |
| `GET /v1/fleet/ops/alerts` | Batteries with an active thermal/DCFC/degradation flag. |
| `GET /v1/fleet/ops/replace` | Replacement queue (already below 80% SoH, or projected within 180 days), sorted soonest-first. |
| `GET /v1/fleet/ops/second-life` | Second-life candidates sorted by value + use-case breakdown. |

### EU Battery Passport (`/v1/passport`)

| Method & path | Description |
|---|---|
| `POST /v1/passport/resolve` | Resolve + upsert a passport for a battery identifier. |
| `GET /v1/passport/battery/:serial` | Fetch a battery's passport (public + restricted tiers formatted). |
| `GET /v1/passport/:passportId` | Fetch a specific passport by ID. |
| `POST /v1/passport/verify/:batteryId` | Run identity-chain verification, upsert `PassportVerification`. |

### Origination & compliance (`/v1/origination`)

| Method & path | Description |
|---|---|
| `POST /v1/origination/attest` | Create a frozen, evidence-locked `OriginationAudit` at loan-decision time. |
| `GET /v1/origination/:id` | Retrieve one audit record. |
| `GET /v1/origination/battery/:serial` | List all audits for a battery, newest first. |

### Evidence & validation (`/v1/validation`, WS-G)

| Method & path | Description |
|---|---|
| `GET /v1/validation/documents` | Manifest of hand-curated evidence documents (WS-A through WS-F). |
| `GET /v1/validation/documents/:id` | One document's raw markdown content. |
| `GET /v1/validation/portfolio-sim-latest` | Latest `PortfolioSimRun` + `portfolio-sim-ui` URL. |
| `GET /v1/validation/charts/soh-rul` | WS-B accuracy-by-chemistry chart data. |
| `GET /v1/validation/charts/rv-backtest` | WS-C modeled-vs-real back-test chart data. |

### Account, billing & tenancy

| Method & path | Description |
|---|---|
| `GET /v1/account` | Resolve the current lender account (via `x-clerk-user-id`). |
| `POST /v1/account/sync` | Update Stripe/subscription state (called by the Stripe webhook handler). |
| `GET /v1/account/by-subscription/:subId` | Look up a `Lender` by Stripe subscription ID. |
| `POST /v1/early-access` | Public signup-request form (honeypot-protected, no auth). |
| `POST /v1/provision` | Called by the Clerk webhook on new sign-up — provisions `Organization → Lender → LenderUser → ApiKey` transactionally. No auth (self-enforces service-token in-file). |
| `GET /v1/admin/early-access` | List early-access requests. Service-token only. |
| `POST /v1/admin/early-access/:id/approve` \| `/reject` | Approve/reject a request, sends email. Service-token only. |

---

## Actions & use cases

Who does what, end to end:

| Actor | Action | Path |
|---|---|---|
| **Prospective lender** | Requests platform access | Marketing site → `POST /v1/early-access` (honeypot-protected) |
| **VoltLedger admin** | Approves/rejects a request | Dashboard `/admin/requests` → `POST /v1/admin/early-access/:id/{approve,reject}` → email sent |
| **New lender user** | Signs up, gets provisioned | Clerk sign-up → webhook → `POST /v1/provision` → `Organization/Lender/LenderUser/ApiKey` created transactionally, key emailed once |
| **Lender analyst** | Reviews fleet risk | Dashboard `/`, `/fleet`, `/flagged` |
| **Lender analyst** | Inspects one battery | Dashboard `/battery/[serial]` — score, RV, LTV, second-life, provenance badge |
| **Lender diligence team** | Verifies VoltLedger's claims | Dashboard `/validation` — evidence docs, charts, live loss-delta |
| **Fleet operator** | Monitors fleet readiness | Dashboard `/fleet-ops`, `/fleet-ops/alerts`, `/fleet-ops/replace`, `/fleet-ops/second-life` |
| **External LOS / integrator** | Underwrites a loan against the real API | `apps/mock-los` — lookup → risk/ltv/residual-value → policy → attest (see WS-E sequence) |
| **Loan officer** | Freezes evidence at origination | `POST /v1/origination/attest` — compliance-grade snapshot, never mutates after creation |
| **Data/quant team** | Re-runs the counterfactual loss model | `pnpm portfolio-sim` or `apps/portfolio-sim-ui` `/parameters` |
| **VoltLedger engineering** | Re-validates the scoring model against real cells | `pnpm calibrate && pnpm validate` |
| **VoltLedger engineering** | Re-runs the RV market back-test | `pnpm rv-calibrate` |
| **VoltLedger engineering** | Proves every data-completeness scenario still works | `pnpm coverage-matrix` |
| **Ingestion pipeline** | Real/streamed telemetry → automatic re-score | `apps/ingestion` BullMQ workers (telemetry → scoring, debounced per battery) |
| **Bulk operator** | Scores every battery missing a score | `pnpm bulk-score` (concurrency 5) |

---

## Subscription tiers

| Plan | Battery quota | VIN lookups | Price |
|---|---|---|---|
| Starter | 100/month | 25/month | Trial |
| Professional | 500/month | Unlimited | $799/month |
| Enterprise | Unlimited | Unlimited | Contact sales |

Enforced at the API layer (`lookup.ts` increments `vinLookupsUsedThisMonth`; quota checks are
skipped for service-token calls). Stripe webhooks (`api/webhooks/stripe/route.ts`) keep
`Lender.tier`/`subscriptionStatus`/quotas in sync automatically.

---

## Local development

### Prerequisites

- Node.js 20+, pnpm 9+, Docker + Docker Compose

### Setup

```bash
pnpm install
cp .env.example .env                # fill in required values — see below

pnpm infra:up                       # Postgres 16 (:5433) + Redis 7 (:6379)
pnpm db:migrate                     # apply migrations
pnpm db:seed                        # battery models + demo lender

pnpm generate:synthetic:seed        # 50 batteries, 5 years of telemetry (SYNTHETIC dataSource)
pnpm bulk-score                     # score every battery just seeded

pnpm dev                            # turbo run dev — all apps in parallel
```

Services:

| App | URL | Auth |
|---|---|---|
| API | http://localhost:3001 | `X-Api-Key` (or `DEV_SKIP_AUTH=true`) |
| Dashboard | http://localhost:3002 | Clerk (no local bypass — real credentials needed) |
| Mock LOS | http://localhost:3003 | `VOLTLEDGER_API_KEY` (generate via `pnpm generate-key`) |
| Portfolio Sim UI | http://localhost:3004 | none (internal tool, direct DB read) |

### Evidence Layer regeneration commands

```bash
pnpm calibrate         # WS-A: re-fit against NASA/CALCE real cells
pnpm validate           # WS-B: re-run the scoring validation harness
pnpm rv-calibrate       # WS-C: re-run the RV market back-test
pnpm portfolio-sim      # WS-D: re-run the counterfactual loss simulation
pnpm coverage-matrix    # WS-F: re-prove all 9 data-completeness scenarios
```

Each writes its evidence doc(s) to `docs/validation/` or its own package directory — see the
[per-workstream sections](#the-evidence-layer) above for exactly what each produces.

---

## Environment variables

### Root `.env` (shared)

```env
DATABASE_URL="postgresql://voltledger:voltledger@localhost:5433/voltledger?schema=public"
REDIS_URL="redis://localhost:6379"

API_PORT=3001
DEV_SKIP_AUTH=true              # set false in production

VOLTLEDGER_API_URL="http://localhost:3001"    # mock-los -> API
VOLTLEDGER_API_KEY=""                          # from: pnpm generate-key --lender "Demo LOS" --label mock-los --env test
```

### API service (`apps/api`)

```env
PORT=3001
CORS_ORIGIN=                    # dashboard URL
SERVICE_TOKEN=                  # shared secret for dashboard/internal-tool -> API calls
PASSPORT_RESOLVER=              # optional: catena_x|gs1|direct_oem|aggregator|mock — forces a resolver
AGGREGATOR_API_URL=              # optional, enables the Aggregator resolver's canHandle()
AGGREGATOR_API_KEY=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_NOTIFY=                   # admin inbox for early-access notifications
LOG_LEVEL=info
NODE_ENV=development
```

### Dashboard service (`apps/dashboard`)

```env
NEXT_PUBLIC_APP_URL=
INTERNAL_API_URL=               # API base URL, server-to-server
SERVICE_TOKEN=                  # must match the API's value
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
ADMIN_CLERK_USER_ID=            # Clerk user ID granted admin access
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PROFESSIONAL=
NEXT_TELEMETRY_DISABLED=1
```

### Ingestion service (`apps/ingestion`)

```env
INGESTION_CONCURRENCY=5         # telemetry worker
SCORING_CONCURRENCY=2           # scoring worker
```

> The root `.env.example` is intentionally minimal (6 vars) — dashboard/ingestion-specific vars
> above have no example file yet and must be set manually per the tables above.

---

## Deployment

### Current: Railway

```mermaid
graph TB
    subgraph Railway Project
        APISVC["API service<br/>apps/api/Dockerfile<br/>node:20-slim, 2-stage"]
        DASHSVC["Dashboard service<br/>apps/dashboard/Dockerfile<br/>node:20-slim, 2-stage, next build"]
        LOSSVC["Mock LOS service (optional)<br/>apps/mock-los/Dockerfile<br/>no DB access, demo/sales asset"]
        PGPLUGIN[("Railway Postgres plugin")]
        REDISPLUGIN[("Railway Redis plugin")]
    end

    APISVC --> PGPLUGIN
    APISVC --> REDISPLUGIN
    DASHSVC -->|SERVICE_TOKEN| APISVC
    LOSSVC -->|API key, external pattern| APISVC
```

`railway.toml` documents (rather than fully automates) a 3-service manual setup:

| Service | Dockerfile | Notes |
|---|---|---|
| API | `apps/api/Dockerfile` | Build context `/`. `CMD` runs `prisma migrate deploy` (continues on warning) then starts the server. |
| Dashboard | `apps/dashboard/Dockerfile` | Runs `next build` in the builder stage; `next start -p ${PORT:-3000}` at runtime — note the production default port (3000) differs from local dev (3002). |
| Mock LOS | `apps/mock-los/Dockerfile` | No `openssl`/Prisma in this image — it never touches the DB, only the public API. |

**Gaps as of today**: no Dockerfile or Railway service exists yet for `apps/ingestion` (the BullMQ
telemetry pipeline — real-time ingestion isn't deployed anywhere yet, only runnable locally) or
`apps/portfolio-sim-ui` (an internal tool with no auth of its own — deliberately not exposed
publicly without first adding access control).

### Production stack options

Railway is a reasonable choice through early-stage/pilot scale (simple, Docker-native, managed
Postgres/Redis plugins, fast to iterate). As real lender traffic and compliance requirements grow,
here's how the same architecture maps onto other stacks:

```mermaid
graph TB
    subgraph "Target production architecture (any of the stacks below)"
        CDN["CDN / Edge<br/>(CloudFront, Cloudflare, or platform-native)"]
        LB["Load Balancer / API Gateway"]
        APIN["API — N replicas<br/>autoscaled"]
        DASHN["Dashboard — N replicas<br/>or edge-rendered"]
        WORKN["Ingestion workers — N replicas<br/>autoscaled on queue depth"]
        PGHA[("Postgres<br/>managed, HA, read replica")]
        REDISHA[("Redis<br/>managed, HA")]
        SECRETS["Secrets manager<br/>(not env files in prod)"]
        OBS["Observability<br/>logs + metrics + traces + alerting"]
    end

    CDN --> LB --> APIN
    CDN --> DASHN
    APIN --> PGHA
    APIN --> REDISHA
    WORKN --> REDISHA
    WORKN --> PGHA
    APIN -.-> SECRETS
    DASHN -.-> SECRETS
    WORKN -.-> SECRETS
    APIN -.-> OBS
    DASHN -.-> OBS
    WORKN -.-> OBS
```

| Option | API + workers | Frontends (dashboard/mock-los/portfolio-sim-ui) | Postgres | Redis | When it fits |
|---|---|---|---|---|---|
| **A. Railway (current)** | Docker service | Docker service (Next.js `next start`) | Railway plugin | Railway plugin | Pilot/early-stage; simplicity and speed over fine-grained control. Current setup, already working. |
| **B. Fly.io + managed DB** | Fly Machines (Docker, auto-scale-to-zero) | Fly Machines or Vercel | Neon or Supabase (serverless Postgres, branching) | Upstash (serverless Redis) | Cost-sensitive scale-up; want serverless Postgres branching for preview environments; still simple ops. |
| **C. Vercel + separate API host** | Render / Fly.io (Vercel doesn't suit long-running Fastify + BullMQ workers well) | Vercel (native Next.js hosting, ISR/edge) | Neon / Supabase / RDS | Upstash | Frontend-heavy iteration speed matters most; API/workers hosted separately since Vercel's serverless functions don't fit long-lived BullMQ workers. |
| **D. AWS (ECS Fargate)** | ECS Fargate services behind an ALB, autoscaled on CPU/queue depth | ECS Fargate or Amplify Hosting | RDS Postgres (Multi-AZ + read replica) | ElastiCache Redis | Regulated/enterprise lender customers who require AWS, VPC isolation, fine-grained IAM, and audit trails (CloudTrail) as part of due diligence. |
| **E. GCP (Cloud Run)** | Cloud Run services (scale-to-zero or min-instances), Cloud Tasks/Pub-Sub instead of BullMQ if going fully managed | Cloud Run or Firebase Hosting | Cloud SQL Postgres (HA) | Memorystore Redis | Similar profile to D but GCP-native; Cloud Run's per-request billing suits bursty lender traffic well. |
| **F. Kubernetes (EKS/GKE/self-managed)** | Deployments + HPA, KEDA for queue-depth-based worker autoscaling | Deployments behind an Ingress | Any managed Postgres, or a StatefulSet with an operator (e.g. CloudNativePG) | Redis Operator or managed | Multiple products/teams sharing infra, need for custom autoscaling policies, or an existing platform team already running k8s. Highest operational overhead — only worth it past a certain org size. |

**What changes regardless of which option is picked**, moving beyond the current Railway setup:

1. **Secrets management** — `SERVICE_TOKEN`, `STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`,
   `DATABASE_URL`, etc. move from plain env vars into a secrets manager (AWS Secrets Manager, GCP
   Secret Manager, Doppler, or Railway's own encrypted variables at minimum) with rotation policy.
2. **Observability** — none of the apps currently ship structured logging/tracing beyond Fastify's
   default logger and `console.log`. Adding a real APM (Datadog, Honeycomb, Grafana
   Cloud/Loki+Tempo, or a platform-native option) becomes important once real lender SLAs exist.
3. **Ingestion deployment** — `apps/ingestion` has no Dockerfile or hosting config yet; it needs
   one before real-time OEM/telematics telemetry can flow in production (today it's local-only).
4. **Database migrations in CI/CD** — `prisma migrate deploy` currently runs inside the API
   container's `CMD` at every deploy; for HA, this should move to a separate migration step/job
   that runs once before the new API revision receives traffic, not on every replica's boot.
5. **`portfolio-sim-ui` access control** — it has zero auth today (internal-tool assumption); if
   it's ever deployed publicly, it needs at minimum the same Clerk gate the dashboard has, since it
   currently reads the database directly with no query scoping.
6. **Backups & DR** — automated Postgres backups + point-in-time recovery (every managed-Postgres
   option above supports this natively) and a documented RPO/RTO once real lender data exists.

---

## Known limitations & honesty notes

Carried forward from the Evidence Layer's own stated positioning (build spec §8, "what this
explicitly does NOT claim") — collected here so they're not scattered only across individual
workstream docs:

- **No accuracy figure is derived from self-generated data.** WS-B's MAE/RMSE numbers are measured
  against real NASA/CALCE cells the scoring model never trained on (WS-A's holdout guard enforces
  this at the package-dependency level, not just by convention).
- **The composite risk grade is a transparent rule, not an externally validated prediction.** No
  one publishes battery risk grades, so there is no ground truth to score the grade *itself*
  against — only the underlying SoH/degradation assumptions are checked.
- **Simulated portfolios never carry real-lender-outcome language.** WS-D's numbers are always
  labeled `SIMULATED_CALIBRATED`; WS-G's provenance system enforces this is visible everywhere the
  numbers are displayed, not just in the methodology doc.
- **VoltLedger provides a verified signal and audit trail; the lender sets policy and owns the
  credit decision.** Nothing implies VoltLedger assumes a manufacturer's Reg 2023/1542 compliance
  obligations (see the disclaimer line baked into every `attestationText`).
- **Restricted passport fields are access-gated, not silently absent**, pending the EU
  Commission's implementing act on legitimate-interest access — with a working telemetry-only
  fallback that never blocks scoring while access is pending (WS-F).
- **A handful of pre-existing, documented gaps, not fixed as part of any workstream** (deliberately
  out of scope, noted so they aren't lost): `tools/bulk-score` and the ingestion scoring worker
  don't pass passport context into scoring, so passport-backed batteries mostly reach
  `sohSource: TELEMETRY` rather than `PASSPORT`/`BLENDED` in bulk/automated paths; `vehicleValueUsd`
  is a hardcoded `$35,000` fallback in both; `apps/ingestion`'s startup log comment ("Scoring
  worker stub — Phase 3 placeholder") is stale — the scoring worker is fully wired to the real
  intelligence engine, not a stub.

---

## Appendix — full script reference

```bash
# Monorepo
pnpm dev                    # turbo run dev — all apps
pnpm build                  # turbo run build
pnpm lint                   # turbo run lint
pnpm typecheck              # turbo run typecheck
pnpm test                   # turbo run test

# Database
pnpm db:generate            # prisma generate
pnpm db:migrate             # prisma migrate dev
pnpm db:migrate:deploy      # prisma migrate deploy (production)
pnpm db:migrate:reset       # prisma migrate reset (destructive, dev only)
pnpm db:seed                # battery models + demo lender
pnpm db:studio              # Prisma Studio

# Infra
pnpm infra:up               # Postgres + Redis (+ pgAdmin via --profile tools)
pnpm infra:down

# Data generation
pnpm generate:synthetic             # full CLI, all flags available
pnpm generate:synthetic:small       # 10 batteries, 52 weeks
pnpm generate:synthetic:fleet       # 100 batteries, 260 weeks
pnpm generate:synthetic:seed        # 50 batteries, 260 weeks, writes to DB

# Scoring
pnpm bulk-score              # score every battery missing a RiskScore (concurrency 5)

# Evidence Layer
pnpm calibrate                # WS-A
pnpm validate                 # WS-B
pnpm rv-calibrate             # WS-C
pnpm portfolio-sim             # WS-D
pnpm coverage-matrix          # WS-F

# Apps (individual dev servers)
pnpm api:dev                  # :3001
pnpm dashboard:dev            # :3002
pnpm mock-los:dev              # :3003
pnpm portfolio-sim-ui:dev      # :3004
pnpm ingestion:dev             # BullMQ workers
pnpm ingestion:load            # load NDJSON telemetry stream into the queue

# Ops tools
pnpm generate-key --lender "Name" --label "Label" --env test|live
```

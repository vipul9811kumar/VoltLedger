# VoltLedger — Build Spec: The Evidence Layer (v1)

**Purpose:** Move VoltLedger from *"the mechanism exists"* to *"the evidence exists"* for the six
valuation-inflection levers, using anchored synthetic data and simulated connectors, without
overclaiming. Bound to the current repo (`vipul9811kumar/VoltLedger`, pnpm/turbo monorepo).

**Author's one-line thesis:** The platform already computes risk, RV, LTV, second-life, passport
reconciliation, identity verification, and origination attestation. It cannot yet *prove* any of
those are accurate, that RV tracks real markets, that the signal reduces losses, or that a lender
changes pricing because of it. This spec builds that proof layer — and fixes one circularity
landmine already in the code.

---

## 0. The reframe

The valuation document lists six levers that separate a ~$1–2M product from ~$10M+ embedded
infrastructure:

1. Demonstrable scoring accuracy
2. Historical battery degradation dataset
3. Residual-value predictions validated against actual auction/market outcomes
4. Demonstrated reduction in credit/collateral losses
5. API embedded in ≥1 LOS/underwriting workflow
6. Evidence that lenders actually change LTV/pricing because of VoltLedger

**Current status against those levers:**

| Lever | Mechanism in repo? | Evidence in repo? | Status |
|---|---|---|---|
| 1. Scoring accuracy | `packages/scoring/src/risk.ts` (5 sub-scores → 0–1000 → A–F) | No held-out test, no ground truth, no calibration curve | **Mechanism only** |
| 2. Degradation dataset | `tools/synthetic-generator` (physics-inspired) | Params hand-set, not fit to public data; no real anchor set | **Partial** |
| 3. RV vs. market | `packages/scoring/src/residual-value.ts` | Formula in **USD**, uncalibrated to any EU benchmark, no back-test | **Partial** |
| 4. Loss reduction | `Loan` model has `status`/`ltvAtOrigination` | No default simulation, no realized-recovery model, no counterfactual | **Missing** |
| 5. LOS embed | `/v1/*` API + `/v1/origination/attest` flow | No decision-engine harness calling the API mid-underwriting | **Missing** |
| 6. LTV/pricing change | `packages/scoring/src/ltv.ts` (flexes on score/confidence/flags) | No before/after instrumentation, no portfolio pricing view | **Partial** |

**Conclusion:** this is not a greenfield build. It is *extend + validate + instrument*. Roughly
70% of the plumbing exists; ~0% of the defensible evidence does.

---

## 1. The integrity spine (non-negotiable, read before building anything)

Every number this layer produces must survive a hostile CRO or technical acquirer. Three rules
govern the whole spec.

### 1.1 The circularity landmine (fix first)

The synthetic generator's degradation physics and the scorer's expectations **encode the same
beliefs**:

- Generator: `tools/synthetic-generator/src/models.ts` → `ChemistryParams`
  (`calendarLossPctPerYear`, `cycleLossPctPer100Cycles`, `dcfcSensitivity`, …) consumed by
  `degradation.ts:computeSoH()`.
- Scorer: `packages/scoring/src/constants.ts` → `EXPECTED_SOH_BY_CHEMISTRY` consumed by
  `risk.ts:expectedSoH()` and `residual-value.ts:expectedSoHAtYear()`.

If you generate batteries with these params and then "validate" the scorer against that output,
you have proven only that your assumptions agree with themselves. **Any accuracy claim built this
way is worthless and is a due-diligence killer.**

**Rule:** the data-generating process (DGP) and the model-under-test must be *independent*, and the
DGP must be *anchored to real public data* — never the other way round.

### 1.2 What can and cannot be "validated"

An honest distinction that must run through the whole demo:

- **Validatable against external truth:** SoH estimation error and remaining-useful-life (RUL)
  prediction error — because real cells in public datasets have *measured* capacity fade. Also RV
  error — because real EU market curves exist.
- **Not externally validatable:** the composite A–F "risk grade" itself. No one publishes battery
  risk grades, so there is no ground truth to score against. The grade is a transparent, auditable
  *rule*, and must be presented as such — never as a "validated 94%-accurate" number.

So the accuracy story is: **validate the inputs (SoH/RUL vs. real cells; RV vs. real market);
present the composite as a documented, reproducible policy.** This framing is *stronger* with
sophisticated buyers than a black-box accuracy figure.

### 1.3 Transparency labelling

Everything the layer surfaces carries provenance: `REAL_ANCHORED`, `SIMULATED_CALIBRATED`, or
`ILLUSTRATIVE`. The dashboard, the attestation text, and every exported report state which. Strong
wording ("demonstrated loss reduction at Lender X") is reserved for real design-partner data and is
never applied to simulated portfolios. Positioning discipline holds throughout: VoltLedger
*verifies and provides a signal*; the lender sets policy and makes the decision. Nothing implies
VoltLedger assumes a manufacturer's Reg 2023/1542 obligations.

---

## 2. Real-data anchors (the calibration set)

These ground the synthetic DGP and provide the held-out test cells. All are public.

- **Cell degradation physics / SoH ground truth:** NASA PCoE, CALCE, Sandia (SNL), Oxford, HNEI,
  and the larger Toyota/Argonne sets — aggregated at `batteryarchive.org`. Cover NMC, NCA, LFP, LCO
  under varied temperature and charge/discharge regimes.
- **EU residual-value ground truth:** Autovista (J.D. Power) BEV RV index and curves — real anchor
  points include 3-year-old BEVs at 60,000 km retaining ~36–45% of list price across major EU
  markets. Manheim Europe auction guide values and first-time conversion rates give realized-sale
  behaviour for the recovery model.
- **Value-of-verification anchor (for the RV-uplift narrative):** the TÜV Rheinland / Autovista /
  TWAICE finding that verified battery-health data adds ~2.4% (~€450) to the lower bound of
  otherwise-data-less used-EV value — ~€4.5M per 10,000 transactions.

> Demo-time stance: **calibrate to public benchmarks now**; live Autovista/Manheim feed licensing is
> a production decision, not a demo blocker. Model the integration path; don't gate on the contract.

---

## 3. The scenario matrix (deep + wide)

The demo must demonstrably span this matrix, not three happy paths. Each axis already has a home in
the schema/generator; the job is to enumerate and guarantee coverage.

| Axis | Values | Binds to |
|---|---|---|
| Chemistry | LFP, NMC, NCA (add LTO stretch) | `Chemistry` enum; `BATTERY_MODELS` |
| Use segment | private, corporate/lease, rental, last-mile van, ride-hail/taxi | `UsageProfile`; `vehicleSegment` |
| Age/mileage band | new-lease, ~1yr, **3yr/60k km** (RV benchmark point), 5yr+ | `manufacturedAt`; `computeOdometer` |
| Stress pattern | DCFC-heavy, hot/cold climate, high-DoD cycling | `dcfcRatio`, `tempBias`, `avgDailyDepthOfDischarge` |
| Loan type | new-EV, used-EV, residual/lease, fleet portfolio, refinance, **repurposed/second-life** | `Loan`; `SecondLifeAssessment` |
| **Data completeness** | full passport+telemetry; passport-only; telemetry-only; **neither** (2027 forward-only); conflicting; tampered | `reconcileSoH` sources; resolver factory |

The **data-completeness axis is the differentiator** — anyone scores a battery with perfect data.
VoltLedger's value shows in the ugly cells: telemetry-only → bounded SoH with wide confidence →
wider LTV band; conflicting passport vs. telemetry (|Δ|>8pp) → fraud flag + confidence cut (this
logic already exists in `reconcileSoH`/`computePassportAdjustment`).

**Precondition → Verification → Results spine** (already implemented as passport
resolve→verify→score→attest; this spec instruments it and extends `Results`):

- **Precondition:** available passport fields per tier, telemetry availability, requested loan
  terms, data-quality flags, coverage state.
- **Verification:** identity-chain checks (serial↔VIN↔model↔pack), SoH reconciliation + confidence,
  discrepancy/tamper detection, evidence capture. *(Exists.)*
- **Results:** risk grade + confidence, RV forecast, LTV band + premium, second-life, audit
  package — **plus two new artifacts this spec adds: the portfolio loss delta and the LTV/pricing
  decision delta.**

---

## 4. Workstreams

Each: objective · what exists · what to build · where it binds · acceptance criteria · gate.

### WS-A — Real degradation anchor + DGP calibration
**Lever 2. Fixes §1.1.**

- **Exists:** `tools/synthetic-generator` with physics-inspired `computeSoH` (cites Attia/Dubarry/
  Waldmann) but hand-set `ChemistryParams`.
- **Build:** a new `tools/degradation-anchor/` (or `packages/calibration/`) that (a) ingests the
  public datasets in §2 into a normalized `capacity-fade` table keyed by chemistry/temp/C-rate; (b)
  **fits** `ChemistryParams` to that data (least-squares on calendar/cycle/thermal terms) and emits
  a versioned `chemistry-params.calibrated.json` with a **data card** documenting source datasets,
  fit residuals, and coverage; (c) **splits** the real cells into `train` (for fitting) and
  `holdout` (never seen by fitting or scoring — reserved for WS-B).
- **Binds:** feeds `synthetic-generator/models.ts`; holdout consumed by WS-B.
- **Acceptance:** generator params carry provenance; holdout set exists and is access-controlled in
  code (a lint/test fails if scoring imports it).
- **Gate A:** which datasets are in-scope for v1 (recommend NASA + CALCE + Sandia + Oxford; add
  HNEI/Toyota if time).

### WS-B — Scoring validation & accuracy harness
**Lever 1.**

- **Exists:** `risk.ts` composite; `confidenceLevel` computed but not calibrated.
- **Build:** `packages/validation/` (or `tools/backtest/`) that:
  - runs the SoH/RUL estimators against the **WS-A holdout real cells** and reports MAE/RMSE for SoH
    and RUL, plus error bars by chemistry and age band;
  - produces a **calibration plot** (predicted confidence vs. realized error) so `confidenceLevel`
    means something;
  - emits a **model card** (`packages/scoring/MODEL_CARD.md`) stating inputs, weights
    (`SUB_SCORE_WEIGHTS`), thresholds (`GRADE_THRESHOLDS`), known limits, and the honest §1.2
    distinction (grade = rule, inputs = validated).
- **Binds:** reads `packages/scoring`; writes reports to `docs/validation/`.
- **Acceptance:** a single `pnpm validate` produces SoH/RUL error tables on real holdout + a
  calibration curve; no synthetic data appears in any accuracy figure.
- **Gate B:** target error thresholds that count as "good enough to show" (e.g. SoH MAE ≤ X% on
  holdout).

### WS-C — Residual-value calibration + market back-test
**Lever 3.**

- **Exists:** `residual-value.ts` — `vehicleValue × batteryValuePct × sohFactor × marketDep^age`,
  in **USD**, with hand-set `BATTERY_VALUE_PCT` / `MARKET_DEPRECIATION_RATE`; uses
  `capacityRetentionScore` as a lossy SoH proxy.
- **Build:**
  - convert to **EUR** and EU market framing (target buyers are EU lenders);
  - calibrate `MARKET_DEPRECIATION_RATE` and `BATTERY_VALUE_PCT` to Autovista BEV RV curves (anchor:
    ~36–45% list retention at 3yr/60k km) per segment/chemistry;
  - **replace the score→SoH round-trip** with reconciled SoH directly (use `ReconciledSoH.value`);
  - add a **back-test**: model RV vs. real RV index across age bands → report error; add a
    realized-recovery model calibrated to Manheim conversion/guide-value behaviour (feeds WS-D);
  - surface the **verification-uplift** number (the ~€450 / 2.4% anchor) as an explicit line item:
    "value of verified vs. data-less."
- **Binds:** `packages/scoring/src/residual-value.ts`, `constants.ts`; new `RvBenchmark` reference
  table (see §5).
- **Acceptance:** RV outputs in EUR; back-test error table vs. real index in `docs/validation/`;
  uplift line item visible in dashboard RV panel.
- **Gate C:** confirm EUR + EU-market pivot (this touches pricing copy and the marketing site,
  currently USD).

### WS-D — Portfolio loss simulator (counterfactual)
**Lever 4. Highest value, most methodology-sensitive.**

- **Exists:** `Loan` model (`status`: ACTIVE/PAID_OFF/DEFAULTED/RESTRUCTURED, `ltvAtOrigination`,
  `interestRatePct`); origination attest freezes evidence.
- **Build:** `tools/portfolio-sim/` that:
  - takes a generated portfolio (matrix-spanning) and simulates loan lifecycles: default hazard as a
    function of borrower/segment factors **plus true battery condition**, and **realized collateral
    recovery** from the WS-C recovery model at the time of default/repossession;
  - runs the **counterfactual**: identical portfolio, identical borrower factors and underwriting
    policy, the *only* difference being whether the VoltLedger signal informs LTV/pricing/accept —
    "with" vs. "without";
  - reports the **loss delta** (net credit loss, loss-given-default, collateral shortfall) with
    cohort breakdowns (fleet vs. private, LFP vs. NMC, thin-data vs. full-data);
  - holds a strict provenance flag: results are `SIMULATED_CALIBRATED`, never presented as a real
    lender outcome.
- **Binds:** `Loan`, `OriginationAudit`; new `PortfolioSimRun` + `SimLoanOutcome` tables (§5).
- **Acceptance:** one command produces a with/without loss-delta report + cohort table; a written
  **methodology note** (matched cohorts, what's held constant) ships alongside — without it the
  number is unusable.
- **Gate D:** sign-off on the counterfactual design *before* generating any number (default-hazard
  spec, recovery model, what is held constant).

### WS-E — Mock LOS + decision-engine embed
**Lever 5 (+ carries 6).**

- **Exists:** full `/v1/*` API incl. `/v1/risk`, `/v1/ltv`, `/v1/residual-value`,
  `/v1/origination/attest`; `X-Api-Key` auth; rate limiting.
- **Build:** `apps/mock-los/` — a thin, credible loan-origination harness that mimics the real
  pattern (modern LOS platforms run a decision engine that calls third-party enrichment APIs
  mid-underwriting and logs to an audit trail). It:
  - takes an application (applicant + battery serial + requested terms);
  - mid-flow, calls VoltLedger `/v1/risk` + `/v1/ltv` + `/v1/residual-value` as the "collateral-risk"
    enrichment step;
  - applies a **visible, editable lender policy table** mapping score band → LTV cap / rate premium /
    accept-refer-decline;
  - writes a decision log and calls `/v1/origination/attest` on approve.
- **Binds:** consumes the public API exactly as an external lender would (validates the real API
  contract, not a bespoke one).
- **Acceptance:** clickable end-to-end: application → VoltLedger call → policy applied → decision +
  attestation; the API request/response is inspectable.
- **Gate E:** none blocking; decide whether to also ship a reference OpenAPI "integration guide" for
  design partners (recommended — it's a sales asset).

### WS-F — Connector + coverage-state simulation
**Powers the verification/data-completeness axis.**

- **Exists:** resolver factory with `mock.resolver.ts` live; Catena-X / GS1 / Direct-OEM /
  Aggregator **stubbed**; tiered access model (Public / Restricted / Confidential) implemented.
- **Build:** make the stubs return *realistic partial/tiered/conflicting* payloads driven by the
  matrix — passport-only, telemetry-only, **no passport (2027 forward-only)**, conflicting SoH,
  reissued passport (repurposed-battery identity continuity). Keep the legitimate-interest gate
  explicit: restricted fields (`unitSoH`, cycle count, temp history) carry an "access pending
  Commission implementing act" state, with the telemetry-only fallback path always available so the
  product never *depends* on an unresolved ruling.
- **Binds:** `apps/api/src/lib/passport/resolvers/*`, `PassportTier`, `DataExchangeFramework`.
- **Acceptance:** every data-completeness cell in §3 produces a coherent precondition→results run,
  including the "no passport / telemetry-only / wide band" case.
- **Gate F:** ties to the standing **legitimate-interest access** open decision — model both
  outcomes (granted / not granted) rather than betting on one.

### WS-G — Evidence, provenance & the demo surface (cross-cutting)
**Serves levers 1–6 and §1.3.**

- **Build:** a provenance tag (`REAL_ANCHORED | SIMULATED_CALIBRATED | ILLUSTRATIVE`) threaded
  through scoring outputs, RV, LTV, attestation text, and any exported report; a **"Validation"
  section in the dashboard** that renders the WS-B/WS-C plots and the WS-D loss delta; data/model
  cards linked from the UI. This is what converts a working demo into a **due-diligence-ready
  evidence package**.
- **Acceptance:** nothing simulated is displayable without its provenance tag; validation artifacts
  are reachable from the lender portal.

---

## 5. Data-model deltas (Prisma)

New models (names indicative; all `SIMULATED_CALIBRATED`-aware):

- `CalibrationSet` — a versioned real-data anchor (source datasets, chemistry coverage, fit
  residuals). Referenced by generator + validation runs.
- `ValidationRun` — SoH/RUL/RV error metrics, calibration data, model version, timestamp; renders in
  WS-G.
- `RvBenchmark` — external market anchors (market, segment, age band, %RV) for WS-C calibration and
  back-test.
- `PortfolioSimRun` + `SimLoanOutcome` — a counterfactual run and its per-loan outcomes (with/without
  arm, default flag, realized recovery, net loss). `SimLoanOutcome` links to `Loan`.
- Field additions: `provenance` enum on `RiskScore`, `ResidualValueEstimate`, `LtvRecommendation`,
  `OriginationAudit`.

No breaking changes to existing tables; all additive migrations.

---

## 6. Sequencing (thin slice first, then widen)

Resist building the full matrix up front. Prove the spine on one cell, then broaden.

**Slice 0 — de-risk (do before anything visible):** WS-A anchor import + DGP fit, and lock Gates A,
B, D. This removes the circularity landmine and defines what "accurate" and "loss reduction" even
mean. *Nothing else is trustworthy until this is done.*

**Slice 1 — one vertical:** NMC, 3yr/60k-km used private passenger, full-data. Run
precondition→verification→results→**WS-D loss delta**→**WS-E LOS embed with a pricing-change table**.
This single cell exercises every workstream end-to-end and is showable.

**Slice 2 — widen the matrix:** add LFP + NCA, fleet/rental/ride-hail segments, age bands.

**Slice 3 — the ugly cells (the differentiator):** telemetry-only, no-passport (2027),
conflicting/tampered, repurposed-battery identity — WS-F.

**Slice 4 — package:** WS-G validation surface, data/model cards, integration guide.

Each slice is a decision gate. Ship Slice 1 as the "deep" proof; Slices 2–3 make it "wide."

---

## 7. Open decisions to lock

Bind to your standing questions plus what the code surfaces:

1. **Transparency policy (lock first).** Exact claim language; what's labelled simulated; what
   wording is reserved for real design-partner data. Everything inherits from this.
2. **Counterfactual methodology (Gate D).** Default-hazard spec, recovery model, what's held
   constant — signed off before any loss number exists.
3. **USD → EUR / EU-market pivot (Gate C).** Touches RV model, pricing tiers, and the marketing
   site (currently USD). Confirm now; it ripples.
4. **Which public datasets for v1 (Gate A).** Recommend NASA + CALCE + Sandia + Oxford.
5. **Legitimate-interest access (standing).** Model *both* outcomes; keep telemetry-only fallback so
   the product never depends on the ruling.
6. **Backend source of truth.** The repo carries **both** a Fastify/Prisma stack *and* a large Xano
   workspace (`xano/workspace.json`, ~1.1MB). Before building the evidence layer, decide which is
   canonical — the spec assumes the Fastify/Prisma path (`packages/db`, `apps/api`). If Xano is
   production, the WS-A–G bindings need re-pointing. **This ambiguity should be resolved early.**
7. **Repurposed-battery identity continuity (standing).** Reissued-passport handling in WS-F.
8. **Canonical schema / identifier resolution** across federated systems (standing) — needed for
   WS-F and the repurposed case.

---

## 8. What this explicitly does NOT claim

Guardrails, stated so they can't drift:

- No accuracy figure is derived from self-generated data (§1.1).
- The composite risk grade is a transparent rule, not an externally validated prediction (§1.2).
- Simulated portfolios never carry real-lender-outcome language (§1.3).
- VoltLedger provides a verified signal and audit trail; the lender sets policy and owns the credit
  decision. Nothing implies VoltLedger assumes a manufacturer's Reg 2023/1542 compliance
  obligations.
- Restricted passport fields are shown as access-gated pending the Commission implementing act, with
  a working fallback that doesn't depend on the outcome.

---

*Bound to repo state as reviewed. Paths, models, and endpoints reference the current monorepo
(`apps/api`, `packages/scoring`, `packages/db`, `tools/synthetic-generator`). Update WS bindings if
the backend source-of-truth decision (§7.6) changes.*

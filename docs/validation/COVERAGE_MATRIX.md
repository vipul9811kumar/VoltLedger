# Coverage Matrix (WS-F)

## What this is and isn't

This proves build spec v2 §3's "data-completeness axis" — the axis the spec calls VoltLedger's
actual differentiator ("anyone scores a battery with perfect data; VoltLedger's value shows in
the ugly cells") — by running the real resolver and reconciliation code (`reconcileSoH` in
`packages/scoring/src/passport.ts`, completely unmodified by WS-F) against a deliberately
forced version of every matrix cell, in-process, no DB or HTTP involved.

`forceScenario` (see `apps/api/src/lib/passport/scenario-generator.ts`) is what makes each
cell reachable on demand — it is **not exposed over the public API** in this pass; it only
exists for this report and `coverage-matrix.test.ts`'s hard assertions, deliberately, since
`POST /v1/passport/resolve` is reachable by any authenticated lender API key and its output
gets persisted and later feeds real scoring/LTV. Whether and how a live demo lets someone pick
a scenario interactively, with proper gating, is WS-G's job (the demo surface), not this
workstream's.

## Matrix cells

### Full (passport + telemetry)

- **Matrix cell:** full passport+telemetry
- **Precondition:** chemistry NMC, age 2.1yr; passport resolved (RESTRICTED, access GRANTED); telemetry present (SoH 94.7%)
- **Verification:** identity chain valid (passportUniqueId contains serial)
- **Results:** reconciled SoH 95.3% via **BLENDED**, confidence 92%, passport↔telemetry Δ+0.9pp

### Passport-only

- **Matrix cell:** passport-only
- **Precondition:** chemistry NMC, age 3.7yr; passport resolved (RESTRICTED, access GRANTED); no telemetry
- **Verification:** identity chain valid (passportUniqueId contains serial)
- **Results:** reconciled SoH 93.0% via **PASSPORT**, confidence 80%

### Telemetry-only

- **Matrix cell:** telemetry-only
- **Precondition:** chemistry NMC, age 1.2yr; no passport resolved; telemetry present (SoH 97%)
- **Verification:** not applicable
- **Results:** reconciled SoH 97.0% via **TELEMETRY**, confidence 70%

### Neither (2027 forward-only, pre-regulation asset)

- **Matrix cell:** neither (2027 forward-only)
- **Precondition:** chemistry NMC, age 4.2yr; no passport resolved; no telemetry
- **Verification:** not applicable
- **Results:** reconciled SoH 85.0% via **NONE**, confidence 10%

### Conflicting (passport vs. telemetry disagree >8pp)

- **Matrix cell:** conflicting
- **Precondition:** chemistry NMC, age 1.8yr; passport resolved (RESTRICTED, access GRANTED); telemetry present (SoH 95.4%)
- **Verification:** identity chain valid (passportUniqueId contains serial)
- **Results:** reconciled SoH 85.6% via **BLENDED**, confidence 62%, passport↔telemetry Δ-15.1pp

### Tampered (forged passport identity)

- **Matrix cell:** tampered
- **Precondition:** chemistry NMC, age 1.8yr; passport resolved (RESTRICTED, access GRANTED); telemetry present (SoH 95.5%)
- **Verification:** **identity chain INVALID** — passportUniqueId does not contain the battery serial (tamper signal)
- **Results:** reconciled SoH 96.7% via **BLENDED**, confidence 78%, passport↔telemetry Δ+2.6pp

### Reissued identity (repurposed/second-life battery)

- **Matrix cell:** repurposed/second-life (§7 item 7)
- **Precondition:** chemistry NMC, age 1.9yr; passport resolved (RESTRICTED, access GRANTED); telemetry present (SoH 95.1%)
- **Verification:** identity chain valid (passportUniqueId contains serial); linked to prior passport `30PPID/COVMX-REISSUE-007-EU2024-ORIGINAL` (reissued/repurposed identity)
- **Results:** reconciled SoH 94.1% via **BLENDED**, confidence 92%, passport↔telemetry Δ-1.5pp

### Access pending Commission implementing act

- **Matrix cell:** access pending (§8 guardrail)
- **Precondition:** chemistry NMC, age 2.0yr; passport resolved (RESTRICTED, access PENDING_LEGITIMATE_INTEREST); telemetry present (SoH 95.1%)
- **Verification:** identity chain valid (passportUniqueId contains serial)
- **Results:** reconciled SoH 95.1% via **TELEMETRY**, confidence 70%

### Same battery, access granted

- **Matrix cell:** access granted (§8 guardrail)
- **Precondition:** chemistry NMC, age 2.0yr; passport resolved (RESTRICTED, access GRANTED); telemetry present (SoH 95.1%)
- **Verification:** identity chain valid (passportUniqueId contains serial)
- **Results:** reconciled SoH 95.6% via **BLENDED**, confidence 92%, passport↔telemetry Δ+0.8pp


## Access pending vs. granted (both outcomes, side by side)

The access-pending/granted pair above uses the *same* battery
(`COVMX-PENDING-008`) run twice — once with restricted fields withheld
(`ACCESS_PENDING`) and once with them available (`RESTRICTED_CONSISTENT`) — to show both
outcomes side by side, per build spec §7 item 5 ("model both outcomes; keep telemetry-only
fallback so the product never depends on the ruling"). Compare the two `Results` lines above:
the pending run falls back to `TELEMETRY` source; the granted run reconciles via
`BLENDED`/`PASSPORT` with materially higher confidence — concretely showing what legitimate-
interest access is worth once granted, without the product ever being blocked while it waits.

## Known limitations

- The four non-mock resolver stubs (Catena-X, GS1, Direct-OEM, Aggregator) can also produce
  every scenario above via `forceScenario` (see `coverage-matrix.test.ts`'s dedicated test for
  this), but this report only exercises the mock resolver, since that's the one path an actual
  demo runs through today — real identifiers never route to the other four resolvers in
  practice (their `canHandle()` checks require BPN/GTIN/OEM-prefixed identifiers the synthetic
  generator doesn't produce).
- This report calls `reconcileSoH` directly, not the full `runIntelligenceEngine`/
  `computeRiskScore` pipeline — the coverage-state logic being proven here lives entirely in
  `reconcileSoH`, and that function was verified unmodified by WS-F (see
  `packages/scoring/src/passport.ts`).

## How to reproduce

`pnpm coverage-matrix` (from repo root) regenerates this file.

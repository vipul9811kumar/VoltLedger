# VoltLedger Risk Scoring — Model Card

Model version: 1.0
Generated: 2026-08-12T21:15:20.519Z

## What this model does

Computes a 0-1000 composite risk score and A-F grade from five weighted sub-scores (`packages/scoring/src/risk.ts`). Consumes an already-known state-of-health (from telemetry or an EU Battery Passport) — it does not itself estimate SoH from raw signals.

## Inputs and weights (`SUB_SCORE_WEIGHTS`)

| Sub-score | Weight |
|---|---|
| degradation | 30% |
| thermalScore | 20% |
| usagePattern | 20% |
| capacityRetention | 20% |
| ageAdjusted | 10% |

## Grade thresholds (`GRADE_THRESHOLDS`)

| Grade | Composite score floor |
|---|---|
| A | 800 |
| B | 650 |
| C | 500 |
| D | 350 |
| F | 0 (below D floor) |

## Expected SoH by chemistry and age (`EXPECTED_SOH_BY_CHEMISTRY`)

Used by the age-adjusted sub-score and by residual-value/degradation forecasting.

| Chemistry | 0yr | 1yr | 2yr | 3yr | 4yr | 5yr | 6yr | 7yr | 8yr |
|---|---|---|---|---|---|---|---|---|---|
| LFP | 100 | 99 | 97.5 | 96 | 94.5 | 93 | 91.5 | 90 | 88.5 |
| NMC | 100 | 98 | 95.5 | 93 | 90.5 | 88 | 85.5 | 83 | 80.5 |
| NCA | 100 | 97 | 93.5 | 90 | 86.5 | 83 | 79.5 | 76 | 73 |
| LTO | 100 | 99.5 | 99 | 98.5 | 98 | 97.5 | 97 | 96.5 | 96 |

## What is validated, and what is a rule (build spec v2 §1.2)

**Validatable against external truth:** the cycle-loss-rate assumption behind `EXPECTED_SOH_BY_CHEMISTRY` / `CHEMISTRY_PARAMS.cycleLossPctPer100Cycles` — because real cells have measured capacity fade. See the WS-B validation report (`docs/validation/SOH_RUL_VALIDATION.md`) for the current error figures.

**Not externally validatable:** the composite A-F risk grade itself. No one publishes battery risk grades, so there is no ground truth to score against. The grade is a transparent, auditable *rule* (the weights and thresholds above) — never a "validated N%-accurate" number. This framing is deliberate, not a limitation to work around.

## Current validation headline (see full report for detail and caveats)

| Chemistry | Cells compared | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) |
|---|---|---|---|---|
| LFP | 31 | 14.62 | 18.39 | 3692.06 |
| NMC | 31 | 14.12 | 17.99 | 1692.06 |
| NCA | 31 | 13.92 | 17.84 | 1358.73 |

## Known limits

- **Chemistry mismatch**: all real cells validated against (NASA PCoE, CALCE CS2/CX2) are
  LiCoO2 — none of LFP/NMC/NCA/LTO. The MAE/RMSE above measure plausibility, not
  same-chemistry accuracy. Closing this needs Sandia or Oxford data (currently
  acquisition-blocked — see `packages/calibration/README.md`).
- **No calendar-aging validation**: both real sources are continuous-cycling studies;
  `calendarLossPctPerYear` is unvalidated by any real data.
- **No DCFC-specific validation**: charge protocol was held constant in both real
  sources, so `dcfcSensitivity` is unvalidated.
- **RUL is a derived proxy**, not a production estimator — see `docs/validation/
  SOH_RUL_VALIDATION.md` for the exact construction (linear extrapolation to 80% SoH).
- **The composite grade is not validated** and is not claimed to be — see above.

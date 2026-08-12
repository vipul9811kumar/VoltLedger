# WS-D Methodology Note

Methodology version: 0.1.0

Required reading alongside `docs/validation/PORTFOLIO_LOSS_SIMULATION.md` — per build spec v2
WS-D's own acceptance criterion: "a written methodology note ships alongside [the loss-delta
number] — without it the number is unusable."

## Provenance

Every figure this simulator produces is **SIMULATED_CALIBRATED**: a synthetic portfolio scored
against an illustrative, hand-set hazard/recovery model, not fitted to any real default or
recovery data (none exists yet for this product). Never presented as a real lender outcome.

## Gate D sign-off (2026-08-12)

1. **Baseline "WITHOUT VoltLedger" policy**: a flat LTV cap (70%)
   and flat rate (650bps) for every loan, regardless of battery
   condition — models a lender with zero battery-signal visibility, the realistic pre-VoltLedger
   state for most EV lenders today.
2. **Default-hazard model**: a transparent parametric multiplier —

   ```
   monthlyDefaultProbability = baselineAnnualDefaultProbability × ltvBandMultiplier × gradeMultiplier / 12
   ```

   Deliberately not a fitted survival/hazard curve — there is nothing to fit it against yet.
   Current parameters (`data/methodology-params.json`, freely editable):
   - Baseline annual default probability: 3.0%
   - LTV-band multipliers: {"under60":0.8,"60to75":1,"75to85":1.4,"over85":2}
   - Grade multipliers: {"A":0.5,"B":0.8,"C":1.2,"D":2,"F":3.5}
3. **Recovery model**: the *existing* `packages/scoring` residual-value logic
   (`computeResidualValue`) — the same production function used for real battery valuations,
   called with the loan's true simulated condition at the month of default, minus a
   20% repossession/liquidation discount, capped at the
   outstanding loan balance. Not yet calibrated to real market data (that's WS-C, not yet built)
   — swappable later without restructuring this simulator.
4. **What's held constant across both arms**: identical synthetic portfolio, identical
   borrowers/vehicle values, identical *true* battery degradation trajectories (the same
   week-by-week SoH/thermal/usage history drives both arms' real-world outcomes) — **only the
   underwriting policy differs**. The battery's true condition affects default risk and recovery
   value in both arms; only the WITH arm's *origination decision* (LTV cap, pricing) actually
   used that signal.

## Cohorts

- **Chemistry**: LFP / NMC / NCA, from `tools/synthetic-generator`'s `BATTERY_MODELS`.
- **Segment**: the five `USAGE_PROFILES` (daily commuter, high-mileage, rideshare/fleet,
  weekend, commercial delivery) — a proxy for borrower/fleet type, not a real demographic axis.

## Known simplifications (stated, not hidden)

- **No loan amortization.** Outstanding balance is treated as flat at the originated amount for
  the loan's life. This overstates absolute loss figures for both arms roughly equally, so the
  WITH-vs-WITHOUT *delta* stays meaningful even though the absolute numbers would shrink under a
  real amortization schedule.
- **Monthly hazard is a linear apportionment of the annual rate**, not a compounded hazard
  rate — a stated approximation, not a survival-analysis model.
- **Grade multiplier is re-evaluated monthly** from the loan's true (simulated) condition,
  independent of what was priced at origination — this is intentional: real-world default risk
  tracks true condition, not what a lender believed when the loan was written.
- **Chemistry mismatch carries forward from WS-A/WS-B**: the risk-scoring inputs this simulator
  calls (`computeRiskScore`, `computeResidualValue`) are the same production functions whose
  degradation assumptions are only validated against LCO cells (NASA/CALCE), not LFP/NMC/NCA
  directly — see `packages/scoring/MODEL_CARD.md`.

## How to reproduce or vary a run

`tools/portfolio-sim` takes `--n <loans>` and `--seed <int>`. Same seed + same
`methodology-params.json` reproduces an identical portfolio and outcome. Vary the seed to see
result sensitivity; vary the parameters to see policy sensitivity — both are expected uses of
this tool, not "picking the run that looks best."

import type { CalibrationResult } from './types';

export function renderCalibrationNote(result: CalibrationResult): string {
  const { impliedRetention, autovistaBandLowPct, autovistaBandHighPct, autovistaPoints } = result;

  const rows = impliedRetention
    .map((r) => {
      const inBand = r.impliedBatteryRetentionPct3yr >= autovistaBandLowPct && r.impliedBatteryRetentionPct3yr <= autovistaBandHighPct;
      return `| ${r.chemistry} | ${r.expectedSoHAt3yr}% | ${(r.marketDepreciationRate * 100).toFixed(0)}%/yr | ${r.impliedBatteryRetentionPct3yr}% | ${inBand ? 'inside' : 'outside'} |`;
    })
    .join('\n');

  const autovistaRows = autovistaPoints
    .map((p) => `| ${p.market} | ${p.ageYears}yr / ${p.mileageKm.toLocaleString()}km | ${p.pctRetention}% | [${p.sourceTitle}](${p.sourceUrl}) (${p.observedPeriod}) |`)
    .join('\n');

  return `# RV Calibration Note (WS-C)

## What this is and isn't

This is a **calibration check, not a fitted calibration**. It compares this model's implied
3-year battery-value retention (driven by \`sohFactor × marketFactor\` in
\`packages/scoring/src/residual-value.ts\`) against a small, real, publicly-sourced band of EU
BEV whole-vehicle %RV figures — and reports the gap honestly rather than force-fitting
\`MARKET_DEPRECIATION_RATE\` to close it.

**No constants were changed by this run.** \`MARKET_DEPRECIATION_RATE\` and
\`BATTERY_VALUE_PCT\` in \`packages/scoring/src/constants.ts\` are unmodified.

## Why this model isn't force-fit to the Autovista band

This model's \`residualPct\` is **battery value retained as a % of original battery value**
— purely SoH decline and a battery-specific market-depreciation multiplier. Autovista's %RV
anchor is **whole-vehicle retention** — glider wear, mileage, brand depreciation, model-year
turnover, none of which this model represents at all. They are not the same quantity.

Using today's (uncalibrated) constants, the implied 3yr battery-value retention is well above
the whole-vehicle anchor band for every chemistry:

| Chemistry | Expected SoH @ 3yr | Current MARKET_DEPRECIATION_RATE | Implied battery retention @ 3yr | vs. ${autovistaBandLowPct}–${autovistaBandHighPct}% anchor band |
|---|---|---|---|---|
${rows}

Closing that gap by raising \`MARKET_DEPRECIATION_RATE\` alone would require roughly a 3-4x
increase per chemistry — which would make that constant silently absorb non-battery
depreciation (glider wear, mileage, brand) it was never defined to represent. That constant
also drives the 12/24/36/60-month RV forecast curves, second-life valuation, and (via
\`residual-value.ts\`) WS-D's portfolio-sim recovery model — corrupting its meaning there to
chase a fit on one number would be a worse outcome than leaving the gap documented.

**Decision (confirmed with the user, 2026-08-13):** report only, do not force-fit. Real
battery-specific market data — a source that isolates battery value from whole-vehicle
value — would be needed to responsibly calibrate this constant. None was found to be
publicly accessible this session (see \`data/manheim/DATA_CARD.md\`,
\`data/autovista/DATA_CARD.md\`).

## Source anchor points (Autovista/JD Power, EU, secondary/illustrative)

| Market | Age / mileage | %RV (whole-vehicle) | Source |
|---|---|---|---|
${autovistaRows}

## Known limitations

- \`BATTERY_VALUE_PCT\` (vehicle/battery value split) has no calibration source at all —
  neither Manheim nor Autovista speak to it. Left entirely as-is.
- Autovista points are EU-market, 3 countries, 1 month (April 2026) — a small, non-systematic
  sample, not a curve.
- No US-market, battery-value-only benchmark was found. If one becomes accessible, this is
  where it plugs in.

## How to reproduce

\`pnpm rv-calibrate\` (from repo root) regenerates this file and
\`docs/validation/RV_MARKET_BACKTEST.md\`.
`;
}

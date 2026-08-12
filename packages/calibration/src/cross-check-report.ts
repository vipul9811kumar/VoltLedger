import type { CalceDataset, CrossCheckResult } from './types';

export function renderCrossCheckReport(calce: CalceDataset, result: CrossCheckResult): string {
  const pct = (r: CrossCheckResult) => ((r.ratioCalceToNasa - 1) * 100).toFixed(0);
  const direction = result.ratioCalceToNasa >= 1 ? 'higher' : 'lower';

  return `# Cross-check — CALCE (CS2/CX2) vs. NASA PCoE

Generated: ${result.generatedAt}

## Why this exists

Both NASA PCoE and CALCE's CS2/CX2 cells are the same chemistry (LiCoO2) but otherwise
unrelated: different labs, different cell manufacturers/designs, different years, different
testers. If two independent LCO sources land in the same ballpark for room-temperature
cycle-loss rate, that's real (if modest) corroboration of the NASA-derived number in
\`data/nasa-pcoe/DATA_CARD.md\`. If they don't agree, that's a real finding to flag, not a
reason to pick whichever one is more convenient.

**This does not feed back into \`chemistry-params.calibrated.json\`** — it's a check, not
an additional fit input.

## Source

- **Dataset:** ${calce.source}
- **URL:** ${calce.sourceUrl}
- **Citation:** ${calce.citation}
- **Chemistry:** ${calce.chemistry}
- **Ambient temperature:** ${calce.ambientTempNote}
- **Scope:** CS2/CX2 "Type 1" (0.5C) and "Type 2" (1C) protocols only — simple constant-
  current full-depth cycling, the closest match to NASA's protocol. CS2-8/21 and CX2-4/31
  (CADEX tester, different file format) and CS2/CX2 Types 3-6 (pulsed/randomized/partial-
  cycling — not comparable to a simple full-cycle rate) are out of scope for this pass.

## Result

- NASA reference (24C): **${result.nasaReferenceLossPctPer100Cycles.toFixed(3)}% / 100 cycles**
- CALCE room-temp, ${result.nCalceCellsUsed} cells passing the same R² ≥ 0.5 gate used
  throughout this package:
  - Median: **${result.calceMedianLossPctPer100Cycles.toFixed(3)}% / 100 cycles**
  - Mean: **${result.calceMeanLossPctPer100Cycles.toFixed(3)}% / 100 cycles**
- CALCE mean is **${Math.abs(Number(pct(result)))}% ${direction}** than the NASA reference —
  a **${(result.nasaReferenceLossPctPer100Cycles / result.calceMeanLossPctPer100Cycles).toFixed(1)}x** gap.

**Verdict: these do not closely agree.** This is not noise-level disagreement — it's a
real, order-of-magnitude-adjacent gap between two independent LCO sources, and it should
be read as exactly that, not smoothed over. A plausible explanation: NASA's cells were
discharged at 1-2C relative to their ~2Ah rating and driven to 20-30% fade in well under
200 cycles (a harsher, faster protocol), while CALCE's CS2/CX2 cells ran gentler 0.5-1C
cycling and took 700-2000+ cycles to reach comparable fade — different stress levels on
different cell designs can easily produce a multi-x difference in %-loss-per-cycle. That's
a plausible explanation, not a verified one. **Practical consequence: treat the NASA-
derived reference rate in \`data/nasa-pcoe/DATA_CARD.md\` as one data point with real
uncertainty around it, not a settled number** — exactly the caveat Gate B (spec §4) needs
to inherit once a real accuracy-threshold conversation happens.

## Per-cell rates

| Cell | Family | Protocol | Loss %/100 cycles | R² | Used in cross-check |
|---|---|---|---|---|---|
${result.calceCellRates
  .map(
    (r) =>
      `| ${r.cellId} | ${calce.cells.find((c) => c.cellId === r.cellId)?.family ?? '?'} | ${calce.cells.find((c) => c.cellId === r.cellId)?.protocol ?? '?'} | ${r.lossPctPer100Cycles.toFixed(3)} | ${r.rSquared.toFixed(3)} | ${r.rSquared >= 0.5 ? 'yes' : 'no (R² < 0.5)'} |`,
  )
  .join('\n')}
`;
}

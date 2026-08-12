import type { CapacityFadeDataset, DatasetSplit, NasaPcoeCalibration } from './types';

export function renderDataCard(
  dataset: CapacityFadeDataset,
  split: DatasetSplit,
  calibration: NasaPcoeCalibration,
): string {
  const excludedNote = '2 of 34 raw cells (B0039, B0041) excluded: no physically plausible ' +
    'capacity reading in their first 5 discharge cycles (< 0.5 Ahr against a ~2 Ahr rated cell) ' +
    '— consistent with NASA\'s own README caveat for the 4C-labeled batches ("several discharge ' +
    'runs where the capacity was very low... not fully analyzed").';

  const tempDiscrepancy = 'B0042/43/44 are packaged under the "41-44" batch README, which states ' +
    'a 4C ambient — but each cycle\'s own `ambient_temperature` field reads 22C. This pipeline ' +
    'trusts the per-cycle sensor field over the batch label (that\'s what "ambientTempC" below ' +
    'reflects); flagging the discrepancy here rather than silently picking one.';

  return `# Data Card — NASA PCoE Battery Data Set (calibration anchor)

Generated: ${calibration.generatedAt}
Model version: ${calibration.modelVersion}

## Source

- **Dataset:** ${dataset.source}
- **URL:** ${dataset.sourceUrl}
- **Citation:** ${dataset.citation}
- **Chemistry:** ${dataset.chemistry}

## What this is and isn't

This is a **cycling aging study**: 34 x 18650 cells run through repeated charge/discharge
cycles at three fixed ambient temperatures (4C, ~22-24C, 43C) until 20-30% capacity fade.
It directly supports fitting a **cycle-linked degradation rate** and a **thermal sensitivity**
coefficient. It does **not** support:

- **Calendar/rest aging** (\`calendarLossPctPerYear\` in \`tools/synthetic-generator\`'s
  \`ChemistryParams\`) — these cells were continuously cycled, never rested for calendar-aging
  measurement.
- **DCFC sensitivity** (\`dcfcSensitivity\`) — charging in every batch used the same fixed
  1.5A CC/CV protocol; only discharge current varied, so fast-*charge* stress was never an
  independent variable here.
- **Chemistry-exact calibration for LFP/NMC/NCA** — these are 18650 LCO/graphite cells, which
  is not one of VoltLedger's four modeled chemistries (\`Chemistry\` enum: LFP/NMC/NCA/LTO).
  Treat this calibration as validating the model's *functional form* (does a linear
  cycle-loss + thermal-sensitivity model track real cells at all) — not as the final magnitude
  for any specific VoltLedger chemistry. CALCE, Sandia, and Oxford (chemistry-matched,
  currently acquisition-blocked — see \`README.md\`) are what close that gap.

## Coverage

- Cells ingested: ${dataset.cells.length} (of 34 raw) — ${excludedNote}
- Ambient temperatures observed: ${[...new Set(dataset.cells.map((c) => c.ambientTempC))].sort((a, b) => a - b).join(', ')} C
- Total discharge-cycle data points: ${dataset.points.length}
- ${tempDiscrepancy}

## Train / holdout split

Split by cell (not by cycle, to avoid leaking a cell's own curve across the split):

- Train cells (${split.trainCellIds.length}): ${split.trainCellIds.join(', ')}
- Holdout cells (${split.holdoutCellIds.length}): ${split.holdoutCellIds.join(', ')}

Enforced by \`src/holdout-guard.test.ts\`: \`packages/scoring\` must never import
\`@voltledger/calibration\` — that's what keeps the holdout cells out of the model-under-test,
per build spec v2 §1.1.

## Fit

**Data-quality gate (applied uniformly to train AND holdout, stated here in full):** a
cell's per-cycle fade slope is only used if its own linear fit reaches R² >= 0.5 — below
that, the slope itself isn't reliably estimated, and feeding it into the group regression
(or judging the model against it) would measure noise, not signal. This gate excludes most
of the 4C batches almost exactly matching NASA's own README caveats for B0041-56 ("several
discharge runs where the capacity was very low... not fully analyzed", and for B0049-52,
"the experiment control software crashed") — the gate corroborates NASA's own documented
caveat rather than being tuned to produce a particular answer. Nothing is hidden: every
cell, gated or not, is in the per-cell table below with its own R² so you can see exactly
what was excluded and why.

Linear regression of per-cell loss-rate (%/100 cycles, itself an OLS slope of SoH% vs. cycle
index) against ambient temperature, fit on the ${calibration.fit.nCellsUsed} train cells that passed the gate:

- Reference loss rate at ${calibration.fit.referenceTempC}C: **${calibration.fit.referenceLossPctPer100Cycles.toFixed(3)}% / 100 cycles**
- Thermal sensitivity: **${calibration.fit.thermalSlopePctPer100CyclesPerDegC >= 0 ? '+' : ''}${calibration.fit.thermalSlopePctPer100CyclesPerDegC.toFixed(4)}% / 100 cycles per °C** away from ${calibration.fit.referenceTempC}C
- R² (temp -> loss-rate regression): ${calibration.fit.rSquared.toFixed(3)}

**On the negative sign:** this says loss *decreases* as ambient temperature rises from 4C
to 43C — the opposite of the usual "heat accelerates aging" assumption baked into
\`tools/synthetic-generator\`'s hand-set \`thermalLossPctPerDegPerYear\` (positive for every
chemistry). It's not necessarily wrong: lithium plating during cold-temperature charging is
a well-documented accelerant, and these cells all charged at a fixed rate regardless of
ambient temperature, so the coldest batch may genuinely have degraded fastest. But R² =
${calibration.fit.rSquared.toFixed(3)} on ${calibration.fit.nCellsUsed} cells is a real result, not a strong one — treat
this as "the current model's simple heat-only assumption doesn't hold up against real cold-
climate data," not as a validated replacement coefficient.

## Holdout validation

Fit's predicted loss-rate vs. each holdout cell's own measured rate (same R² >= 0.5 gate
applied — ${calibration.holdoutValidation.nHoldoutCellsExcludedLowRSquared} of ${calibration.holdoutValidation.nHoldoutCells + calibration.holdoutValidation.nHoldoutCellsExcludedLowRSquared} holdout cells excluded on the same grounds):

- Holdout cells evaluated: ${calibration.holdoutValidation.nHoldoutCells}
- MAE: ${calibration.holdoutValidation.maeLossPctPer100Cycles.toFixed(3)}% / 100 cycles
- RMSE: ${calibration.holdoutValidation.rmseLossPctPer100Cycles.toFixed(3)}% / 100 cycles

This MAE is the number to anchor Gate B (spec §4, WS-A/B) against once WS-B's full SoH/RUL
harness exists — it's a first real error figure, not yet the scoring-model accuracy figure
itself, and it is not a small error. That's an honest result of a 2-parameter linear model
against real, noisy, low-cycle-count cells — not a finished calibration.

## Per-cell fade rates

| Cell | Ambient (C) | Loss %/100 cycles | R² | Split |
|---|---|---|---|---|
${calibration.perCellFadeRates
  .map(
    (r) =>
      `| ${r.cellId} | ${r.ambientTempC} | ${r.lossPctPer100Cycles.toFixed(3)} | ${r.rSquared.toFixed(3)} | ${split.holdoutCellIds.includes(r.cellId) ? 'holdout' : 'train'} |`,
  )
  .join('\n')}
`;
}

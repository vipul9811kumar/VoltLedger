import type { ValidationResult } from './compare';

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : 'n/a';
}

function statsRow(label: string, stats: ValidationResult['overallByChemistry'][keyof ValidationResult['overallByChemistry']]): string {
  return `| ${label} | ${stats.n} | ${fmt(stats.maeLossPctPer100Cycles)} | ${fmt(stats.rmseLossPctPer100Cycles)} | ${fmt(stats.maeRulCycles)} | ${fmt(stats.rmseRulCycles)} |`;
}

export function renderValidationReport(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('# WS-B — SoH/RUL validation vs. real cells');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push('');
  lines.push('## What this is and isn\'t');
  lines.push('');
  lines.push(
    'Compares `packages/scoring`\'s hand-set `EXPECTED_SOH_BY_CHEMISTRY` / ' +
      '`tools/synthetic-generator`\'s `CHEMISTRY_PARAMS.cycleLossPctPer100Cycles` (LFP/NMC/NCA) ' +
      'against real cycle-loss rates fitted from NASA PCoE + CALCE cells (see ' +
      '`packages/calibration`). **Every real cell here is LiCoO2 (LCO)** — not one of ' +
      'VoltLedger\'s modeled chemistries. This measures whether the model\'s assumptions sit in ' +
      'a plausible range next to real degradation data, compared against all three chemistries ' +
      'so nothing is cherry-picked — it is not a same-chemistry accuracy certification. See ' +
      '`packages/scoring/MODEL_CARD.md` for the full framing, including build spec v2 §1.2\'s ' +
      'distinction between validated inputs and the composite grade as a transparent rule.',
  );
  lines.push('');
  lines.push(
    '**RUL** (remaining useful life, in cycles to 80% SoH — the standard EV end-of-life ' +
      'threshold) is derived here for both the real cells and the model by linear extrapolation ' +
      'of the fitted cycle-loss rate. No RUL estimator exists in `packages/scoring` today; this ' +
      'is a validation-only construct, not a production function being tested.',
  );
  lines.push('');
  lines.push(
    `Cells included: ${result.rows.length} (R² ≥ ${'0.5'} reliability gate, same threshold WS-A ` +
      'used for its own group fit and holdout validation — applied identically here, not tuned ' +
      'for this report).',
  );

  lines.push('');
  lines.push('## Overall error, by chemistry compared against');
  lines.push('');
  lines.push('| Chemistry | n | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) | RMSE RUL (cycles) |');
  lines.push('|---|---|---|---|---|---|');
  for (const [chem, stats] of Object.entries(result.overallByChemistry)) {
    lines.push(statsRow(chem, stats));
  }

  lines.push('');
  lines.push('## By source (NASA vs. CALCE — do the two real datasets imply the same error?)');
  lines.push('');
  lines.push('| Source / Chemistry | n | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) | RMSE RUL (cycles) |');
  lines.push('|---|---|---|---|---|---|');
  for (const [source, byChem] of Object.entries(result.bySourceByChemistry)) {
    for (const [chem, stats] of Object.entries(byChem)) {
      lines.push(statsRow(`${source} / ${chem}`, stats));
    }
  }

  lines.push('');
  lines.push('## By temperature band (NASA only — CALCE\'s ambient isn\'t documented, see WS-A data card)');
  lines.push('');
  lines.push(
    'Substitutes for an "age band" split, which this cycling-study data can\'t provide — stated ' +
      'here rather than silently relabeled.',
  );
  lines.push('');
  lines.push('| Temp band / Chemistry | n | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) | RMSE RUL (cycles) |');
  lines.push('|---|---|---|---|---|---|');
  for (const [band, byChem] of Object.entries(result.byTempBandByChemistry)) {
    for (const [chem, stats] of Object.entries(byChem)) {
      lines.push(statsRow(`${band} / ${chem}`, stats));
    }
  }

  lines.push('');
  lines.push('## Per-cell detail');
  lines.push('');
  lines.push(
    '| Cell | Source | Temp (C) | Real loss %/100cyc | Real R² | Real RUL (cyc) | NMC model loss | NMC error | NMC RUL error (cyc) |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of result.rows) {
    const nmc = r.perChemistry.NMC;
    lines.push(
      `| ${r.cellId} | ${r.source} | ${r.ambientTempC ?? 'n/a'} | ${fmt(r.realLossPctPer100Cycles)} | ` +
        `${r.realRSquared.toFixed(3)} | ${fmt(r.realRulCycles)} | ${fmt(nmc.modelLossPctPer100Cycles)} | ` +
        `${fmt(nmc.errorLossPctPer100Cycles)} | ${fmt(nmc.errorRulCycles)} |`,
    );
  }
  lines.push('');
  lines.push(
    '(NMC shown as the representative column above for readability — LFP and NCA follow the ' +
      'same pattern; see `chemistry-params.calibrated.json`-style raw output for all three if ' +
      'needed.)',
  );

  return lines.join('\n') + '\n';
}

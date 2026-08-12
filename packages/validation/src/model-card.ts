import { SUB_SCORE_WEIGHTS, GRADE_THRESHOLDS, EXPECTED_SOH_BY_CHEMISTRY, MODEL_VERSION } from '@voltledger/scoring';
import type { ValidationResult } from './compare';

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : 'n/a';
}

export function renderModelCard(validation: ValidationResult): string {
  const lines: string[] = [];

  lines.push('# VoltLedger Risk Scoring — Model Card');
  lines.push('');
  lines.push(`Model version: ${MODEL_VERSION}`);
  lines.push(`Generated: ${validation.generatedAt}`);
  lines.push('');
  lines.push('## What this model does');
  lines.push('');
  lines.push(
    'Computes a 0-1000 composite risk score and A-F grade from five weighted sub-scores ' +
      '(`packages/scoring/src/risk.ts`). Consumes an already-known state-of-health (from ' +
      'telemetry or an EU Battery Passport) — it does not itself estimate SoH from raw signals.',
  );
  lines.push('');
  lines.push('## Inputs and weights (`SUB_SCORE_WEIGHTS`)');
  lines.push('');
  lines.push('| Sub-score | Weight |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(SUB_SCORE_WEIGHTS)) {
    lines.push(`| ${k} | ${(v * 100).toFixed(0)}% |`);
  }
  lines.push('');
  lines.push('## Grade thresholds (`GRADE_THRESHOLDS`)');
  lines.push('');
  lines.push('| Grade | Composite score floor |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(GRADE_THRESHOLDS)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('| F | 0 (below D floor) |');
  lines.push('');
  lines.push('## Expected SoH by chemistry and age (`EXPECTED_SOH_BY_CHEMISTRY`)');
  lines.push('');
  lines.push('Used by the age-adjusted sub-score and by residual-value/degradation forecasting.');
  lines.push('');
  lines.push('| Chemistry | 0yr | 1yr | 2yr | 3yr | 4yr | 5yr | 6yr | 7yr | 8yr |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const [chem, curve] of Object.entries(EXPECTED_SOH_BY_CHEMISTRY)) {
    lines.push(`| ${chem} | ${curve.join(' | ')} |`);
  }

  lines.push('');
  lines.push('## What is validated, and what is a rule (build spec v2 §1.2)');
  lines.push('');
  lines.push(
    '**Validatable against external truth:** the cycle-loss-rate assumption behind ' +
      '`EXPECTED_SOH_BY_CHEMISTRY` / `CHEMISTRY_PARAMS.cycleLossPctPer100Cycles` — because real ' +
      'cells have measured capacity fade. See the WS-B validation report ' +
      '(`docs/validation/SOH_RUL_VALIDATION.md`) for the current error figures.',
  );
  lines.push('');
  lines.push(
    '**Not externally validatable:** the composite A-F risk grade itself. No one publishes ' +
      'battery risk grades, so there is no ground truth to score against. The grade is a ' +
      'transparent, auditable *rule* (the weights and thresholds above) — never a "validated ' +
      'N%-accurate" number. This framing is deliberate, not a limitation to work around.',
  );

  lines.push('');
  lines.push('## Current validation headline (see full report for detail and caveats)');
  lines.push('');
  lines.push('| Chemistry | Cells compared | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) |');
  lines.push('|---|---|---|---|---|');
  for (const [chem, stats] of Object.entries(validation.overallByChemistry)) {
    lines.push(`| ${chem} | ${stats.n} | ${fmt(stats.maeLossPctPer100Cycles)} | ${fmt(stats.rmseLossPctPer100Cycles)} | ${fmt(stats.maeRulCycles)} |`);
  }

  lines.push('');
  lines.push('## Known limits');
  lines.push('');
  lines.push('- **Chemistry mismatch**: all real cells validated against (NASA PCoE, CALCE CS2/CX2) are');
  lines.push('  LiCoO2 — none of LFP/NMC/NCA/LTO. The MAE/RMSE above measure plausibility, not');
  lines.push('  same-chemistry accuracy. Closing this needs Sandia or Oxford data (currently');
  lines.push('  acquisition-blocked — see `packages/calibration/README.md`).');
  lines.push('- **No calendar-aging validation**: both real sources are continuous-cycling studies;');
  lines.push('  `calendarLossPctPerYear` is unvalidated by any real data.');
  lines.push('- **No DCFC-specific validation**: charge protocol was held constant in both real');
  lines.push('  sources, so `dcfcSensitivity` is unvalidated.');
  lines.push('- **RUL is a derived proxy**, not a production estimator — see `docs/validation/');
  lines.push('  SOH_RUL_VALIDATION.md` for the exact construction (linear extrapolation to 80% SoH).');
  lines.push('- **The composite grade is not validated** and is not claimed to be — see above.');

  return lines.join('\n') + '\n';
}

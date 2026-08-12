import type { ArmSummary, CohortBreakdown } from './aggregate';

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function summaryRow(label: string, w: ArmSummary, wo: ArmSummary): string {
  const delta = wo.totalNetLossUsd - w.totalNetLossUsd;
  return `| ${label} | ${w.nLoans} | ${fmtPct(w.defaultRatePct)} | ${fmtUsd(w.totalNetLossUsd)} | ${fmtPct(w.lossGivenDefaultPct)} | ${fmtPct(wo.defaultRatePct)} | ${fmtUsd(wo.totalNetLossUsd)} | ${fmtPct(wo.lossGivenDefaultPct)} | ${fmtUsd(delta)} |`;
}

export function renderResultsReport(params: {
  generatedAt: string;
  seed: number;
  nLoans: number;
  withSummary: ArmSummary;
  withoutSummary: ArmSummary;
  byChemistry: CohortBreakdown[];
  bySegment: CohortBreakdown[];
}): string {
  const { generatedAt, seed, nLoans, withSummary, withoutSummary, byChemistry, bySegment } = params;
  const lossDelta = withoutSummary.totalNetLossUsd - withSummary.totalNetLossUsd;

  const lines: string[] = [];
  lines.push('# WS-D — Portfolio loss simulation (SIMULATED_CALIBRATED)');
  lines.push('');
  lines.push(`Generated: ${generatedAt} | seed: ${seed} | n=${nLoans} loans`);
  lines.push('');
  lines.push(
    '**Provenance: SIMULATED_CALIBRATED.** Every number below is a synthetic-portfolio simulation ' +
      'against an illustrative (not fitted) hazard/recovery model — see `METHODOLOGY.md` for the ' +
      'full spec, what\'s held constant, and known simplifications. Never present these figures as ' +
      'a real lender outcome; that language is reserved for actual design-partner data, per build ' +
      'spec v2 §1.3.',
  );

  lines.push('');
  lines.push('## Headline: loss delta');
  lines.push('');
  lines.push(
    `**WITH VoltLedger signal: ${fmtUsd(withSummary.totalNetLossUsd)} net credit loss** ` +
      `(${fmtPct(withSummary.defaultRatePct)} default rate, ${fmtPct(withSummary.lossGivenDefaultPct)} LGD)`,
  );
  lines.push(
    `**WITHOUT (flat-LTV baseline): ${fmtUsd(withoutSummary.totalNetLossUsd)} net credit loss** ` +
      `(${fmtPct(withoutSummary.defaultRatePct)} default rate, ${fmtPct(withoutSummary.lossGivenDefaultPct)} LGD)`,
  );
  lines.push('');
  lines.push(`**Loss delta: ${fmtUsd(lossDelta)}** (WITHOUT − WITH) across this ${nLoans}-loan simulated portfolio.`);
  if (lossDelta < 0) {
    lines.push('');
    lines.push(
      '**This run shows the WITH arm losing *more*, not less.** That is reported as-is, not hidden ' +
        'or re-rolled — see METHODOLOGY.md for how to investigate (seed, parameter sensitivity).',
    );
  }

  lines.push('');
  lines.push('## By chemistry');
  lines.push('');
  lines.push(
    '| Chemistry | n (WITH) | Default % (WITH) | Net loss (WITH) | LGD % (WITH) | Default % (W/O) | Net loss (W/O) | LGD % (W/O) | Loss delta |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const c of byChemistry) lines.push(summaryRow(c.key, c.with, c.without));

  lines.push('');
  lines.push('## By segment (usage profile, as a proxy for borrower/fleet type)');
  lines.push('');
  lines.push(
    '| Segment | n (WITH) | Default % (WITH) | Net loss (WITH) | LGD % (WITH) | Default % (W/O) | Net loss (W/O) | LGD % (W/O) | Loss delta |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const c of bySegment) lines.push(summaryRow(c.key, c.with, c.without));

  lines.push('');
  lines.push('See `METHODOLOGY.md` (in `tools/portfolio-sim/`) before citing any number above.');

  return lines.join('\n') + '\n';
}

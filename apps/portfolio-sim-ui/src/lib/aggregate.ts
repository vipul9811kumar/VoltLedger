import type { SimLoanOutcome } from '@voltledger/db';

export interface ArmSummary {
  nLoans: number;
  nDefaults: number;
  defaultRatePct: number;
  totalLoanAmountUsd: number;
  totalNetLossUsd: number;
  lossGivenDefaultPct: number;
  netLossRatePct: number;
}

export interface CohortRow {
  key: string;
  with: ArmSummary;
  without: ArmSummary;
  lossDeltaUsd: number;
}

/**
 * Cohort aggregation over the flat SimLoanOutcome DB row shape — the same
 * logic as tools/portfolio-sim/src/aggregate.ts, but that package's version
 * operates on the richer in-memory LoanOutcome shape (nested loan/origination
 * objects) a live run produces, not what's persisted. Reimplemented small
 * rather than forcing an adapter between the two shapes.
 */
export function summarizeArm(outcomes: SimLoanOutcome[]): ArmSummary {
  const defaults = outcomes.filter((o) => o.defaulted);
  const totalLoanAmountUsd = outcomes.reduce((s, o) => s + o.loanAmountUsd, 0);
  const totalNetLossUsd = outcomes.reduce((s, o) => s + o.netLossUsd, 0);
  const defaultedLoanAmountUsd = defaults.reduce((s, o) => s + o.loanAmountUsd, 0);

  return {
    nLoans: outcomes.length,
    nDefaults: defaults.length,
    defaultRatePct: outcomes.length ? (defaults.length / outcomes.length) * 100 : 0,
    totalLoanAmountUsd,
    totalNetLossUsd,
    lossGivenDefaultPct: defaultedLoanAmountUsd ? (totalNetLossUsd / defaultedLoanAmountUsd) * 100 : 0,
    netLossRatePct: totalLoanAmountUsd ? (totalNetLossUsd / totalLoanAmountUsd) * 100 : 0,
  };
}

export function cohortBreakdown(outcomes: SimLoanOutcome[], keyFn: (o: SimLoanOutcome) => string): CohortRow[] {
  const withOutcomes = outcomes.filter((o) => o.arm === 'WITH');
  const withoutOutcomes = outcomes.filter((o) => o.arm === 'WITHOUT');
  const keys = [...new Set(withOutcomes.map(keyFn))].sort();

  return keys.map((key) => {
    const w = summarizeArm(withOutcomes.filter((o) => keyFn(o) === key));
    const wo = summarizeArm(withoutOutcomes.filter((o) => keyFn(o) === key));
    return { key, with: w, without: wo, lossDeltaUsd: wo.totalNetLossUsd - w.totalNetLossUsd };
  });
}

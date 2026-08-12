import type { LoanOutcome } from './types';

export interface ArmSummary {
  nLoans: number;
  nDefaults: number;
  defaultRatePct: number;
  totalLoanAmountUsd: number;
  totalNetLossUsd: number;
  lossGivenDefaultPct: number; // net loss / loan amount, among defaulted loans only
  netLossRatePct: number; // net loss / total loan amount, across the whole book
}

export function summarizeArm(outcomes: LoanOutcome[]): ArmSummary {
  const defaults = outcomes.filter((o) => o.defaulted);
  const totalLoanAmountUsd = outcomes.reduce((s, o) => s + o.origination.loanAmountUsd, 0);
  const totalNetLossUsd = outcomes.reduce((s, o) => s + o.netLossUsd, 0);
  const defaultedLoanAmountUsd = defaults.reduce((s, o) => s + o.origination.loanAmountUsd, 0);

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

export interface CohortBreakdown {
  key: string;
  with: ArmSummary;
  without: ArmSummary;
  lossDeltaUsd: number;
}

export function cohortBreakdown(
  withOutcomes: LoanOutcome[],
  withoutOutcomes: LoanOutcome[],
  keyFn: (o: LoanOutcome) => string,
): CohortBreakdown[] {
  const keys = [...new Set(withOutcomes.map(keyFn))].sort();
  return keys.map((key) => {
    const w = summarizeArm(withOutcomes.filter((o) => keyFn(o) === key));
    const wo = summarizeArm(withoutOutcomes.filter((o) => keyFn(o) === key));
    return { key, with: w, without: wo, lossDeltaUsd: wo.totalNetLossUsd - w.totalNetLossUsd };
  });
}

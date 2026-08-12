import { computeRiskScore, computeResidualValue } from '@voltledger/scoring';
import type { MethodologyParams, LoanOutcome, OriginationResult, SimulatedLoan } from './types';
import { contextAtWeek, telemetryUpToWeek, WEEKS_PER_MONTH } from './score-loan';

function ltvBand(ltvPct: number): keyof MethodologyParams['ltvBandMultipliers'] {
  if (ltvPct < 60) return 'under60';
  if (ltvPct < 75) return '60to75';
  if (ltvPct < 85) return '75to85';
  return 'over85';
}

/**
 * Walks a loan month-by-month over its term using its TRUE (simulated)
 * battery trajectory — the same trajectory in both arms, per Gate D's "what's
 * held constant." Monthly default probability = baseline annual PD (linearly
 * apportioned to monthly, not compounded — a stated simplification, not a
 * fitted hazard curve) x LTV-band multiplier (fixed at origination) x
 * battery-grade multiplier (re-evaluated monthly from the loan's true
 * condition, regardless of what the lender believed at origination).
 *
 * Simplification stated here and in METHODOLOGY.md: no loan amortization —
 * outstanding balance is treated as flat at the originated amount for the
 * loan's life. This affects both arms equally, so the WITH-vs-WITHOUT delta
 * stays meaningful even though absolute loss figures are somewhat
 * overstated versus a real amortizing loan.
 */
export function simulateLoanLifecycle(
  loan: SimulatedLoan,
  origination: OriginationResult,
  params: MethodologyParams,
  rng: () => number,
): LoanOutcome {
  const band = ltvBand(origination.originatedLtvPct);
  const ltvMultiplier = params.ltvBandMultipliers[band];

  for (let month = 1; month <= params.loanTermMonths; month++) {
    const week = loan.ageAtOriginationWeeks + Math.round(month * WEEKS_PER_MONTH);
    const context = contextAtWeek(loan, week);
    const telemetry = telemetryUpToWeek(loan, week);
    const trueRisk = computeRiskScore(context, telemetry);

    const gradeMultiplier = params.gradeMultipliers[trueRisk.grade];
    const monthlyDefaultProbability =
      (params.baselineAnnualDefaultProbability * ltvMultiplier * gradeMultiplier) / 12;

    if (rng() < monthlyDefaultProbability) {
      const residualValue = computeResidualValue(context, trueRisk, loan.vehicleValueUsd);
      const grossRecovery =
        residualValue.currentBatteryValueUsd * (1 - params.repossessionLiquidationDiscountPct / 100);
      const realizedRecoveryUsd = Math.max(0, Math.min(grossRecovery, origination.loanAmountUsd));
      const netLossUsd = Math.max(0, origination.loanAmountUsd - realizedRecoveryUsd);

      return {
        loan,
        arm: origination.arm,
        origination,
        defaulted: true,
        defaultMonth: month,
        realizedRecoveryUsd,
        netLossUsd,
      };
    }
  }

  return {
    loan,
    arm: origination.arm,
    origination,
    defaulted: false,
    defaultMonth: null,
    realizedRecoveryUsd: null,
    netLossUsd: 0,
  };
}

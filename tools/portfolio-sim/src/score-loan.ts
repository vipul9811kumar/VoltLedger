import { computeRiskScore, computeResidualValue, computeLtv, type BatteryContext } from '@voltledger/scoring';
import type { BatteryTelemetryPoint } from '@voltledger/db';
import type { MethodologyParams, OriginationResult, SimulatedLoan } from './types';

export const WEEKS_PER_MONTH = 52 / 12;

/** Builds a synthetic BatteryContext as it would appear at a given week-of-life. */
export function contextAtWeek(loan: SimulatedLoan, week: number): BatteryContext {
  const manufacturedAt = new Date(Date.now() - week * 7 * 24 * 3600 * 1000);
  return {
    id: `sim-${loan.index}`,
    chemistry: loan.chemistry,
    nominalCapacityKwh: loan.capacityKwh,
    manufacturedAt,
  };
}

/**
 * Telemetry points are pure-function inputs to computeRiskScore — it only
 * reads recordedAt/stateOfHealth/cellTempMax/dcFastChargeRatio/stateOfCharge
 * (see packages/scoring/src/risk.ts). Casting rather than constructing full
 * Prisma BatteryTelemetryPoint rows (id, batteryId, etc. are irrelevant to
 * the scoring math and this is a simulation, not a DB write).
 */
function telemetryUpToWeek(loan: SimulatedLoan, week: number): BatteryTelemetryPoint[] {
  const windowStart = Math.max(0, week - 8); // ~2 months of history, like a real lender would have
  return loan.trajectory
    .filter((p) => p.week >= windowStart && p.week <= week)
    .map((p) => ({
      recordedAt: new Date(Date.now() - (week - p.week) * 7 * 24 * 3600 * 1000),
      stateOfHealth: p.soh,
      stateOfCharge: p.stateOfCharge,
      cellTempMax: p.cellTempMax,
      dcFastChargeRatio: p.dcFastChargeRatio,
    })) as unknown as BatteryTelemetryPoint[];
}

/** WITH arm: real production scoring drives the LTV cap and pricing. */
export function scoreWithSignal(loan: SimulatedLoan): OriginationResult {
  const context = contextAtWeek(loan, loan.ageAtOriginationWeeks);
  const telemetry = telemetryUpToWeek(loan, loan.ageAtOriginationWeeks);

  const risk = computeRiskScore(context, telemetry);
  const residualValue = computeResidualValue(context, risk, loan.vehicleValueUsd);
  const ltv = computeLtv({ id: context.id }, risk, residualValue);

  return {
    arm: 'WITH',
    originatedLtvPct: ltv.recommendedLtv * 100,
    loanAmountUsd: Math.min(loan.requestedLoanAmountUsd, ltv.maxLoanAmountUsd),
    rateBps: ltv.totalRateBps,
    grade: risk.grade,
  };
}

/** WITHOUT arm: flat policy, battery condition never enters the decision (Gate D). */
export function scoreWithoutSignal(loan: SimulatedLoan, params: MethodologyParams): OriginationResult {
  const flatLtvUsd = loan.vehicleValueUsd * (params.withoutPolicyFlatLtvPct / 100);
  return {
    arm: 'WITHOUT',
    originatedLtvPct: params.withoutPolicyFlatLtvPct,
    loanAmountUsd: Math.min(loan.requestedLoanAmountUsd, flatLtvUsd),
    rateBps: params.withoutPolicyFlatRateBps,
    grade: null,
  };
}

export { telemetryUpToWeek };

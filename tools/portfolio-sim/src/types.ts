export interface MethodologyParams {
  baselineAnnualDefaultProbability: number;
  ltvBandMultipliers: { under60: number; '60to75': number; '75to85': number; over85: number };
  gradeMultipliers: { A: number; B: number; C: number; D: number; F: number };
  withoutPolicyFlatLtvPct: number;
  withoutPolicyFlatRateBps: number;
  repossessionLiquidationDiscountPct: number;
  loanTermMonths: number;
}

export interface SimulatedLoan {
  index: number;
  chemistry: 'LFP' | 'NMC' | 'NCA';
  segment: string; // USAGE_PROFILES name
  manufacturer: string;
  modelName: string;
  capacityKwh: number;
  nominalVoltageV: number;
  /** Battery age (weeks since manufacture) at loan origination — used to seed BatteryContext.manufacturedAt. */
  ageAtOriginationWeeks: number;
  vehicleValueUsd: number;
  requestedLoanAmountUsd: number;
  /** Full degradation trajectory from manufacture, weekly, covering origination through loan term. */
  trajectory: Array<{
    week: number;
    soh: number;
    cellTempMax: number;
    dcFastChargeRatio: number;
    stateOfCharge: number;
  }>;
}

export type Arm = 'WITH' | 'WITHOUT';

export interface OriginationResult {
  arm: Arm;
  originatedLtvPct: number;
  loanAmountUsd: number;
  rateBps: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null; // null for WITHOUT — battery condition not used
}

export interface LoanOutcome {
  loan: SimulatedLoan;
  arm: Arm;
  origination: OriginationResult;
  defaulted: boolean;
  defaultMonth: number | null;
  realizedRecoveryUsd: number | null;
  netLossUsd: number;
}

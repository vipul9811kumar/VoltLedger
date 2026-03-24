/**
 * Risk scoring and valuation types for VoltLedger
 */

import type { RiskGrade } from './battery';

export interface RiskScore {
  id: string;
  batteryId: string;
  scoredAt: string;
  grade: RiskGrade;           // A–F composite
  compositeScore: number;     // 0–1000 (higher = lower risk, like FICO)

  // Sub-scores (0–100 each)
  degradationScore: number;   // How fast SoH is declining
  thermalScore: number;       // Thermal management health
  usagePatternScore: number;  // DCFC ratio, charge depth patterns
  capacityRetentionScore: number; // Current vs nominal capacity
  ageAdjustedScore: number;   // Normalized for vehicle age

  // Flags
  abnormalDegradation: boolean;
  thermalAnomalyDetected: boolean;
  highDcfcUsage: boolean;     // >40% DCFC
  deepDischargeHistory: boolean;

  modelVersion: string;
  confidenceLevel: number;    // 0–1
}

export interface ResidualValueEstimate {
  id: string;
  batteryId: string;
  estimatedAt: string;
  vehicleMarketValueUsd: number;
  batteryResidualValueUsd: number;
  batteryValueAsPercentOfVehicle: number; // typically 50–70%

  // Forecasts
  residualAt12Months: number;
  residualAt24Months: number;
  residualAt36Months: number;

  // Confidence intervals (95%)
  confidenceLow: number;
  confidenceHigh: number;

  baseMarketDataSource: string;  // e.g. "BlackBook", "NADA", "auction_avg"
  modelVersion: string;
}

export interface DegradationForecast {
  id: string;
  batteryId: string;
  forecastedAt: string;
  currentSoH: number;

  // Predicted SoH at future points
  sohAt6Months: number;
  sohAt12Months: number;
  sohAt24Months: number;
  sohAt36Months: number;
  sohAt60Months: number;

  // When SoH hits key thresholds (ISO 8601 or null if never in range)
  projectedDate80Percent: string | null;  // EoL for many use cases
  projectedDate70Percent: string | null;  // Second-life threshold
  projectedDate60Percent: string | null;

  modelVersion: string;
  confidenceLevel: number;
}

export interface LtvRecommendation {
  id: string;
  batteryId: string;
  loanApplicationId?: string;
  recommendedAt: string;

  recommendedLtvPercent: number;     // e.g. 75 = 75% LTV
  maxLtvPercent: number;             // Hard ceiling
  adjustedResidualValueUsd: number;

  riskPremiumBps: number;            // Basis points adjustment to rate
  rationale: string;                 // Human-readable explanation

  // Input parameters used
  requestedLoanAmountUsd: number;
  vehiclePurchasePriceUsd: number;
  loanTermMonths: number;

  modelVersion: string;
  certificateHash?: string;          // Polygon L2 notarization
}

export interface SecondLifeAssessment {
  id: string;
  batteryId: string;
  assessedAt: string;
  currentSoH: number;
  isViable: boolean;

  viabilityScore: number;   // 0–100
  recommendedUseCase: SecondLifeUseCase | null;

  estimatedRemainingUsefulLifeYears: number;
  estimatedSecondLifeValueUsd: number;

  disqualifiers: string[];  // Reasons if not viable
  modelVersion: string;
}

export type SecondLifeUseCase =
  | 'STATIONARY_STORAGE_GRID'
  | 'STATIONARY_STORAGE_COMMERCIAL'
  | 'STATIONARY_STORAGE_RESIDENTIAL'
  | 'EV_FLEET_LOWER_DEMAND'
  | 'REFURBISHMENT_RESALE'
  | 'RECYCLING_ONLY';

/**
 * Second-Life Viability Assessor
 * Determines the best second-life use case for a battery based on SoH, risk profile, and chemistry.
 */

import type { RiskScoreResult } from './risk';
import type { BatteryContext } from './risk';
import { SECOND_LIFE_THRESHOLDS } from './constants';

export type SecondLifeUseCase =
  | 'EV_FLEET'
  | 'STATIONARY_GRID'
  | 'STATIONARY_COMMERCIAL'
  | 'STATIONARY_RESIDENTIAL'
  | 'REFURBISHMENT'
  | 'RECYCLING_ONLY';

export interface SecondLifeResult {
  batteryId:          string;
  currentSoH:         number;
  recommendedUseCase: SecondLifeUseCase;
  useCaseLabel:       string;
  estimatedRemainingLifeYears: number;
  suitabilityScore:   number;   // 0–100
  disqualifiers:      string[];
  notes:              string;
}

const USE_CASE_LABELS: Record<SecondLifeUseCase, string> = {
  EV_FLEET:               'Electric Vehicle Fleet (reduced range)',
  STATIONARY_GRID:        'Stationary Grid Storage',
  STATIONARY_COMMERCIAL:  'Stationary Commercial Storage',
  STATIONARY_RESIDENTIAL: 'Stationary Residential Storage',
  REFURBISHMENT:          'Battery Refurbishment / Reconditioning',
  RECYCLING_ONLY:         'Recycling / Materials Recovery',
};

/**
 * Estimate remaining useful life based on chemistry degradation curve.
 * Returns years until SoH drops to 60% (below all second-life thresholds).
 */
function estimateRemainingLife(
  currentSoH: number,
  chemistry: string,
  ageYears: number,
): number {
  // Simple linear extrapolation: assume current degradation rate continues
  // Degradation rate from chemistry benchmarks: ~2%/yr for NMC, ~1.5%/yr for LFP
  const degRateByChemistry: Record<string, number> = {
    LFP: 1.4,
    NMC: 2.0,
    NCA: 2.5,
    LTO: 0.5,
  };
  const annualDeg = degRateByChemistry[chemistry] ?? 2.0;

  // Years until reaching 60% SoH floor
  const remaining = Math.max(0, (currentSoH - 60) / annualDeg);
  return Math.round(remaining * 10) / 10;
}

function determineSoH(riskScore: RiskScoreResult): number {
  // Reconstruct SoH from capacityRetentionScore: score = (soh - 60) / 40 * 100
  return riskScore.capacityRetentionScore * 0.4 + 60;
}

export function assessSecondLife(
  battery: BatteryContext,
  riskScore: RiskScoreResult,
): SecondLifeResult {
  const chemistry = battery.chemistry || 'NMC';
  const ageYears = battery.manufacturedAt
    ? (Date.now() - new Date(battery.manufacturedAt).getTime()) / (365.25 * 24 * 3600 * 1000)
    : 2;

  const currentSoH = determineSoH(riskScore);
  const disqualifiers: string[] = [];

  // Hard disqualifiers that bump down from higher tiers
  if (riskScore.thermalAnomalyDetected)
    disqualifiers.push('Thermal anomaly history — grid/fleet deployment risky');
  if (riskScore.abnormalDegradation)
    disqualifiers.push('Abnormal degradation — reduced remaining life estimate');
  if (riskScore.grade === 'F')
    disqualifiers.push('Critical risk grade — requires full diagnostic before reuse');

  // Determine use case from SoH thresholds + disqualifiers
  let useCase: SecondLifeUseCase;

  if (currentSoH >= SECOND_LIFE_THRESHOLDS.EV_FLEET && disqualifiers.length === 0) {
    useCase = 'EV_FLEET';
  } else if (currentSoH >= SECOND_LIFE_THRESHOLDS.STATIONARY_GRID) {
    useCase = 'STATIONARY_GRID';
  } else if (currentSoH >= SECOND_LIFE_THRESHOLDS.STATIONARY_COMMERCIAL) {
    useCase = 'STATIONARY_COMMERCIAL';
  } else if (currentSoH >= SECOND_LIFE_THRESHOLDS.STATIONARY_RESIDENTIAL) {
    useCase = 'STATIONARY_RESIDENTIAL';
  } else if (currentSoH >= SECOND_LIFE_THRESHOLDS.REFURBISHMENT) {
    useCase = 'REFURBISHMENT';
  } else {
    useCase = 'RECYCLING_ONLY';
  }

  // Suitability score: how well it fits the recommended use case
  // 100 = perfect fit, lower = marginal
  const thresholdForUseCase = SECOND_LIFE_THRESHOLDS[useCase] ?? 0;
  const nextThreshold = useCase !== 'EV_FLEET'
    ? Object.values(SECOND_LIFE_THRESHOLDS).find(t => t > thresholdForUseCase) ?? 100
    : 100;
  const suitabilityScore = useCase === 'RECYCLING_ONLY'
    ? Math.round(currentSoH)
    : Math.round(
        Math.min(100, ((currentSoH - thresholdForUseCase) / (nextThreshold - thresholdForUseCase)) * 50 + 50)
      );

  const remainingLife = estimateRemainingLife(currentSoH, chemistry, ageYears);

  const notes = [
    `Current SoH: ${Math.round(currentSoH * 10) / 10}%.`,
    `Estimated ${remainingLife} years of useful life remaining.`,
    useCase === 'RECYCLING_ONLY'
      ? 'Battery has reached end of usable life. Recommend materials recovery.'
      : `Suitable for: ${USE_CASE_LABELS[useCase]}.`,
  ].join(' ');

  return {
    batteryId:                  battery.id,
    currentSoH:                 Math.round(currentSoH * 10) / 10,
    recommendedUseCase:         useCase,
    useCaseLabel:               USE_CASE_LABELS[useCase],
    estimatedRemainingLifeYears: remainingLife,
    suitabilityScore,
    disqualifiers,
    notes,
  };
}

/**
 * Risk scoring engine — computes 5 sub-scores → composite (0–1000) → grade (A–F)
 */

import type { BatteryTelemetryPoint } from '@voltledger/db';
import {
  GRADE_THRESHOLDS,
  SUB_SCORE_WEIGHTS,
  EXPECTED_SOH_BY_CHEMISTRY,
  THERMAL_THRESHOLDS,
  DCFC_THRESHOLDS,
  MODEL_VERSION,
} from './constants';

export interface BatteryContext {
  id: string;
  chemistry: string;
  nominalCapacityKwh: number;
  manufacturedAt: Date | null;
}

export interface RiskScoreResult {
  batteryId:             string;
  compositeScore:        number;
  grade:                 'A' | 'B' | 'C' | 'D' | 'F';
  degradationScore:      number;
  thermalScore:          number;
  usagePatternScore:     number;
  capacityRetentionScore:number;
  ageAdjustedScore:      number;
  abnormalDegradation:   boolean;
  thermalAnomalyDetected:boolean;
  highDcfcUsage:         boolean;
  deepDischargeHistory:  boolean;
  confidenceLevel:       number;
  modelVersion:          string;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

/** Interpolate expected SoH for a given age in years */
function expectedSoH(chemistry: string, ageYears: number): number {
  const curve = EXPECTED_SOH_BY_CHEMISTRY[chemistry] ?? EXPECTED_SOH_BY_CHEMISTRY['NMC'];
  const idx = Math.min(Math.floor(ageYears), curve.length - 2);
  const frac = ageYears - idx;
  return curve[idx] + frac * (curve[idx + 1] - curve[idx]);
}

/**
 * 1. Degradation Score (0–100)
 * How fast is SoH declining vs expected for this chemistry + age?
 * Uses the last 8 weeks of telemetry to compute degradation rate.
 */
function scoreDegradation(
  points: Pick<BatteryTelemetryPoint, 'stateOfHealth' | 'recordedAt'>[],
  chemistry: string,
  ageYears: number,
): { score: number; abnormal: boolean } {
  if (points.length < 2) return { score: 75, abnormal: false };

  const sorted = [...points].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );

  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const currentSoH = newest.stateOfHealth;

  // Actual degradation rate: % SoH lost per year
  const spanYears =
    (new Date(newest.recordedAt).getTime() - new Date(oldest.recordedAt).getTime()) /
    (365.25 * 24 * 3600 * 1000);

  if (spanYears < 0.01) return { score: 80, abnormal: false };

  const actualDegRate = (oldest.stateOfHealth - newest.stateOfHealth) / spanYears;

  // Expected degradation rate for chemistry
  const expSoHNow  = expectedSoH(chemistry, ageYears);
  const expSoHPrev = expectedSoH(chemistry, Math.max(0, ageYears - spanYears));
  const expectedDegRate = Math.max(0, (expSoHPrev - expSoHNow) / spanYears);

  // Ratio: how much faster than expected?
  const ratio = expectedDegRate > 0 ? actualDegRate / expectedDegRate : 1;

  // Score: 100 if degrading at expected rate or slower, 0 if 3× faster
  const score = clamp(100 - (ratio - 1) * 50);

  // Also penalise if absolute SoH is low for age
  const soHDelta = currentSoH - expSoHNow;
  const absolutePenalty = clamp(soHDelta * 2 + 50, 0, 100); // centred at expected SoH
  const combined = score * 0.6 + absolutePenalty * 0.4;

  return {
    score:    Math.round(clamp(combined)),
    abnormal: ratio > 2.0 || currentSoH < expSoHNow - 10,
  };
}

/**
 * 2. Thermal Score (0–100)
 * Based on average and peak cell temperatures over recent history.
 */
function scoreThermal(
  points: Pick<BatteryTelemetryPoint, 'cellTempMax' | 'cellTempAvg'>[],
  chemistry: string,
): { score: number; anomaly: boolean } {
  if (points.length === 0) return { score: 75, anomaly: false };

  const thresholds = THERMAL_THRESHOLDS[chemistry as keyof typeof THERMAL_THRESHOLDS]
    ?? THERMAL_THRESHOLDS.NMC;

  const avgMax = points.reduce((s, p) => s + p.cellTempMax, 0) / points.length;
  const avgAvg = points.reduce((s, p) => s + p.cellTempAvg, 0) / points.length;
  const peakMax = Math.max(...points.map(p => p.cellTempMax));

  // Score based on average max temperature relative to thresholds
  let score: number;
  if (avgMax <= thresholds.optimal + 5) {
    score = 95;
  } else if (avgMax <= thresholds.warn) {
    score = 95 - ((avgMax - thresholds.optimal - 5) / (thresholds.warn - thresholds.optimal - 5)) * 30;
  } else if (avgMax <= thresholds.critical) {
    score = 65 - ((avgMax - thresholds.warn) / (thresholds.critical - thresholds.warn)) * 40;
  } else {
    score = Math.max(0, 25 - (avgMax - thresholds.critical) * 2);
  }

  // Additional penalty for sustained high average
  if (avgAvg > thresholds.warn - 5) score -= 10;

  return {
    score:   Math.round(clamp(score)),
    anomaly: peakMax > thresholds.critical || avgMax > thresholds.warn,
  };
}

/**
 * 3. Usage Pattern Score (0–100)
 * DCFC ratio, charging frequency, depth of discharge.
 */
function scoreUsagePattern(
  points: Pick<BatteryTelemetryPoint, 'dcFastChargeRatio' | 'stateOfCharge' | 'chargingEvents24h'>[],
): { score: number; highDcfc: boolean; deepDischarge: boolean } {
  const withDcfc = points.filter(p => p.dcFastChargeRatio != null);
  const avgDcfc = withDcfc.length > 0
    ? withDcfc.reduce((s, p) => s + (p.dcFastChargeRatio ?? 0), 0) / withDcfc.length
    : 0;

  // DCFC penalty
  let dcfcScore: number;
  if (avgDcfc <= DCFC_THRESHOLDS.LOW)          dcfcScore = 100;
  else if (avgDcfc <= DCFC_THRESHOLDS.MODERATE) dcfcScore = 85;
  else if (avgDcfc <= DCFC_THRESHOLDS.HIGH)     dcfcScore = 65;
  else if (avgDcfc <= DCFC_THRESHOLDS.CRITICAL) dcfcScore = 40;
  else                                           dcfcScore = 20;

  // Deep discharge penalty — frequent low SoC readings
  const withSoC = points.filter(p => p.stateOfCharge != null);
  const deepDischargeCount = withSoC.filter(p => (p.stateOfCharge ?? 100) < 10).length;
  const deepDischargePct = withSoC.length > 0 ? deepDischargeCount / withSoC.length : 0;
  const deepDischargeScore = Math.max(0, 100 - deepDischargePct * 300);

  const score = dcfcScore * 0.65 + deepDischargeScore * 0.35;

  return {
    score:        Math.round(clamp(score)),
    highDcfc:     avgDcfc > DCFC_THRESHOLDS.HIGH,
    deepDischarge:deepDischargePct > 0.05,
  };
}

/**
 * 4. Capacity Retention Score (0–100)
 * Direct function of current SoH — simpler and more intuitive.
 */
function scoreCapacityRetention(latestSoH: number): number {
  // 100% SoH → 100, 80% SoH → 50, 60% SoH → 0
  return Math.round(clamp((latestSoH - 60) / 40 * 100));
}

/**
 * 5. Age-Adjusted Score (0–100)
 * SoH vs expected for battery's age and chemistry.
 * A 5-year-old LFP at 90% is great; a 1-year-old NMC at 90% is concerning.
 */
function scoreAgeAdjusted(currentSoH: number, chemistry: string, ageYears: number): number {
  const expected = expectedSoH(chemistry, ageYears);
  const delta = currentSoH - expected;
  // +10 above expected → 100, at expected → 70, -10 below → 20
  const score = 70 + delta * 3;
  return Math.round(clamp(score));
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeRiskScore(
  battery: BatteryContext,
  recentPoints: BatteryTelemetryPoint[],
): RiskScoreResult {
  const chemistry = battery.chemistry || 'NMC';
  const ageYears = battery.manufacturedAt
    ? (Date.now() - new Date(battery.manufacturedAt).getTime()) / (365.25 * 24 * 3600 * 1000)
    : 2; // fallback: assume 2 years

  const latestSoH = recentPoints.at(-1)?.stateOfHealth ?? 85;

  const { score: degScore, abnormal } = scoreDegradation(recentPoints, chemistry, ageYears);
  const { score: thermalScore, anomaly } = scoreThermal(recentPoints, chemistry);
  const { score: usageScore, highDcfc, deepDischarge } = scoreUsagePattern(recentPoints);
  const capScore  = scoreCapacityRetention(latestSoH);
  const ageScore  = scoreAgeAdjusted(latestSoH, chemistry, ageYears);

  // Weighted composite → 0–100 → scale to 0–1000
  const composite100 =
    degScore     * SUB_SCORE_WEIGHTS.degradation +
    thermalScore * SUB_SCORE_WEIGHTS.thermalScore +
    usageScore   * SUB_SCORE_WEIGHTS.usagePattern +
    capScore     * SUB_SCORE_WEIGHTS.capacityRetention +
    ageScore     * SUB_SCORE_WEIGHTS.ageAdjusted;

  const compositeScore = Math.round(clamp(composite100, 0, 100) * 10);
  const confidenceLevel = Math.min(1, recentPoints.length / 12); // full confidence at 12+ points

  return {
    batteryId:              battery.id,
    compositeScore,
    grade:                  gradeFromScore(compositeScore),
    degradationScore:       degScore,
    thermalScore,
    usagePatternScore:      usageScore,
    capacityRetentionScore: capScore,
    ageAdjustedScore:       ageScore,
    abnormalDegradation:    abnormal,
    thermalAnomalyDetected: anomaly,
    highDcfcUsage:          highDcfc,
    deepDischargeHistory:   deepDischarge,
    confidenceLevel:        Math.round(confidenceLevel * 100) / 100,
    modelVersion:           MODEL_VERSION,
  };
}

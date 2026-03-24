/**
 * SoH Degradation Forecast
 * Projects future SoH trajectory using recent degradation rate + chemistry benchmarks.
 */

import type { BatteryTelemetryPoint } from '@voltledger/db';
import type { BatteryContext } from './risk';
import { EXPECTED_SOH_BY_CHEMISTRY } from './constants';

export interface ForecastPoint {
  monthsFromNow: number;
  estimatedSoH:  number;
  lowerBound:    number;   // 10th percentile
  upperBound:    number;   // 90th percentile
}

export interface DegradationForecastResult {
  batteryId:          string;
  currentSoH:         number;
  observedDegRateYearly: number;   // % SoH lost per year (observed)
  expectedDegRateYearly: number;   // % SoH lost per year (chemistry benchmark)
  forecastPoints:     ForecastPoint[];  // 3, 6, 12, 24, 36, 60 months
  monthsTo80Pct:      number | null;   // months until SoH hits 80%
  monthsTo70Pct:      number | null;
  confidenceLevel:    number;
}

function expectedSoHAtYear(chemistry: string, ageYears: number): number {
  const curve =
    (EXPECTED_SOH_BY_CHEMISTRY as Record<string, number[]>)[chemistry] ??
    EXPECTED_SOH_BY_CHEMISTRY['NMC'];
  const idx = Math.min(Math.floor(ageYears), curve.length - 2);
  const frac = ageYears - idx;
  return curve[idx] + frac * (curve[idx + 1] - curve[idx]);
}

function monthsUntilSoH(
  currentSoH: number,
  targetSoH: number,
  degRateYearly: number,
): number | null {
  if (currentSoH <= targetSoH) return 0;
  if (degRateYearly <= 0) return null;
  return Math.round((currentSoH - targetSoH) / degRateYearly * 12);
}

export function computeDegradationForecast(
  battery: BatteryContext,
  recentPoints: BatteryTelemetryPoint[],
): DegradationForecastResult {
  const chemistry = battery.chemistry || 'NMC';
  const ageYears = battery.manufacturedAt
    ? (Date.now() - new Date(battery.manufacturedAt).getTime()) / (365.25 * 24 * 3600 * 1000)
    : 2;

  const sorted = [...recentPoints].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );

  const currentSoH = sorted.at(-1)?.stateOfHealth ?? 85;
  const confidenceLevel = Math.min(1, recentPoints.length / 12);

  // Observed degradation rate from telemetry
  let observedDegRate = 0;
  if (sorted.length >= 2) {
    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];
    const spanYears =
      (new Date(newest.recordedAt).getTime() - new Date(oldest.recordedAt).getTime()) /
      (365.25 * 24 * 3600 * 1000);
    if (spanYears > 0.01) {
      observedDegRate = Math.max(0, (oldest.stateOfHealth - newest.stateOfHealth) / spanYears);
    }
  }

  // Expected degradation rate from chemistry benchmarks
  const expSoHNow  = expectedSoHAtYear(chemistry, ageYears);
  const expSoHPrev = expectedSoHAtYear(chemistry, Math.max(0, ageYears - 1));
  const expectedDegRate = Math.max(0, expSoHPrev - expSoHNow);

  // Blended forecast rate: weight observed rate by confidence, fall back to expected
  const forecastDegRate = confidenceLevel * observedDegRate + (1 - confidenceLevel) * expectedDegRate;

  // Uncertainty band: ±30% of forecast rate, wider at low confidence
  const uncertaintyFactor = 0.3 + (1 - confidenceLevel) * 0.3;

  const targetMonths = [3, 6, 12, 24, 36, 60];
  const forecastPoints: ForecastPoint[] = targetMonths.map(months => {
    const years = months / 12;
    const estimatedSoH = Math.max(0, currentSoH - forecastDegRate * years);
    const band = forecastDegRate * years * uncertaintyFactor;
    return {
      monthsFromNow: months,
      estimatedSoH:  Math.round(estimatedSoH * 10) / 10,
      lowerBound:    Math.round(Math.max(0, estimatedSoH - band) * 10) / 10,
      upperBound:    Math.round(Math.min(100, estimatedSoH + band) * 10) / 10,
    };
  });

  return {
    batteryId:               battery.id,
    currentSoH:              Math.round(currentSoH * 10) / 10,
    observedDegRateYearly:   Math.round(observedDegRate * 100) / 100,
    expectedDegRateYearly:   Math.round(expectedDegRate * 100) / 100,
    forecastPoints,
    monthsTo80Pct:           monthsUntilSoH(currentSoH, 80, forecastDegRate),
    monthsTo70Pct:           monthsUntilSoH(currentSoH, 70, forecastDegRate),
    confidenceLevel:         Math.round(confidenceLevel * 100) / 100,
  };
}

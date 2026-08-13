/**
 * Residual Value Model
 * Estimates current and projected battery value using SoH, age, chemistry, and market factors.
 */

import type { RiskScoreResult } from './risk';
import type { BatteryContext } from './risk';
import type { ReconciledSoH } from '@voltledger/types';
import {
  BATTERY_VALUE_PCT,
  MARKET_DEPRECIATION_RATE,
  EXPECTED_SOH_BY_CHEMISTRY,
  DATALESS_SOH_ASSUMPTION,
} from './constants';

export interface ResidualValueResult {
  batteryId:            string;
  vehicleValueUsd:      number;
  currentBatteryValueUsd: number;
  residualPct:          number;   // current battery value as % of original battery value
  forecast12m:          number;   // estimated value 12 months from now
  forecast24m:          number;
  forecast36m:          number;
  forecast60m:          number;
  monthlyForecast:      Array<{ month: number; valueUsd: number; sohEstimate: number }>;
  methodology:          string;
  sohUsed:              number;               // actual SoH fed into computeValueAtAge
  sohSourceUsed:        string;                // ReconciledSoH['source'] | 'PROXY'
  dataLessBatteryValueUsd: number;             // counterfactual RV at DATALESS_SOH_ASSUMPTION
  verificationUpliftUsd:   number;             // currentBatteryValueUsd - dataLessBatteryValueUsd (0 unless verified)
}

/** Expected SoH at a future year (simplified linear interpolation) */
function expectedSoHAtYear(chemistry: string, ageYears: number): number {
  const curve =
    (EXPECTED_SOH_BY_CHEMISTRY as Record<string, number[]>)[chemistry] ??
    EXPECTED_SOH_BY_CHEMISTRY['NMC'];
  const idx = Math.min(Math.floor(ageYears), curve.length - 2);
  const frac = ageYears - idx;
  return curve[idx] + frac * (curve[idx + 1] - curve[idx]);
}

/**
 * Battery value = vehicleValue × batteryValuePct × sohFactor × marketDepreciation
 *
 * sohFactor: linear 1.0 at 100% SoH → 0.0 at 60% SoH (below 60% near-worthless for EV)
 * marketDepreciation: compound annual rate accounting for falling battery prices and demand
 */
function computeValueAtAge(
  vehicleValueUsd: number,
  chemistry: string,
  soh: number,
  ageYears: number,
): number {
  const batteryPct =
    (BATTERY_VALUE_PCT as Record<string, number>)[chemistry] ?? BATTERY_VALUE_PCT['NMC'];
  const depRate =
    (MARKET_DEPRECIATION_RATE as Record<string, number>)[chemistry] ??
    MARKET_DEPRECIATION_RATE['NMC'];

  const originalBatteryValue = vehicleValueUsd * batteryPct;

  // SoH factor: 1.0 at 100% SoH, 0 at 60%, linear
  const sohFactor = Math.max(0, (soh - 60) / 40);

  // Market depreciation over battery age
  const marketFactor = Math.pow(1 - depRate, ageYears);

  return Math.round(originalBatteryValue * sohFactor * marketFactor * 100) / 100;
}

export function computeResidualValue(
  battery: BatteryContext,
  riskScore: RiskScoreResult,
  vehicleValueUsd: number,
  reconciledSoH?: ReconciledSoH,
): ResidualValueResult {
  const chemistry = battery.chemistry || 'NMC';
  const ageYears = battery.manufacturedAt
    ? (Date.now() - new Date(battery.manufacturedAt).getTime()) / (365.25 * 24 * 3600 * 1000)
    : 2;

  // Prefer the reconciled (passport/telemetry) SoH directly when available. Falling
  // back to a capacityRetentionScore-derived proxy otherwise — that proxy is a lossy
  // re-inversion of an already-clamped [0,100] sub-score (capacityRetentionScore: 100 →
  // SoH=100, 50 → SoH=80, 0 → SoH=60), so it silently floors at SoH=60 and overstates
  // value for genuinely degraded batteries below that. Real SoH data removes the floor.
  const sohSourceUsed = reconciledSoH?.source ?? 'PROXY';
  const currentSoH = reconciledSoH
    ? reconciledSoH.value
    : riskScore.capacityRetentionScore * 0.4 + 60;

  const currentValue = computeValueAtAge(vehicleValueUsd, chemistry, currentSoH, ageYears);

  // Verification uplift: $ value of actually-observed SoH data vs. a complete guess.
  // Uses the same DATALESS_SOH_ASSUMPTION that reconcileSoH()'s 'NONE' fallback uses,
  // so the two "no data" baselines can't drift apart.
  const dataLessValue = computeValueAtAge(vehicleValueUsd, chemistry, DATALESS_SOH_ASSUMPTION, ageYears);
  const isVerifiedSource = sohSourceUsed === 'PASSPORT' || sohSourceUsed === 'TELEMETRY' || sohSourceUsed === 'BLENDED';
  const verificationUpliftUsd = isVerifiedSource ? Math.round((currentValue - dataLessValue) * 100) / 100 : 0;

  const batteryPct =
    (BATTERY_VALUE_PCT as Record<string, number>)[chemistry] ?? BATTERY_VALUE_PCT['NMC'];
  const originalBatteryValue = vehicleValueUsd * batteryPct;
  const residualPct = originalBatteryValue > 0
    ? Math.round((currentValue / originalBatteryValue) * 1000) / 10
    : 0;

  // Generate monthly forecast for 60 months
  const monthlyForecast: Array<{ month: number; valueUsd: number; sohEstimate: number }> = [];
  for (let month = 1; month <= 60; month++) {
    const futureAgeYears = ageYears + month / 12;
    const futureSoH = expectedSoHAtYear(chemistry, futureAgeYears);
    const value = computeValueAtAge(vehicleValueUsd, chemistry, futureSoH, futureAgeYears);
    monthlyForecast.push({
      month,
      valueUsd: value,
      sohEstimate: Math.round(futureSoH * 10) / 10,
    });
  }

  const forecast12m = monthlyForecast[11]?.valueUsd ?? 0;
  const forecast24m = monthlyForecast[23]?.valueUsd ?? 0;
  const forecast36m = monthlyForecast[35]?.valueUsd ?? 0;
  const forecast60m = monthlyForecast[59]?.valueUsd ?? 0;

  return {
    batteryId:              battery.id,
    vehicleValueUsd,
    currentBatteryValueUsd: currentValue,
    residualPct,
    forecast12m,
    forecast24m,
    forecast36m,
    forecast60m,
    monthlyForecast,
    methodology:            'soh-market-v2',
    sohUsed:                currentSoH,
    sohSourceUsed,
    dataLessBatteryValueUsd: dataLessValue,
    verificationUpliftUsd,
  };
}

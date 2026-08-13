/**
 * WS-C calibration step — REPORT ONLY, does not force-fit constants.
 *
 * Original plan considered mechanically adjusting MARKET_DEPRECIATION_RATE until each
 * chemistry's implied 3yr battery retention fell inside the Autovista %RV band. The actual
 * numbers (see below) showed that would require inflating MARKET_DEPRECIATION_RATE by
 * roughly 3-4x across chemistries — because Autovista's %RV is *whole-vehicle* retention
 * (glider wear, mileage, brand depreciation) while this model's `residualPct` is *battery-
 * value-only* retention. Forcing the two to match would make MARKET_DEPRECIATION_RATE
 * silently absorb non-battery depreciation it was never meant to represent — corrupting a
 * constant that also drives the 12/24/36/60m forecast curves, second-life valuation, and
 * WS-D's portfolio-sim recovery model.
 *
 * Decision (confirmed with the user, 2026-08-13): report the gap honestly, leave
 * MARKET_DEPRECIATION_RATE / BATTERY_VALUE_PCT unchanged. Real battery-specific market data
 * would be needed to responsibly close it.
 */
import {
  EXPECTED_SOH_BY_CHEMISTRY,
  MARKET_DEPRECIATION_RATE,
  BATTERY_VALUE_PCT,
} from '@voltledger/scoring';
import { loadAutovistaRetentionPoints } from './load-benchmarks';
import type { CalibrationResult, ImpliedRetentionRow } from './types';

const CHEMISTRIES = Object.keys(BATTERY_VALUE_PCT);

/** Mirrors residual-value.ts's computeValueAtAge sohFactor/marketFactor math exactly
 *  (duplicated intentionally — packages/scoring must never import this package, and this
 *  package must never live-import packages/scoring's private helpers; see README). */
function sohFactor(soh: number): number {
  return Math.max(0, (soh - 60) / 40);
}

function marketFactor(depRate: number, ageYears: number): number {
  return Math.pow(1 - depRate, ageYears);
}

export function runCalibration(): CalibrationResult {
  const impliedRetention: ImpliedRetentionRow[] = CHEMISTRIES.map((chem) => {
    const expectedSoHAt3yr = EXPECTED_SOH_BY_CHEMISTRY[chem][3];
    const depRate = (MARKET_DEPRECIATION_RATE as Record<string, number>)[chem];
    const sf = sohFactor(expectedSoHAt3yr);
    const mf = marketFactor(depRate, 3);
    return {
      chemistry: chem,
      expectedSoHAt3yr,
      sohFactor3yr: Math.round(sf * 1000) / 1000,
      marketDepreciationRate: depRate,
      marketFactor3yr: Math.round(mf * 1000) / 1000,
      impliedBatteryRetentionPct3yr: Math.round(sf * mf * 1000) / 10,
    };
  });

  const autovistaPoints = loadAutovistaRetentionPoints();
  const pcts = autovistaPoints.map((p) => p.pctRetention);

  return {
    impliedRetention,
    autovistaBandLowPct: Math.min(...pcts),
    autovistaBandHighPct: Math.max(...pcts),
    autovistaPoints,
  };
}

/**
 * WS-C back-test — Manheim-primary, DIRECTIONAL only.
 *
 * Public Manheim data is a calendar-time wholesale price index with no age/chemistry axis
 * (see data/manheim/DATA_CARD.md), so this cannot be a per-age-band curve-fit error table.
 * Instead: build a small synthetic cohort using only the already-shipped
 * EXPECTED_SOH_BY_CHEMISTRY curve (no noisy generator — same intent as
 * packages/validation's no-synthetic-data guard), run the production RV formula at each real
 * Manheim observation date, and check whether the *direction* of our modeled portfolio's
 * value change matches the real EV Index's direction over the same window.
 *
 * This is expected to disagree often: the model has no notion of macro used-EV market
 * conditions (demand shocks, tax-credit expiry, etc.) — it only ages batteries down a fixed
 * curve. That's a real, stated limitation, not a bug to paper over.
 */
import { EXPECTED_SOH_BY_CHEMISTRY, BATTERY_VALUE_PCT, computeResidualValue } from '@voltledger/scoring';
import type { BatteryContext, RiskScoreResult } from '@voltledger/scoring';
import { loadManheimIndexPoints } from './load-benchmarks';
import type { BacktestResult, BacktestMonthRow } from './types';

const CHEMISTRIES = Object.keys(BATTERY_VALUE_PCT);
const VEHICLE_VALUE_USD = 35_000;
const BASE_AGE_YEARS = 3.0; // matches the Autovista 3yr/60k anchor age

/** Approximate day-of-period, only used to space out the cohort's aging between real
 *  Manheim observation dates — not a claim about the exact release day. */
function approxDateForPeriod(period: string): Date {
  if (period.endsWith('-mid')) {
    const [y, m] = period.replace('-mid', '').split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 15));
  }
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)); // last day of month
}

/** Duplicated from residual-value.ts's private expectedSoHAtYear — intentional, see README. */
function expectedSoHAtYear(chemistry: string, ageYears: number): number {
  const curve = EXPECTED_SOH_BY_CHEMISTRY[chemistry] ?? EXPECTED_SOH_BY_CHEMISTRY['NMC'];
  const idx = Math.min(Math.floor(ageYears), curve.length - 2);
  const frac = ageYears - idx;
  return curve[idx] + frac * (curve[idx + 1] - curve[idx]);
}

const STUB_RISK_SCORE: RiskScoreResult = {
  batteryId: 'rv-backtest-stub',
  compositeScore: 700,
  grade: 'B',
  degradationScore: 80,
  thermalScore: 80,
  usagePatternScore: 80,
  capacityRetentionScore: 80,
  ageAdjustedScore: 80,
  abnormalDegradation: false,
  thermalAnomalyDetected: false,
  highDcfcUsage: false,
  deepDischargeHistory: false,
  confidenceLevel: 0.8,
  modelVersion: '1.0',
  passportVerified: false,
  sohSource: 'NONE',
  passportRationale: [],
};

function modeledPortfolioValue(ageYears: number): number {
  let total = 0;
  for (const chem of CHEMISTRIES) {
    const battery: BatteryContext = {
      id: `rv-backtest-${chem}`,
      chemistry: chem,
      nominalCapacityKwh: 75,
      manufacturedAt: null,
    };
    const soh = expectedSoHAtYear(chem, ageYears);
    const result = computeResidualValue(battery, STUB_RISK_SCORE, VEHICLE_VALUE_USD, {
      value: soh,
      source: 'TELEMETRY',
      confidence: 1,
      telemetrySoH: soh,
    });
    total += result.currentBatteryValueUsd;
  }
  return total;
}

export function runBacktest(): BacktestResult {
  const manheimPoints = loadManheimIndexPoints();
  const dates = manheimPoints.map((p) => approxDateForPeriod(p.period));
  const firstDate = dates[0];

  let prevIndexLevel: number | null = null;
  let baseValue: number | null = null;

  const rows: BacktestMonthRow[] = manheimPoints.map((point, i) => {
    const daysSinceFirst = (dates[i].getTime() - firstDate.getTime()) / (24 * 3600 * 1000);
    const ageYears = BASE_AGE_YEARS + daysSinceFirst / 365.25;
    const portfolioValue = modeledPortfolioValue(ageYears);

    if (baseValue === null) baseValue = portfolioValue;
    const modeledIndexLevel = Math.round((portfolioValue / baseValue) * 1000) / 10; // base = 100.0

    const modeledPctChangeFromPrev =
      prevIndexLevel === null ? null : Math.round(((modeledIndexLevel - prevIndexLevel) / prevIndexLevel) * 1000) / 10;
    prevIndexLevel = modeledIndexLevel;

    let directionAgreement: BacktestMonthRow['directionAgreement'] = 'N/A';
    if (modeledPctChangeFromPrev !== null && point.evIndexPctMoM != null) {
      const sameSign = Math.sign(modeledPctChangeFromPrev) === Math.sign(point.evIndexPctMoM);
      directionAgreement = sameSign ? 'AGREE' : 'DISAGREE';
    }

    return {
      period: point.period,
      releaseLabel: point.releaseLabel,
      modeledIndexLevel,
      modeledPctChangeFromPrev,
      realEvIndexPctYoY: point.evIndexPctYoY,
      realEvIndexPctMoM: point.evIndexPctMoM,
      directionAgreement,
    };
  });

  return { rows, manheimPoints };
}

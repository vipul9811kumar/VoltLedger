/**
 * LTV (Loan-to-Value) Calculator
 * Computes recommended LTV ratio and risk-adjusted loan rate for EV battery collateral.
 */

import type { RiskScoreResult } from './risk';
import type { ResidualValueResult } from './residual-value';
import {
  LTV_BASE,
  LTV_MAX,
  LTV_MIN,
  RISK_PREMIUM_BPS_PER_100_SCORE,
} from './constants';

export interface LtvResult {
  batteryId:          string;
  recommendedLtv:     number;   // 0.0–1.0
  maxLoanAmountUsd:   number;
  baseRateBps:        number;   // base rate in basis points (e.g. 500 = 5.00%)
  riskPremiumBps:     number;   // additional bps from risk score
  totalRateBps:       number;   // baseRateBps + riskPremiumBps
  ltvRationale:       string;
  flagged:            boolean;  // true if battery should trigger manual review
  flagReasons:        string[];
}

/**
 * LTV is adjusted from the base (75%) based on:
 * 1. Risk score (lower score = lower LTV)
 * 2. Hard flags (thermal anomaly, abnormal degradation, high DCFC)
 * 3. Confidence level (low confidence = more conservative)
 */
function calcLtvRatio(riskScore: RiskScoreResult): number {
  // Scale LTV: 1000 score → LTV_MAX, 350 score → LTV_MIN
  const scoreRange = 1000 - 350;
  const ltvRange   = LTV_MAX - LTV_MIN;
  const scoreFraction = Math.max(0, Math.min(1, (riskScore.compositeScore - 350) / scoreRange));
  let ltv = LTV_MIN + scoreFraction * ltvRange;

  // Hard deductions for serious risk flags
  if (riskScore.abnormalDegradation)   ltv -= 0.05;
  if (riskScore.thermalAnomalyDetected) ltv -= 0.03;
  if (riskScore.highDcfcUsage)         ltv -= 0.02;
  if (riskScore.deepDischargeHistory)  ltv -= 0.02;

  // Conservative adjustment for low confidence (< 50% confidence = full penalty)
  if (riskScore.confidenceLevel < 0.5) {
    ltv -= (0.5 - riskScore.confidenceLevel) * 0.10;
  }

  return Math.max(LTV_MIN, Math.min(LTV_MAX, ltv));
}

/**
 * Risk premium: each 100-point drop below 1000 adds RISK_PREMIUM_BPS_PER_100_SCORE bps
 * e.g. score=700 → (1000-700)/100 × 15 = 45 bps premium
 */
function computeRiskPremiumBps(compositeScore: number): number {
  const drop = Math.max(0, 1000 - compositeScore);
  return Math.round((drop / 100) * RISK_PREMIUM_BPS_PER_100_SCORE);
}

export function computeLtv(
  battery: { id: string },
  riskScore: RiskScoreResult,
  residualValue: ResidualValueResult,
  baseRateBps: number = 500,  // default 5.00% base rate
): LtvResult {
  const ltv = calcLtvRatio(riskScore);
  const maxLoanAmountUsd = Math.round(residualValue.currentBatteryValueUsd * ltv * 100) / 100;
  const riskPremiumBps = computeRiskPremiumBps(riskScore.compositeScore);
  const totalRateBps = baseRateBps + riskPremiumBps;

  // Flagging logic
  const flagReasons: string[] = [];
  if (riskScore.abnormalDegradation)   flagReasons.push('Abnormal SoH degradation rate detected');
  if (riskScore.thermalAnomalyDetected) flagReasons.push('Thermal anomaly in recent history');
  if (riskScore.highDcfcUsage)         flagReasons.push('High DC fast-charge usage (>50%)');
  if (riskScore.deepDischargeHistory)  flagReasons.push('Frequent deep discharge events (SoC < 10%)');
  if (riskScore.grade === 'F')         flagReasons.push('Critical risk grade (F)');
  if (riskScore.confidenceLevel < 0.3) flagReasons.push('Low telemetry confidence (< 30%)');

  const ltvPct = Math.round(ltv * 1000) / 10;
  const ltvRationale = [
    `Grade ${riskScore.grade} battery (score ${riskScore.compositeScore}/1000).`,
    `Base LTV ${Math.round(LTV_BASE * 100)}% adjusted to ${ltvPct}%.`,
    riskPremiumBps > 0 ? `Risk premium: +${riskPremiumBps}bps.` : 'No risk premium.',
  ].join(' ');

  return {
    batteryId:        battery.id,
    recommendedLtv:   Math.round(ltv * 1000) / 1000,
    maxLoanAmountUsd,
    baseRateBps,
    riskPremiumBps,
    totalRateBps,
    ltvRationale,
    flagged:          flagReasons.length > 0,
    flagReasons,
  };
}

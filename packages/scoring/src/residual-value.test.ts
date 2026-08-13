import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeResidualValue } from './residual-value';
import type { BatteryContext, RiskScoreResult } from './risk';
import type { ReconciledSoH } from '@voltledger/types';

const battery: BatteryContext = {
  id: 'battery-1',
  chemistry: 'NMC',
  nominalCapacityKwh: 75,
  manufacturedAt: new Date(Date.now() - 3 * 365.25 * 24 * 3600 * 1000), // ~3yr old
};

function riskScoreWith(capacityRetentionScore: number): RiskScoreResult {
  return {
    batteryId: battery.id,
    compositeScore: 700,
    grade: 'B',
    degradationScore: 80,
    thermalScore: 80,
    usagePatternScore: 80,
    capacityRetentionScore,
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
}

const vehicleValueUsd = 35_000;

test('reconciledSoH present: uses .value directly, not the capacityRetentionScore proxy', () => {
  const reconciledSoH: ReconciledSoH = { value: 72, source: 'BLENDED', confidence: 0.9 };
  const result = computeResidualValue(battery, riskScoreWith(30), vehicleValueUsd, reconciledSoH);

  assert.equal(result.sohUsed, 72);
  assert.equal(result.sohSourceUsed, 'BLENDED');
});

test('reconciledSoH omitted: falls back to the legacy proxy formula unchanged (pins tools/portfolio-sim numbers)', () => {
  const riskScore = riskScoreWith(50);
  const result = computeResidualValue(battery, riskScore, vehicleValueUsd);

  const legacyProxySoH = riskScore.capacityRetentionScore * 0.4 + 60; // 80
  assert.equal(result.sohUsed, legacyProxySoH);
  assert.equal(result.sohSourceUsed, 'PROXY');
  assert.equal(result.verificationUpliftUsd, 0);
});

test('verified SoH corrects an overstatement from a stale/noisy capacityRetentionScore proxy', () => {
  // capacityRetentionScore is itself derived from a (possibly noisy/stale) telemetry
  // reading via scoreCapacityRetention() in risk.ts: clamp((soh-60)/40*100). A score
  // of 87.5 round-trips through residual-value.ts's proxy formula back to SoH=95 —
  // but the passport-reconciled truth here is a much-degraded 70%. Real data should
  // win, not the round-tripped proxy.
  const riskScore = riskScoreWith(87.5); // proxy would infer SoH = 87.5*0.4+60 = 95
  const reconciledSoH: ReconciledSoH = { value: 70, source: 'BLENDED', confidence: 0.9, passportSoH: 70 };

  const proxyResult = computeResidualValue(battery, riskScore, vehicleValueUsd);
  const verifiedResult = computeResidualValue(battery, riskScore, vehicleValueUsd, reconciledSoH);

  assert.equal(proxyResult.sohUsed, 95);
  assert.equal(verifiedResult.sohUsed, 70);
  assert.ok(
    verifiedResult.currentBatteryValueUsd < proxyResult.currentBatteryValueUsd,
    'verified SoH=70% must value materially lower than the proxy\'s inferred SoH=95%',
  );
});

test('verificationUpliftUsd is zero when sohSourceUsed is NONE', () => {
  const reconciledSoH: ReconciledSoH = { value: 85, source: 'NONE', confidence: 0.1 };
  const result = computeResidualValue(battery, riskScoreWith(50), vehicleValueUsd, reconciledSoH);
  assert.equal(result.verificationUpliftUsd, 0);
});

test('verificationUpliftUsd is positive for a verified source above the data-less baseline', () => {
  const reconciledSoH: ReconciledSoH = { value: 95, source: 'BLENDED', confidence: 0.9 };
  const result = computeResidualValue(battery, riskScoreWith(50), vehicleValueUsd, reconciledSoH);
  assert.ok(result.verificationUpliftUsd > 0);
  assert.equal(
    result.verificationUpliftUsd,
    Math.round((result.currentBatteryValueUsd - result.dataLessBatteryValueUsd) * 100) / 100,
  );
});

test('methodology is bumped to soh-market-v2', () => {
  const result = computeResidualValue(battery, riskScoreWith(50), vehicleValueUsd);
  assert.equal(result.methodology, 'soh-market-v2');
});

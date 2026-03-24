/**
 * Intelligence Engine Orchestrator
 * Runs all scoring models for a battery and persists results to the database.
 */

import type { BatteryTelemetryPoint, PrismaClient } from '@voltledger/db';
import { computeRiskScore, type BatteryContext } from './risk';
import { computeResidualValue } from './residual-value';
import { computeLtv } from './ltv';
import { assessSecondLife } from './second-life';
import { computeDegradationForecast } from './forecast';
import { LTV_MAX } from './constants';

export interface EngineInput {
  battery: BatteryContext & { vehicleValueUsd?: number };
  recentPoints: BatteryTelemetryPoint[];
  baseRateBps?: number;
}

export interface EngineResult {
  batteryId:     string;
  riskScoreId:   string;
  scoredAt:      Date;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Run the full intelligence engine for a battery.
 * Persists RiskScore, ResidualValueEstimate, LtvRecommendation,
 * SecondLifeAssessment, and DegradationForecast to the DB.
 */
export async function runIntelligenceEngine(
  prisma: PrismaClient,
  input: EngineInput,
): Promise<EngineResult> {
  const { battery, recentPoints, baseRateBps = 500 } = input;
  const vehicleValueUsd = battery.vehicleValueUsd ?? 35_000;

  // 1. Run all scoring models
  const riskScore      = computeRiskScore(battery, recentPoints);
  const residualValue  = computeResidualValue(battery, riskScore, vehicleValueUsd);
  const ltvResult      = computeLtv(battery, riskScore, residualValue, baseRateBps);
  const secondLife     = assessSecondLife(battery, riskScore);
  const forecast       = computeDegradationForecast(battery, recentPoints);

  const scoredAt = new Date();

  // 2. Persist in a transaction
  const riskRecord = await prisma.$transaction(async (tx) => {
    // RiskScore
    const rs = await tx.riskScore.create({
      data: {
        batteryId:              battery.id,
        compositeScore:         riskScore.compositeScore,
        grade:                  riskScore.grade as any,
        degradationScore:       riskScore.degradationScore,
        thermalScore:           riskScore.thermalScore,
        usagePatternScore:      riskScore.usagePatternScore,
        capacityRetentionScore: riskScore.capacityRetentionScore,
        ageAdjustedScore:       riskScore.ageAdjustedScore,
        abnormalDegradation:    riskScore.abnormalDegradation,
        thermalAnomalyDetected: riskScore.thermalAnomalyDetected,
        highDcfcUsage:          riskScore.highDcfcUsage,
        deepDischargeHistory:   riskScore.deepDischargeHistory,
        confidenceLevel:        riskScore.confidenceLevel,
        modelVersion:           riskScore.modelVersion,
        scoredAt,
      },
    });

    // ResidualValueEstimate — map to schema field names
    const confidenceBand = residualValue.currentBatteryValueUsd * 0.10;
    await tx.residualValueEstimate.create({
      data: {
        batteryId:                battery.id,
        vehicleMarketValueUsd:    vehicleValueUsd,
        batteryResidualValueUsd:  residualValue.currentBatteryValueUsd,
        batteryValuePctOfVehicle: residualValue.residualPct / 100,
        residualAt12MonthsUsd:    residualValue.forecast12m,
        residualAt24MonthsUsd:    residualValue.forecast24m,
        residualAt36MonthsUsd:    residualValue.forecast36m,
        residualAt60MonthsUsd:    residualValue.forecast60m,
        confidenceLowUsd:         Math.max(0, residualValue.currentBatteryValueUsd - confidenceBand),
        confidenceHighUsd:        residualValue.currentBatteryValueUsd + confidenceBand,
        estimatedAt:              scoredAt,
      },
    });

    // LtvRecommendation — map to schema field names
    await tx.ltvRecommendation.create({
      data: {
        batteryId:               battery.id,
        recommendedLtvPct:       ltvResult.recommendedLtv * 100,
        maxLtvPct:               LTV_MAX * 100,
        adjustedResidualUsd:     residualValue.currentBatteryValueUsd,
        riskPremiumBps:          ltvResult.riskPremiumBps,
        grade:                   riskScore.grade as any,
        rationale:               ltvResult.ltvRationale,
        requestedLoanAmountUsd:  ltvResult.maxLoanAmountUsd,
        vehiclePurchasePriceUsd: vehicleValueUsd,
        loanTermMonths:          60,
        recommendedAt:           scoredAt,
      },
    });

    // Map internal use-case names to DB enum values
    const USE_CASE_MAP: Record<string, string> = {
      EV_FLEET:               'EV_FLEET_LOWER_DEMAND',
      STATIONARY_GRID:        'STATIONARY_STORAGE_GRID',
      STATIONARY_COMMERCIAL:  'STATIONARY_STORAGE_COMMERCIAL',
      STATIONARY_RESIDENTIAL: 'STATIONARY_STORAGE_RESIDENTIAL',
      REFURBISHMENT:          'REFURBISHMENT_RESALE',
      RECYCLING_ONLY:         'RECYCLING_ONLY',
    };
    const dbUseCase = USE_CASE_MAP[secondLife.recommendedUseCase] ?? 'RECYCLING_ONLY';

    // SecondLifeAssessment — map to schema field names
    const isViable = secondLife.recommendedUseCase !== 'RECYCLING_ONLY';
    const recyclerValueUsd = Math.max(0, residualValue.currentBatteryValueUsd * 0.15);
    const secondLifeValueUsd = isViable
      ? residualValue.currentBatteryValueUsd * (secondLife.suitabilityScore / 100) * 0.6
      : 0;

    await tx.secondLifeAssessment.create({
      data: {
        batteryId:                    battery.id,
        currentSoH:                   secondLife.currentSoH,
        isViable,
        viabilityScore:               secondLife.suitabilityScore,
        recommendedUseCase:           dbUseCase as any,
        estimatedRemainingLifeYears:  secondLife.estimatedRemainingLifeYears,
        estimatedSecondLifeValueUsd:  Math.round(secondLifeValueUsd * 100) / 100,
        recyclerValueUsd:             Math.round(recyclerValueUsd * 100) / 100,
        disqualifiers:                secondLife.disqualifiers,
        assessedAt:                   scoredAt,
      },
    });

    // DegradationForecast — map forecast points to fixed schema columns
    const fp = forecast.forecastPoints;
    const sohAt6M  = fp.find(p => p.monthsFromNow === 6)?.estimatedSoH  ?? forecast.currentSoH;
    const sohAt12M = fp.find(p => p.monthsFromNow === 12)?.estimatedSoH ?? forecast.currentSoH;
    const sohAt24M = fp.find(p => p.monthsFromNow === 24)?.estimatedSoH ?? forecast.currentSoH;
    const sohAt36M = fp.find(p => p.monthsFromNow === 36)?.estimatedSoH ?? forecast.currentSoH;
    const sohAt60M = fp.find(p => p.monthsFromNow === 60)?.estimatedSoH ?? forecast.currentSoH;

    const projectedDate80Pct = forecast.monthsTo80Pct != null
      ? addMonths(scoredAt, forecast.monthsTo80Pct) : null;
    const projectedDate70Pct = forecast.monthsTo70Pct != null
      ? addMonths(scoredAt, forecast.monthsTo70Pct) : null;

    // Months to 60%: compute from observed deg rate
    const degRate = forecast.observedDegRateYearly > 0
      ? forecast.observedDegRateYearly
      : forecast.expectedDegRateYearly;
    const monthsTo60 = degRate > 0
      ? Math.round((forecast.currentSoH - 60) / degRate * 12) : null;
    const projectedDate60Pct = monthsTo60 != null && monthsTo60 > 0
      ? addMonths(scoredAt, monthsTo60) : null;

    await tx.degradationForecast.create({
      data: {
        batteryId:             battery.id,
        currentSoH:            forecast.currentSoH,
        sohAt6Months:          sohAt6M,
        sohAt12Months:         sohAt12M,
        sohAt24Months:         sohAt24M,
        sohAt36Months:         sohAt36M,
        sohAt60Months:         sohAt60M,
        projectedDate80Pct,
        projectedDate70Pct,
        projectedDate60Pct,
        confidenceLevel:       forecast.confidenceLevel,
        forecastedAt:          scoredAt,
      },
    });

    return rs;
  });

  return {
    batteryId:   battery.id,
    riskScoreId: riskRecord.id,
    scoredAt,
  };
}

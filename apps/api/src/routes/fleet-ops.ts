/**
 * Fleet Ops endpoints — for fleet operators (Hertz, Amazon delivery, etc.)
 *
 * GET /v1/fleet/ops/stats        — readiness overview, SoH histogram, alerts, replacement queue
 * GET /v1/fleet/ops/alerts       — batteries with active alert flags (thermal/dcfc/degradation)
 * GET /v1/fleet/ops/replace      — replacement queue from degradation forecasts
 * GET /v1/fleet/ops/second-life  — viable second-life candidates
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';

const REPLACEMENT_COST_USD = 10_000;

const USE_CASE_LABELS: Record<string, string> = {
  EV_FLEET_LOWER_DEMAND:          'EV Fleet (lower demand)',
  STATIONARY_STORAGE_GRID:        'Stationary — Grid',
  STATIONARY_STORAGE_COMMERCIAL:  'Stationary — Commercial',
  STATIONARY_STORAGE_RESIDENTIAL: 'Stationary — Residential',
  REFURBISHMENT_RESALE:           'Refurbishment / Resale',
  RECYCLING_ONLY:                 'Recycling Only',
};

export async function fleetOpsRoutes(app: FastifyInstance) {

  // ── Overview stats ─────────────────────────────────────────────────────────
  app.get('/ops/stats', async () => {
    const now   = new Date();
    const in30d = new Date(now.getTime() + 30 * 86_400_000);
    const in60d = new Date(now.getTime() + 60 * 86_400_000);
    const in90d = new Date(now.getTime() + 90 * 86_400_000);

    const latestTelemetry = await prisma.batteryTelemetryPoint.findMany({
      distinct: ['batteryId'],
      orderBy:  { recordedAt: 'desc' },
      select:   { stateOfHealth: true },
    });

    const sohs         = latestTelemetry.map(t => t.stateOfHealth);
    const total        = sohs.length;
    const shiftReady   = sohs.filter(s => s >= 80).length;
    const limitedRange = sohs.filter(s => s >= 70 && s < 80).length;
    const grounded     = sohs.filter(s => s < 70).length;
    const avgSoH       = total ? sohs.reduce((a, b) => a + b, 0) / total : 0;

    const sohBuckets = [
      { label: '95–100%', min: 95, max: 101 },
      { label: '90–95%',  min: 90, max: 95  },
      { label: '85–90%',  min: 85, max: 90  },
      { label: '80–85%',  min: 80, max: 85  },
      { label: '75–80%',  min: 75, max: 80  },
      { label: '70–75%',  min: 70, max: 75  },
      { label: '<70%',    min: 0,  max: 70  },
    ].map(b => ({
      label: b.label,
      count: sohs.filter(s => s >= b.min && s < b.max).length,
      ready: b.min >= 80,
    }));

    const latestScores = await prisma.riskScore.findMany({
      distinct: ['batteryId'],
      orderBy:  { scoredAt: 'desc' },
      select:   { thermalAnomalyDetected: true, highDcfcUsage: true, abnormalDegradation: true },
    });

    const thermal     = latestScores.filter(s => s.thermalAnomalyDetected).length;
    const dcfc        = latestScores.filter(s => s.highDcfcUsage).length;
    const degradation = latestScores.filter(s => s.abnormalDegradation).length;

    const [replace30, replace60, replace90] = await Promise.all([
      prisma.degradationForecast.count({ where: { projectedDate80Pct: { gte: now, lte: in30d } } }),
      prisma.degradationForecast.count({ where: { projectedDate80Pct: { gte: now, lte: in60d } } }),
      prisma.degradationForecast.count({ where: { projectedDate80Pct: { gte: now, lte: in90d } } }),
    ]);

    return {
      total, shiftReady, limitedRange, grounded,
      shiftReadyPct: total ? Math.round((shiftReady / total) * 100) : 0,
      avgSoH: Math.round(avgSoH * 10) / 10,
      alerts: { thermal, dcfc, abnormalDegradation: degradation, total: thermal + dcfc + degradation },
      replacementQueue: { days30: replace30, days60: replace60, days90: replace90, estimatedCostUsd: replace90 * REPLACEMENT_COST_USD },
      sohBuckets,
    };
  });

  // ── Alerts ─────────────────────────────────────────────────────────────────
  app.get<{ Querystring: { type?: string } }>('/ops/alerts', async (req) => {
    const filterType = req.query.type; // 'thermal' | 'dcfc' | 'degradation' | undefined

    // Latest risk score per battery including battery info
    const allLatest = await prisma.riskScore.findMany({
      distinct: ['batteryId'],
      orderBy:  { scoredAt: 'desc' },
      select: {
        batteryId:              true,
        scoredAt:               true,
        compositeScore:         true,
        thermalAnomalyDetected: true,
        highDcfcUsage:          true,
        abnormalDegradation:    true,
        battery: {
          select: {
            serialNumber:   true,
            chemistry:      true,
            lastTelemetryAt:true,
            batteryModel:   { select: { manufacturer: true, modelName: true } },
          },
        },
      },
    });

    // Keep only those where the latest score has at least one flag
    const withAlerts = allLatest.filter(s =>
      s.thermalAnomalyDetected || s.highDcfcUsage || s.abnormalDegradation
    );

    // Apply type filter
    const filtered = filterType === 'thermal'     ? withAlerts.filter(s => s.thermalAnomalyDetected)
                   : filterType === 'dcfc'         ? withAlerts.filter(s => s.highDcfcUsage)
                   : filterType === 'degradation'  ? withAlerts.filter(s => s.abnormalDegradation)
                   : withAlerts;

    return {
      counts: {
        thermal:     withAlerts.filter(s => s.thermalAnomalyDetected).length,
        dcfc:        withAlerts.filter(s => s.highDcfcUsage).length,
        degradation: withAlerts.filter(s => s.abnormalDegradation).length,
        total:       withAlerts.length,
      },
      alerts: filtered.map(s => ({
        batteryId:       s.batteryId,
        serialNumber:    s.battery.serialNumber,
        manufacturer:    s.battery.batteryModel.manufacturer,
        modelName:       s.battery.batteryModel.modelName,
        chemistry:       s.battery.chemistry,
        lastTelemetryAt: s.battery.lastTelemetryAt,
        scoredAt:        s.scoredAt,
        compositeScore:  s.compositeScore,
        flags: {
          thermal:     s.thermalAnomalyDetected,
          dcfc:        s.highDcfcUsage,
          degradation: s.abnormalDegradation,
        },
      })),
    };
  });

  // ── Replacement queue ──────────────────────────────────────────────────────
  app.get('/ops/replace', async () => {
    const now   = new Date();
    const in30d = new Date(now.getTime() + 30  * 86_400_000);
    const in60d = new Date(now.getTime() + 60  * 86_400_000);
    const in90d = new Date(now.getTime() + 90  * 86_400_000);
    const in180d= new Date(now.getTime() + 180 * 86_400_000);

    // Latest SoH per battery
    const latestSoH = await prisma.batteryTelemetryPoint.findMany({
      distinct: ['batteryId'],
      orderBy:  { recordedAt: 'desc' },
      select:   { batteryId: true, stateOfHealth: true },
    });
    const sohMap = new Map(latestSoH.map(t => [t.batteryId, t.stateOfHealth]));

    // Latest forecast per battery with battery info, projected date within 6 months
    const forecasts = await prisma.degradationForecast.findMany({
      distinct: ['batteryId'],
      orderBy:  { forecastedAt: 'desc' },
      where:    { projectedDate80Pct: { not: null, lte: in180d } },
      select: {
        batteryId:         true,
        currentSoH:        true,
        projectedDate80Pct:true,
        forecastedAt:      true,
        confidenceLevel:   true,
        battery: {
          select: {
            serialNumber: true,
            chemistry:    true,
            batteryModel: { select: { manufacturer: true, modelName: true } },
          },
        },
      },
    });

    // Sort by projected date ascending (soonest first)
    forecasts.sort((a, b) =>
      new Date(a.projectedDate80Pct!).getTime() - new Date(b.projectedDate80Pct!).getTime()
    );

    const mapForecast = (f: typeof forecasts[0]) => {
      const projDate  = new Date(f.projectedDate80Pct!);
      const daysUntil = Math.round((projDate.getTime() - now.getTime()) / 86_400_000);
      const currentSoH= sohMap.get(f.batteryId) ?? f.currentSoH;
      return {
        batteryId:         f.batteryId,
        serialNumber:      f.battery.serialNumber,
        manufacturer:      f.battery.batteryModel.manufacturer,
        modelName:         f.battery.batteryModel.modelName,
        chemistry:         f.battery.chemistry,
        currentSoH:        Math.round(currentSoH * 10) / 10,
        projectedDate80Pct:f.projectedDate80Pct,
        daysUntil,
        confidenceLevel:   f.confidenceLevel,
        estimatedCostUsd:  REPLACEMENT_COST_USD,
      };
    };

    // Batteries already below 80% (immediate action)
    const immediate = latestSoH
      .filter(t => t.stateOfHealth < 80)
      .map(t => ({ batteryId: t.batteryId, currentSoH: Math.round(t.stateOfHealth * 10) / 10 }));

    return {
      summary: {
        immediate:         immediate.length,
        days30:            forecasts.filter(f => new Date(f.projectedDate80Pct!) <= in30d).length,
        days60:            forecasts.filter(f => new Date(f.projectedDate80Pct!) <= in60d).length,
        days90:            forecasts.filter(f => new Date(f.projectedDate80Pct!) <= in90d).length,
        totalForecast:     forecasts.length,
        estimatedCostUsd:  (immediate.length + forecasts.length) * REPLACEMENT_COST_USD,
      },
      upcoming: forecasts.map(mapForecast),
    };
  });

  // ── Second life candidates ─────────────────────────────────────────────────
  app.get('/ops/second-life', async () => {
    // Latest assessment per battery
    const allAssessments = await prisma.secondLifeAssessment.findMany({
      distinct: ['batteryId'],
      orderBy:  { assessedAt: 'desc' },
      select: {
        batteryId:                   true,
        currentSoH:                  true,
        isViable:                    true,
        viabilityScore:              true,
        recommendedUseCase:          true,
        estimatedRemainingLifeYears: true,
        estimatedSecondLifeValueUsd: true,
        recyclerValueUsd:            true,
        disqualifiers:               true,
        assessedAt:                  true,
        battery: {
          select: {
            serialNumber: true,
            chemistry:    true,
            batteryModel: { select: { manufacturer: true, modelName: true } },
          },
        },
      },
    });

    const viable    = allAssessments.filter(a => a.isViable);
    const nonViable = allAssessments.filter(a => !a.isViable);

    // Sort viable by value desc
    viable.sort((a, b) => (b.estimatedSecondLifeValueUsd ?? 0) - (a.estimatedSecondLifeValueUsd ?? 0));

    // Use case breakdown
    const useCaseBreakdown: Record<string, number> = {};
    for (const a of viable) {
      const key = a.recommendedUseCase ?? 'UNKNOWN';
      useCaseBreakdown[key] = (useCaseBreakdown[key] ?? 0) + 1;
    }

    const totalValueUsd  = viable.reduce((s, a) => s + (a.estimatedSecondLifeValueUsd ?? 0), 0);
    const recyclerValueUsd = nonViable.reduce((s, a) => s + (a.recyclerValueUsd ?? 0), 0);

    return {
      summary: {
        viable:              viable.length,
        nonViable:           nonViable.length,
        totalEstValueUsd:    Math.round(totalValueUsd),
        recyclerValueUsd:    Math.round(recyclerValueUsd),
        useCaseBreakdown:    Object.fromEntries(
          Object.entries(useCaseBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([k, v]) => [USE_CASE_LABELS[k] ?? k, v])
        ),
      },
      candidates: viable.map(a => ({
        batteryId:                   a.batteryId,
        serialNumber:                a.battery.serialNumber,
        manufacturer:                a.battery.batteryModel.manufacturer,
        modelName:                   a.battery.batteryModel.modelName,
        chemistry:                   a.battery.chemistry,
        currentSoH:                  Math.round(a.currentSoH * 10) / 10,
        viabilityScore:              a.viabilityScore,
        recommendedUseCase:          USE_CASE_LABELS[a.recommendedUseCase ?? ''] ?? a.recommendedUseCase,
        estimatedRemainingLifeYears: a.estimatedRemainingLifeYears,
        estimatedSecondLifeValueUsd: Math.round(a.estimatedSecondLifeValueUsd ?? 0),
        recyclerValueUsd:            Math.round(a.recyclerValueUsd ?? 0),
      })),
    };
  });
}

/**
 * Fleet Ops endpoints — for fleet operators (Hertz, Amazon delivery, etc.)
 * Focused on operational readiness, not lender risk scoring.
 *
 * GET /v1/fleet/ops/stats   — readiness overview, SoH distribution, alerts, replacement queue
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';

const REPLACEMENT_COST_USD = 10_000;

export async function fleetOpsRoutes(app: FastifyInstance) {
  app.get('/ops/stats', async () => {
    const now    = new Date();
    const in30d  = new Date(now.getTime() + 30 * 86_400_000);
    const in60d  = new Date(now.getTime() + 60 * 86_400_000);
    const in90d  = new Date(now.getTime() + 90 * 86_400_000);

    // ── Latest SoH per battery ───────────────────────────────────────────────
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

    // SoH histogram — 7 bands
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

    // ── Alert counts from latest score per battery ───────────────────────────
    const latestScores = await prisma.riskScore.findMany({
      distinct: ['batteryId'],
      orderBy:  { scoredAt: 'desc' },
      select: {
        thermalAnomalyDetected: true,
        highDcfcUsage:          true,
        abnormalDegradation:    true,
      },
    });

    const thermal     = latestScores.filter(s => s.thermalAnomalyDetected).length;
    const dcfc        = latestScores.filter(s => s.highDcfcUsage).length;
    const degradation = latestScores.filter(s => s.abnormalDegradation).length;

    // ── Replacement queue via degradation forecasts ──────────────────────────
    const [replace30, replace60, replace90] = await Promise.all([
      prisma.degradationForecast.count({ where: { projectedDate80Pct: { gte: now, lte: in30d } } }),
      prisma.degradationForecast.count({ where: { projectedDate80Pct: { gte: now, lte: in60d } } }),
      prisma.degradationForecast.count({ where: { projectedDate80Pct: { gte: now, lte: in90d } } }),
    ]);

    return {
      total,
      shiftReady,
      limitedRange,
      grounded,
      shiftReadyPct: total ? Math.round((shiftReady / total) * 100) : 0,
      avgSoH:        Math.round(avgSoH * 10) / 10,
      alerts: {
        thermal,
        dcfc,
        abnormalDegradation: degradation,
        total: thermal + dcfc + degradation,
      },
      replacementQueue: {
        days30:           replace30,
        days60:           replace60,
        days90:           replace90,
        estimatedCostUsd: replace90 * REPLACEMENT_COST_USD,
      },
      sohBuckets,
    };
  });
}

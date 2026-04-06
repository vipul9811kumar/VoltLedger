/**
 * Fleet-level endpoints used by the internal dashboard.
 *
 * GET /v1/fleet/stats          — aggregate counts for the overview page
 * GET /v1/fleet/batteries      — paginated battery list with latest risk score
 * GET /v1/fleet/flagged        — batteries that need attention
 * GET /v1/batteries/:serial/telemetry — SoH history for sparkline
 * GET /v1/batteries/:serial/detail    — full battery detail (all relations)
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';

export async function fleetRoutes(app: FastifyInstance) {
  // ── Fleet overview stats ───────────────────────────────────────────────────
  app.get('/fleet/stats', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);

    // Get the latest risk score per battery, then group by grade
    const latestScores = await prisma.riskScore.findMany({
      distinct: ['batteryId'],
      orderBy:  { scoredAt: 'desc' },
      select:   { grade: true, scoredAt: true },
    });

    const [total, byStatus, recentlyScored] = await Promise.all([
      prisma.battery.count(),
      prisma.battery.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.riskScore.count({
        where: { scoredAt: { gte: oneDayAgo } },
      }),
    ]);

    const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    latestScores.forEach(s => { gradeCounts[s.grade] = (gradeCounts[s.grade] ?? 0) + 1; });

    const statusCounts: Record<string, number> = {};
    byStatus.forEach(s => { statusCounts[s.status] = s._count.status; });

    return { total, gradeCounts, statusCounts, recentlyScored };
  });

  // ── Battery list ───────────────────────────────────────────────────────────
  app.get<{
    Querystring: { page?: string; pageSize?: string; grade?: string };
  }>('/fleet/batteries', async (req) => {
    const page     = parseInt(req.query.page ?? '1');
    const pageSize = parseInt(req.query.pageSize ?? '20');
    const grade    = req.query.grade;

    // Filter by grade uses the latest score per battery (no date cutoff)
    const where = grade ? {
      riskScores: { some: { grade: grade as any } },
    } : {};

    const [batteries, total] = await Promise.all([
      prisma.battery.findMany({
        where,
        include: {
          batteryModel: { select: { manufacturer: true, modelName: true } },
          riskScores:   { orderBy: { scoredAt: 'desc' }, take: 1 },
        },
        orderBy: { lastTelemetryAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.battery.count({ where }),
    ]);

    return { batteries, total, pages: Math.ceil(total / pageSize) };
  });

  // ── Flagged batteries ──────────────────────────────────────────────────────
  app.get('/fleet/flagged', async () => {
    const batteries = await prisma.battery.findMany({
      where: {
        riskScores: {
          some: {
            OR: [
              { abnormalDegradation: true },
              { thermalAnomalyDetected: true },
              { grade: { in: ['D', 'F'] } },
            ],
          },
        },
      },
      include: {
        batteryModel: { select: { manufacturer: true, modelName: true } },
        riskScores:   { orderBy: { scoredAt: 'desc' }, take: 1 },
      },
      take: 10,
    });

    return batteries;
  });

  // ── Battery telemetry history (SoH sparkline) ──────────────────────────────
  // Accepts either battery CUID (from dashboard) or serial number
  app.get<{
    Params: { serial: string };
    Querystring: { weeks?: string };
  }>('/:serial/telemetry', async (req, reply) => {
    const param = req.params.serial;
    const weeks  = parseInt(req.query.weeks ?? '12');
    const cutoff = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000);

    // CUIDs start with 'c' and are ~25 chars; serial numbers look different
    const isCuid = /^c[a-z0-9]{20,}$/.test(param);

    const battery = await prisma.battery.findUnique({
      where: isCuid ? { id: param } : { serialNumber: param },
      select: { id: true },
    });
    if (!battery) return reply.status(404).send({ error: 'Battery not found' });

    const points = await prisma.batteryTelemetryPoint.findMany({
      where:   { batteryId: battery.id, recordedAt: { gte: cutoff } },
      select:  { recordedAt: true, stateOfHealth: true, cellTempMax: true, stateOfCharge: true },
      orderBy: { recordedAt: 'asc' },
    });

    return points;
  });

  // ── Full battery detail ────────────────────────────────────────────────────
  app.get<{ Params: { serial: string } }>('/:serial/detail', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
      include: {
        batteryModel:          true,
        riskScores:            { orderBy: { scoredAt: 'desc' }, take: 1 },
        residualValues:        { orderBy: { estimatedAt: 'desc' }, take: 1 },
        ltvRecommendations:    { orderBy: { recommendedAt: 'desc' }, take: 1 },
        secondLifeAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
        degradationForecasts:  { orderBy: { forecastedAt: 'desc' }, take: 1 },
      },
    });
    if (!battery) return reply.status(404).send({ error: 'Battery not found' });
    return battery;
  });
}

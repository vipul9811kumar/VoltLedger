/**
 * Server-side data fetching — reads directly from Prisma (same process).
 * In production these would be authenticated API calls.
 */

import { prisma } from '@voltledger/db';

// ── Fleet overview ────────────────────────────────────────────────────────────

export async function getFleetStats() {
  const [total, byGrade, byStatus, recentlyScored] = await Promise.all([
    prisma.battery.count(),

    prisma.riskScore.groupBy({
      by: ['grade'],
      _count: { grade: true },
      where: {
        scoredAt: {
          gte: new Date(Date.now() - 7 * 24 * 3600 * 1000), // last 7 days
        },
      },
    }),

    prisma.battery.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    prisma.riskScore.count({
      where: { scoredAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    }),
  ]);

  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  byGrade.forEach(g => { gradeCounts[g.grade] = g._count.grade; });

  const statusCounts: Record<string, number> = {};
  byStatus.forEach(s => { statusCounts[s.status] = s._count.status; });

  return { total, gradeCounts, statusCounts, recentlyScored };
}

// ── Battery list (with latest risk score) ─────────────────────────────────────

export async function getBatteryList(page = 1, pageSize = 20, grade?: string) {
  const where = grade
    ? {
        riskScores: {
          some: {
            grade: grade as any,
            scoredAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
          },
        },
      }
    : {};

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
}

// ── Single battery detail ─────────────────────────────────────────────────────

export async function getBatteryDetail(serialNumber: string) {
  return prisma.battery.findUnique({
    where: { serialNumber },
    include: {
      batteryModel: true,
      riskScores:            { orderBy: { scoredAt: 'desc' }, take: 1 },
      residualValues:        { orderBy: { estimatedAt: 'desc' }, take: 1 },
      ltvRecommendations:    { orderBy: { recommendedAt: 'desc' }, take: 1 },
      secondLifeAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      degradationForecasts:  { orderBy: { forecastedAt: 'desc' }, take: 1 },
    },
  });
}

// ── Telemetry history for SoH sparkline ───────────────────────────────────────

export async function getBatterySoHHistory(batteryId: string, weeks = 12) {
  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000);
  return prisma.batteryTelemetryPoint.findMany({
    where:   { batteryId, recordedAt: { gte: cutoff } },
    select:  { recordedAt: true, stateOfHealth: true, cellTempMax: true, stateOfCharge: true },
    orderBy: { recordedAt: 'asc' },
  });
}

// ── Flagged batteries (need attention) ───────────────────────────────────────

export async function getFlaggedBatteries() {
  return prisma.battery.findMany({
    where: {
      riskScores: {
        some: {
          OR: [
            { abnormalDegradation: true },
            { thermalAnomalyDetected: true },
            { grade: { in: ['D', 'F'] } },
          ],
          scoredAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
      },
    },
    include: {
      batteryModel: { select: { manufacturer: true, modelName: true } },
      riskScores:   { orderBy: { scoredAt: 'desc' }, take: 1 },
    },
    take: 10,
  });
}

/**
 * GET /v1/batteries/:serial       — battery profile
 * GET /v1/batteries/:serial/score — trigger/return latest score (all models)
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { runIntelligenceEngine } from '@voltledger/scoring';
import { notFound, serverError } from '../lib/errors';

export async function batteryRoutes(app: FastifyInstance) {
  // GET /v1/batteries/:serial — battery profile + latest scores summary
  app.get<{ Params: { serial: string } }>('/:serial', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
      include: {
        batteryModel: true,
        riskScores:   { orderBy: { scoredAt: 'desc' }, take: 1 },
      },
    });

    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const latestRisk = battery.riskScores[0];

    return {
      id:                battery.id,
      serialNumber:      battery.serialNumber,
      vin:               battery.vin,
      chemistry:         battery.chemistry,
      nominalCapacityKwh: battery.nominalCapacityKwh,
      status:            battery.status,
      manufacturedAt:    battery.manufacturedAt,
      lastTelemetryAt:   battery.lastTelemetryAt,
      model: {
        id:           battery.batteryModel.id,
        manufacturer: battery.batteryModel.manufacturer,
        modelName:    battery.batteryModel.modelName,
        capacityKwh:  battery.batteryModel.capacityKwh,
      },
      latestRiskScore: latestRisk ? {
        compositeScore: latestRisk.compositeScore,
        grade:          latestRisk.grade,
        scoredAt:       latestRisk.scoredAt,
      } : null,
    };
  });

  // POST /v1/batteries/:serial/score — run scoring engine on demand
  app.post<{
    Params: { serial: string };
    Body: { vehicleValueUsd?: number; baseRateBps?: number };
  }>('/:serial/score', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
    });

    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    // Fetch last 12 weeks of telemetry
    const cutoff = new Date(Date.now() - 12 * 7 * 24 * 3600 * 1000);
    const recentPoints = await prisma.batteryTelemetryPoint.findMany({
      where: { batteryId: battery.id, recordedAt: { gte: cutoff } },
      orderBy: { recordedAt: 'asc' },
    });

    if (recentPoints.length === 0) {
      return reply.status(422).send({
        error: 'No telemetry data in the last 12 weeks — cannot score',
      });
    }

    try {
      const result = await runIntelligenceEngine(prisma, {
        battery: {
          id:                 battery.id,
          chemistry:          battery.chemistry,
          nominalCapacityKwh: battery.nominalCapacityKwh,
          manufacturedAt:     battery.manufacturedAt,
          vehicleValueUsd:    req.body?.vehicleValueUsd ?? 35_000,
        },
        recentPoints,
        baseRateBps: req.body?.baseRateBps ?? 500,
      });

      return reply.status(201).send({
        batteryId:   result.batteryId,
        riskScoreId: result.riskScoreId,
        scoredAt:    result.scoredAt,
        message:     'Scoring complete. Fetch details via GET endpoints.',
      });
    } catch (err) {
      return serverError(reply, err);
    }
  });
}

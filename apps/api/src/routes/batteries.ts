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
  // Accepts optional passportId to blend passport SoH into the risk score.
  app.post<{
    Params: { serial: string };
    Body: { vehicleValueUsd?: number; baseRateBps?: number; passportId?: string };
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

    // Build optional passport context
    let passportContext: import('@voltledger/types').PassportContext | undefined;
    const passportId = req.body?.passportId;
    if (passportId) {
      const passport = await prisma.batteryPassport.findUnique({
        where: { id: passportId },
        include: { verification: true },
      });
      if (passport) {
        passportContext = {
          passportId:           passport.id,
          tierAccess:           passport.tierAccess as any,
          isVerified:           passport.isVerified,
          identityChainValid:   passport.verification?.identityChainValid,
          carbonFootprintKgCo2e: passport.carbonFootprintKgCo2e ?? undefined,
          recycledContentPct:   passport.recycledContentPct ?? undefined,
          unitSoH:              passport.unitSoH ?? undefined,
          chargeCycleCount:     passport.chargeCycleCount ?? undefined,
          tempHistoryMax:       passport.tempHistoryMax ?? undefined,
          batteryStatusCode:    (passport.batteryStatusCode as any) ?? undefined,
        };
      }
    } else {
      // Auto-attach passport if one exists for this battery
      const passport = await prisma.batteryPassport.findUnique({
        where: { batteryId: battery.id },
        include: { verification: true },
      });
      if (passport) {
        passportContext = {
          passportId:           passport.id,
          tierAccess:           passport.tierAccess as any,
          isVerified:           passport.isVerified,
          identityChainValid:   passport.verification?.identityChainValid,
          carbonFootprintKgCo2e: passport.carbonFootprintKgCo2e ?? undefined,
          recycledContentPct:   passport.recycledContentPct ?? undefined,
          unitSoH:              passport.unitSoH ?? undefined,
          chargeCycleCount:     passport.chargeCycleCount ?? undefined,
          tempHistoryMax:       passport.tempHistoryMax ?? undefined,
          batteryStatusCode:    (passport.batteryStatusCode as any) ?? undefined,
        };
      }
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
        baseRateBps:     req.body?.baseRateBps ?? 500,
        passportContext,
      });

      return reply.status(201).send({
        batteryId:        result.batteryId,
        riskScoreId:      result.riskScoreId,
        scoredAt:         result.scoredAt,
        sohSource:        result.sohSource,
        passportVerified: result.passportVerified,
        passportUsed:     !!passportContext,
        message: passportContext
          ? `Scoring complete with ${passportContext.tierAccess} passport data (${result.sohSource} SoH).`
          : 'Scoring complete (telemetry only — no passport attached).',
      });
    } catch (err) {
      return serverError(reply, err);
    }
  });
}

/**
 * GET /v1/batteries/lookup?vin=1HGBH41JXMN109186
 * GET /v1/batteries/lookup?id=<battery-serial-or-cuid>
 *
 * Resolves a VIN or battery ID to a full battery report.
 * Counts against the lender's VIN lookup quota for Starter tier.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';

export async function lookupRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { vin?: string; id?: string };
  }>('/lookup', async (req, reply) => {
    const { vin, id } = req.query;

    if (!vin && !id) {
      return reply.status(400).send({ error: 'Provide ?vin= or ?id= query param' });
    }

    // ── Quota check for VIN lookups (Starter tier) ───────────────────────────
    // req.lender is set by the auth middleware when a real API key is used.
    // Service-token bypass skips quota (internal dashboard calls).
    const lender = (req as any).lender;
    if (lender && vin) {
      if (
        lender.monthlyVinLookupQuota !== null &&
        lender.vinLookupsUsedThisMonth >= lender.monthlyVinLookupQuota
      ) {
        return reply.status(429).send({
          error: 'VIN lookup quota exceeded',
          quota: lender.monthlyVinLookupQuota,
          used: lender.vinLookupsUsedThisMonth,
          hint: 'Upgrade to Professional for unlimited VIN lookups within your battery quota.',
        });
      }
      // Increment VIN lookup counter
      await prisma.lender.update({
        where: { id: lender.id },
        data: { vinLookupsUsedThisMonth: { increment: 1 } },
      });
    }

    // ── Find battery ─────────────────────────────────────────────────────────
    let battery = null;

    if (vin) {
      battery = await prisma.battery.findFirst({
        where: { vin: { equals: vin, mode: 'insensitive' } },
        include: {
          batteryModel: true,
          riskScores:   { orderBy: { scoredAt: 'desc' }, take: 1 },
        },
      });
    } else if (id) {
      const isCuid = /^c[a-z0-9]{20,}$/.test(id!);
      battery = await prisma.battery.findUnique({
        where: isCuid ? { id: id! } : { serialNumber: id! },
        include: {
          batteryModel: true,
          riskScores:   { orderBy: { scoredAt: 'desc' }, take: 1 },
        },
      });
    }

    if (!battery) {
      return reply.status(404).send({
        error: vin ? `No battery found for VIN ${vin}` : `Battery not found: ${id}`,
      });
    }

    const score = battery.riskScores[0] ?? null;

    return {
      id:                 battery.id,
      serialNumber:       battery.serialNumber,
      vin:                battery.vin,
      chemistry:          battery.chemistry,
      nominalCapacityKwh: battery.nominalCapacityKwh,
      status:             battery.status,
      manufacturedAt:     battery.manufacturedAt,
      lastTelemetryAt:    battery.lastTelemetryAt,
      batteryModel: {
        manufacturer: battery.batteryModel.manufacturer,
        modelName:    battery.batteryModel.modelName,
        capacityKwh:  battery.batteryModel.capacityKwh,
        chemistry:    battery.batteryModel.chemistry,
      },
      latestRiskScore: score ? {
        compositeScore:        score.compositeScore,
        grade:                 score.grade,
        scoredAt:              score.scoredAt,
        confidenceLevel:       score.confidenceLevel,
        degradationScore:      score.degradationScore,
        thermalScore:          score.thermalScore,
        usagePatternScore:     score.usagePatternScore,
        capacityRetentionScore: score.capacityRetentionScore,
        ageAdjustedScore:      score.ageAdjustedScore,
        abnormalDegradation:   score.abnormalDegradation,
        thermalAnomalyDetected: score.thermalAnomalyDetected,
        highDcfcUsage:         score.highDcfcUsage,
        deepDischargeHistory:  score.deepDischargeHistory,
      } : null,
    };
  });
}
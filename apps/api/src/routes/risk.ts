/**
 * GET /v1/batteries/:serial/risk
 * Returns the latest risk score for a battery, with all sub-scores and flags.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { notFound } from '../lib/errors';

export async function riskRoutes(app: FastifyInstance) {
  app.get<{ Params: { serial: string } }>('/:serial/risk', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
      select: { id: true },
    });

    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const score = await prisma.riskScore.findFirst({
      where:   { batteryId: battery.id },
      orderBy: { scoredAt: 'desc' },
    });

    if (!score) {
      return reply.status(404).send({
        error: 'No risk score available. Trigger scoring via POST /:serial/score',
      });
    }

    return {
      batteryId:      battery.id,
      serialNumber:   req.params.serial,
      scoredAt:       score.scoredAt,
      modelVersion:   score.modelVersion,

      // Composite
      compositeScore: score.compositeScore,
      grade:          score.grade,
      confidenceLevel: score.confidenceLevel,

      // Sub-scores (0–100 each, higher = lower risk)
      subScores: {
        degradation:       score.degradationScore,
        thermal:           score.thermalScore,
        usagePattern:      score.usagePatternScore,
        capacityRetention: score.capacityRetentionScore,
        ageAdjusted:       score.ageAdjustedScore,
      },

      // Risk flags
      flags: {
        abnormalDegradation:    score.abnormalDegradation,
        thermalAnomalyDetected: score.thermalAnomalyDetected,
        highDcfcUsage:          score.highDcfcUsage,
        deepDischargeHistory:   score.deepDischargeHistory,
      },
    };
  });
}

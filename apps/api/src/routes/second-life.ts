/**
 * GET /v1/batteries/:serial/second-life
 * Returns second-life viability assessment.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { notFound } from '../lib/errors';

export async function secondLifeRoutes(app: FastifyInstance) {
  app.get<{ Params: { serial: string } }>('/:serial/second-life', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
      select: { id: true },
    });

    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const assessment = await prisma.secondLifeAssessment.findFirst({
      where:   { batteryId: battery.id },
      orderBy: { assessedAt: 'desc' },
    });

    if (!assessment) {
      return reply.status(404).send({
        error: 'No second-life assessment available. Trigger scoring via POST /:serial/score',
      });
    }

    return {
      batteryId:    battery.id,
      serialNumber: req.params.serial,
      assessedAt:   assessment.assessedAt,

      currentSoH:    assessment.currentSoH,
      isViable:      assessment.isViable,
      viabilityScore: assessment.viabilityScore,

      recommendation: {
        useCase:                     assessment.recommendedUseCase,
        estimatedRemainingLifeYears: assessment.estimatedRemainingLifeYears,
        estimatedSecondLifeValueUsd: assessment.estimatedSecondLifeValueUsd,
        recyclerValueUsd:            assessment.recyclerValueUsd,
      },

      disqualifiers: assessment.disqualifiers,
    };
  });
}

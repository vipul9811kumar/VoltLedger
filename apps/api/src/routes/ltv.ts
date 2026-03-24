/**
 * GET /v1/batteries/:serial/ltv
 * Returns the latest LTV recommendation for a battery.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { notFound } from '../lib/errors';

export async function ltvRoutes(app: FastifyInstance) {
  app.get<{ Params: { serial: string } }>('/:serial/ltv', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
      select: { id: true },
    });

    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const ltv = await prisma.ltvRecommendation.findFirst({
      where:   { batteryId: battery.id },
      orderBy: { recommendedAt: 'desc' },
    });

    if (!ltv) {
      return reply.status(404).send({
        error: 'No LTV recommendation available. Trigger scoring via POST /:serial/score',
      });
    }

    return {
      batteryId:    battery.id,
      serialNumber: req.params.serial,
      generatedAt:  ltv.recommendedAt,

      recommendation: {
        recommendedLtvPct:     Math.round(ltv.recommendedLtvPct * 10) / 10,
        maxLtvPct:             ltv.maxLtvPct,
        maxLoanAmountUsd:      ltv.requestedLoanAmountUsd,
        adjustedResidualUsd:   ltv.adjustedResidualUsd,
        grade:                 ltv.grade,
        rationale:             ltv.rationale,
      },

      pricing: {
        baseRateBps:    500,   // stored implicitly; baseRate = totalRate - premium
        riskPremiumBps: ltv.riskPremiumBps,
        totalRateBps:   500 + ltv.riskPremiumBps,
        totalRatePct:   Math.round((500 + ltv.riskPremiumBps) / 100 * 10) / 10,
      },

      flagged: ltv.riskPremiumBps > 45,  // > 3× 100-point drops = manual review
    };
  });
}

/**
 * GET /v1/batteries/:serial/residual-value
 * Returns the latest residual value estimate + forecast.
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { notFound } from '../lib/errors';

export async function residualValueRoutes(app: FastifyInstance) {
  app.get<{ Params: { serial: string } }>('/:serial/residual-value', async (req, reply) => {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: req.params.serial },
      select: { id: true },
    });

    if (!battery) return notFound(reply, `Battery ${req.params.serial} not found`);

    const estimate = await prisma.residualValueEstimate.findFirst({
      where:   { batteryId: battery.id },
      orderBy: { estimatedAt: 'desc' },
    });

    if (!estimate) {
      return reply.status(404).send({
        error: 'No residual value estimate available. Trigger scoring via POST /:serial/score',
      });
    }

    return {
      batteryId:    battery.id,
      serialNumber: req.params.serial,
      estimatedAt:  estimate.estimatedAt,

      current: {
        vehicleMarketValueUsd:    estimate.vehicleMarketValueUsd,
        batteryResidualValueUsd:  estimate.batteryResidualValueUsd,
        batteryValuePctOfVehicle: Math.round(estimate.batteryValuePctOfVehicle * 1000) / 10,
        confidenceLow:            estimate.confidenceLowUsd,
        confidenceHigh:           estimate.confidenceHighUsd,
      },

      forecast: {
        at12Months: estimate.residualAt12MonthsUsd,
        at24Months: estimate.residualAt24MonthsUsd,
        at36Months: estimate.residualAt36MonthsUsd,
        at60Months: estimate.residualAt60MonthsUsd,
      },
    };
  });
}

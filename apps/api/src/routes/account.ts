/**
 * Internal account endpoints — service-token only (dashboard → API).
 *
 * GET  /v1/account                          — current lender account
 * POST /v1/account/sync                     — update lender from Stripe webhook
 * GET  /v1/account/by-subscription/:subId   — look up lender by Stripe sub ID
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';

export async function accountRoutes(app: FastifyInstance) {

  // GET /v1/account — resolve lender from the Clerk user ID in x-clerk-user-id header
  app.get('/account', async (req, reply) => {
    const clerkId = req.headers['x-clerk-user-id'] as string | undefined;
    if (!clerkId) return reply.status(400).send({ error: 'Missing x-clerk-user-id header' });

    const lenderUser = await prisma.lenderUser.findUnique({
      where:   { clerkId },
      include: { lender: { include: { organization: { select: { name: true } } } } },
    });
    if (!lenderUser) return reply.status(404).send({ error: 'No lender found for this user' });
    return lenderUser.lender;
  });

  // POST /v1/account/sync — called by Stripe webhook to update subscription state
  app.post<{
    Body: {
      lenderId: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string | null;
      stripePriceId?: string;
      subscriptionStatus?: string;
      tier?: string;
      monthlyBatteryQuota?: number;
      monthlyVinLookupQuota?: number | null;
      currentPeriodEnd?: string;
    };
  }>('/account/sync', async (req, reply) => {
    const { lenderId, ...data } = req.body;

    const update: Record<string, unknown> = {};
    if (data.stripeCustomerId !== undefined)    update.stripeCustomerId    = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined) update.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.stripePriceId !== undefined)       update.stripePriceId       = data.stripePriceId;
    if (data.subscriptionStatus !== undefined)  update.subscriptionStatus  = data.subscriptionStatus as any;
    if (data.tier !== undefined)                update.tier                = data.tier as any;
    if (data.monthlyBatteryQuota !== undefined) update.monthlyBatteryQuota = data.monthlyBatteryQuota;
    if ('monthlyVinLookupQuota' in data)        update.monthlyVinLookupQuota = data.monthlyVinLookupQuota;
    if (data.currentPeriodEnd !== undefined)    update.currentPeriodEnd    = new Date(data.currentPeriodEnd);

    const lender = await prisma.lender.update({
      where: { id: lenderId },
      data: update,
    });
    return lender;
  });

  // GET /v1/account/by-subscription/:subId — resolve lender from Stripe subscription ID
  app.get<{ Params: { subId: string } }>(
    '/account/by-subscription/:subId',
    async (req, reply) => {
      const lender = await prisma.lender.findUnique({
        where: { stripeSubscriptionId: req.params.subId },
      });
      if (!lender) return reply.status(404).send({ error: 'Lender not found' });
      return lender;
    }
  );
}
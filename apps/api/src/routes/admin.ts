/**
 * Admin routes — protected by x-service-token only.
 * GET  /v1/admin/early-access          — list all requests
 * POST /v1/admin/early-access/:id/approve
 * POST /v1/admin/early-access/:id/reject
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voltledger/db';
import { sendApprovalEmail, sendRejectionEmail } from './early-access';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Require service token for all admin routes
  app.addHook('onRequest', async (req, reply) => {
    const token = req.headers['x-service-token'];
    if (!token || token !== process.env.SERVICE_TOKEN) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  });

  // List all early access requests (default: PENDING first)
  app.get('/early-access', async (_req, reply) => {
    const requests = await prisma.earlyAccessRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return reply.send(requests);
  });

  // Approve
  app.post<{ Params: { id: string } }>('/early-access/:id/approve', async (req, reply) => {
    const record = await prisma.earlyAccessRequest.findUnique({ where: { id: req.params.id } });
    if (!record) return reply.status(404).send({ error: 'Not found' });

    await prisma.earlyAccessRequest.update({
      where: { id: record.id },
      data:  { status: 'APPROVED' },
    });

    sendApprovalEmail({ firstName: record.firstName, email: record.email, company: record.company })
      .catch(err => console.error('[admin] approval email error:', err));

    return reply.send({ ok: true, status: 'APPROVED', email: record.email });
  });

  // Reject
  app.post<{
    Params: { id: string };
    Body:   { notes?: string };
  }>('/early-access/:id/reject', async (req, reply) => {
    const record = await prisma.earlyAccessRequest.findUnique({ where: { id: req.params.id } });
    if (!record) return reply.status(404).send({ error: 'Not found' });

    const notes = (req.body as any)?.notes ?? null;

    await prisma.earlyAccessRequest.update({
      where: { id: record.id },
      data:  { status: 'REJECTED', notes },
    });

    sendRejectionEmail({ firstName: record.firstName, email: record.email, notes })
      .catch(err => console.error('[admin] rejection email error:', err));

    return reply.send({ ok: true, status: 'REJECTED', email: record.email });
  });
};
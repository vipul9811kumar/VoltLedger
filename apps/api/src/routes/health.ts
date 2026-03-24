import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    service: 'VoltLedger API',
    version: '1.0',
    status: 'ok',
  }));

  app.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: 'ok', db: 'connected' });
    } catch {
      return reply.status(503).send({ status: 'degraded', db: 'unreachable' });
    }
  });
}

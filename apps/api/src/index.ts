import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { batteryRoutes } from './routes/batteries';
import { riskRoutes } from './routes/risk';
import { residualValueRoutes } from './routes/residual-value';
import { ltvRoutes } from './routes/ltv';
import { secondLifeRoutes } from './routes/second-life';
import { healthRoutes } from './routes/health';
import { earlyAccessRoutes } from './routes/early-access';
import { fleetRoutes } from './routes/fleet';
import { lookupRoutes } from './routes/lookup';
import { accountRoutes } from './routes/account';
import { adminRoutes } from './routes/admin';

const PORT = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001');
const HOST = process.env.API_HOST ?? '0.0.0.0';

async function build() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  // ── Security + utility plugins ─────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? '*' });
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.headers['x-api-key'] as string ?? req.ip,
  });

  // ── API key middleware (simple header check) ───────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    // Skip auth for health check, early access, and in dev mode
    if (req.url === '/health' || req.url === '/' || req.url.startsWith('/v1/early-access')) return;
    if (req.url.startsWith('/v1/admin') && req.headers['x-service-token'] === process.env.SERVICE_TOKEN) return;
    if (process.env.DEV_SKIP_AUTH === 'true') return;

    // Service-to-service token — for internal clients (e.g. dashboard)
    const serviceToken = req.headers['x-service-token'];
    if (serviceToken && serviceToken === process.env.SERVICE_TOKEN) return;

    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return reply.status(401).send({ error: 'Missing X-Api-Key header' });
    }

    // Validate key against DB (cached in production via Redis)
    const { validateApiKey } = await import('./lib/auth');
    const valid = await validateApiKey(apiKey as string);
    if (!valid) {
      return reply.status(403).send({ error: 'Invalid or revoked API key' });
    }
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(batteryRoutes,      { prefix: '/v1/batteries' });
  await app.register(riskRoutes,         { prefix: '/v1/batteries' });
  await app.register(residualValueRoutes,{ prefix: '/v1/batteries' });
  await app.register(ltvRoutes,          { prefix: '/v1/batteries' });
  await app.register(secondLifeRoutes,   { prefix: '/v1/batteries' });
  await app.register(earlyAccessRoutes,  { prefix: '/v1/early-access' });
  await app.register(fleetRoutes,        { prefix: '/v1/batteries' });
  await app.register(lookupRoutes,       { prefix: '/v1/batteries' });
  await app.register(accountRoutes,      { prefix: '/v1' });
  await app.register(adminRoutes,        { prefix: '/v1/admin' });

  return app;
}

async function main() {
  const app = await build();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`\n🔋 VoltLedger API running on http://${HOST}:${PORT}`);
    console.log(`   Health : http://localhost:${PORT}/health`);
    console.log(`   Docs   : GET /v1/batteries/:serial/risk\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

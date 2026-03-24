/**
 * VoltLedger Ingestion Service — entry point.
 *
 * Starts:
 *   - Telemetry worker (BullMQ consumer)
 *   - Scoring worker stub (Phase 3 placeholder)
 *   - Graceful shutdown on SIGTERM/SIGINT
 */

import { startTelemetryWorker } from './workers/telemetry.worker';
import { startScoringWorker }   from './workers/scoring.worker';
import { redis }                from './redis';
import { prisma }               from '@voltledger/db';

async function main() {
  console.log('\n⚡ VoltLedger Ingestion Service');
  console.log('─'.repeat(40));

  // Verify DB connection
  await prisma.$queryRaw`SELECT 1`;
  console.log('  [db]     PostgreSQL connected');

  // Verify Redis connection
  await redis.ping();
  console.log('  [redis]  Redis connected');
  console.log('─'.repeat(40) + '\n');

  const telemetryWorker = startTelemetryWorker();
  const scoringWorker   = startScoringWorker();

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[shutdown] ${signal} received — draining workers...`);
    await Promise.all([
      telemetryWorker.close(),
      scoringWorker.close(),
    ]);
    await redis.quit();
    await prisma.$disconnect();
    console.log('[shutdown] Clean exit.\n');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch(err => {
  console.error('[startup] Fatal error:', err.message);
  process.exit(1);
});

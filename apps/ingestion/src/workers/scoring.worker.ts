/**
 * Scoring worker — Phase 3 Intelligence Engine.
 * Receives battery.scoring jobs enqueued by the telemetry worker,
 * fetches the last 12 weeks of telemetry, and runs the full scoring pipeline.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '@voltledger/db';
import { runIntelligenceEngine } from '@voltledger/scoring';
import { createRedisConnection } from '../redis';
import { SCORING_QUEUE, type ScoringJob } from '../queues/telemetry.queue';

const CONCURRENCY = parseInt(process.env.SCORING_CONCURRENCY ?? '2');
const TELEMETRY_LOOKBACK_WEEKS = 12;

async function processScoringJob(job: Job<ScoringJob>): Promise<unknown> {
  const { batteryId } = job.data;

  // Load battery record
  const battery = await prisma.battery.findUnique({
    where: { id: batteryId },
    include: { batteryModel: true },
  });

  if (!battery) {
    console.warn(`[scoring] Battery ${batteryId} not found — skipping`);
    return { skipped: true, reason: 'battery_not_found' };
  }

  // Fetch recent telemetry (last 12 weeks)
  const cutoff = new Date(Date.now() - TELEMETRY_LOOKBACK_WEEKS * 7 * 24 * 3600 * 1000);
  const recentPoints = await prisma.batteryTelemetryPoint.findMany({
    where: { batteryId, recordedAt: { gte: cutoff } },
    orderBy: { recordedAt: 'asc' },
  });

  if (recentPoints.length === 0) {
    console.warn(`[scoring] No recent telemetry for battery ${batteryId} — skipping`);
    return { skipped: true, reason: 'no_telemetry' };
  }

  const result = await runIntelligenceEngine(prisma, {
    battery: {
      id:                battery.id,
      chemistry:         battery.chemistry,
      nominalCapacityKwh: battery.nominalCapacityKwh,
      manufacturedAt:    battery.manufacturedAt,
      vehicleValueUsd:   35_000,  // default — real deployments pass from loan application
    },
    recentPoints,
  });

  console.info(
    `[scoring] Battery ${batteryId} scored — ` +
    `riskScoreId=${result.riskScoreId} scoredAt=${result.scoredAt.toISOString()}`,
  );

  return result;
}

export function startScoringWorker() {
  const worker = new Worker<ScoringJob>(
    SCORING_QUEUE,
    processScoringJob,
    {
      connection: createRedisConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[scoring] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', err => {
    console.error('[scoring] worker error:', err.message);
  });

  console.info(`[worker] Scoring worker started (concurrency=${CONCURRENCY})`);
  return worker;
}

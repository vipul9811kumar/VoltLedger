/**
 * Scoring worker stub — Phase 3 placeholder.
 * Receives battery.scoring jobs enqueued by the telemetry worker.
 * The actual scoring engine (risk score, residual value, LTV) is built in Phase 3.
 */

import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '../redis';
import { SCORING_QUEUE, type ScoringJob } from '../queues/telemetry.queue';

const CONCURRENCY = parseInt(process.env.SCORING_CONCURRENCY ?? '2');

export function startScoringWorker() {
  const worker = new Worker<ScoringJob>(
    SCORING_QUEUE,
    async (job: Job<ScoringJob>) => {
      // Phase 3: scoring engine runs here
      console.debug(
        `[scoring] queued battery ${job.data.batteryId} ` +
        `(trigger: ${job.data.triggeredBy}) — scoring engine coming in Phase 3`,
      );
      return { queued: true };
    },
    {
      connection: createRedisConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on('error', err => {
    console.error('[scoring] worker error:', err.message);
  });

  console.info(`[worker] Scoring worker started (concurrency=${CONCURRENCY})`);
  return worker;
}

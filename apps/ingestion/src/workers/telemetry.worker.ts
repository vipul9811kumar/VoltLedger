/**
 * BullMQ worker — processes battery.telemetry jobs.
 *
 * Pipeline per job:
 *   1. Validate fields (Zod)
 *   2. Resolve battery by serial number
 *   3. Normalize payload
 *   4. Write to battery_telemetry_points (deduplicated)
 *   5. Enqueue battery.scoring job
 */

import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '../redis';
import { scoringQueue, TELEMETRY_QUEUE, type TelemetryJob, type ScoringJob } from '../queues/telemetry.queue';
import { validateTelemetry } from '../pipeline/validate';
import { storeTelemetry, resolveBattery, autoRegisterBattery } from '../pipeline/store';

const CONCURRENCY = parseInt(process.env.INGESTION_CONCURRENCY ?? '5');

export function startTelemetryWorker() {
  const worker = new Worker<TelemetryJob>(
    TELEMETRY_QUEUE,
    async (job: Job<TelemetryJob>) => {
      const { data } = job;

      // ── 1. Validate ────────────────────────────────────────────────────────
      const validation = validateTelemetry(data);

      if (!validation.valid) {
        const msg = `Validation failed: ${validation.errors?.join('; ')}`;
        console.warn(`[worker] ✗ ${data.serialNumber} — ${msg}`);
        throw new Error(msg);  // BullMQ will retry up to `attempts` times
      }

      if (validation.warnings?.length) {
        console.warn(`[worker] ⚠ ${data.serialNumber} warnings: ${validation.warnings.join(', ')}`);
      }

      // ── 2. Resolve battery ─────────────────────────────────────────────────
      const battery = await resolveBattery(data.serialNumber);

      if (!battery) {
        // Auto-register: create battery record from telemetry metadata
        battery = await autoRegisterBattery(data.serialNumber, data.chemistry);
        if (!battery) {
          throw new Error(`Cannot register battery ${data.serialNumber} — no matching model for chemistry: ${data.chemistry}`);
        }
        console.info(`[worker] ➕ Auto-registered battery ${data.serialNumber} (${data.chemistry})`);
      }

      if (battery.status === 'DECOMMISSIONED') {
        console.info(`[worker] ⏭ Skipping decommissioned battery ${data.serialNumber}`);
        return { skipped: true, reason: 'decommissioned' };
      }

      // ── 3 + 4. Normalize + Store ───────────────────────────────────────────
      const result = await storeTelemetry(battery.id, data);

      if (result.skipped) {
        console.debug(`[worker] ⏭ ${data.serialNumber} — ${result.reason}`);
        return result;
      }

      console.info(
        `[worker] ✓ ${data.serialNumber} · SoH ${data.stateOfHealth.toFixed(1)}% · ` +
        `${new Date(data.recordedAt).toISOString().slice(0, 10)}`,
      );

      // ── 5. Enqueue scoring (Phase 3) ───────────────────────────────────────
      await scoringQueue.add(
        `score-${battery.id}`,
        { batteryId: battery.id, triggeredBy: 'telemetry_ingest' } satisfies ScoringJob,
        {
          // Debounce: collapse multiple scoring requests for same battery
          jobId: `score-${battery.id}`,
          delay: 0,
        },
      );

      return result;
    },
    {
      connection: createRedisConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] ✗ job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  worker.on('error', err => {
    console.error('[worker] worker error:', err.message);
  });

  console.info(`[worker] Telemetry worker started (concurrency=${CONCURRENCY})`);
  return worker;
}

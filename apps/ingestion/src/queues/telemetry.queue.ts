/**
 * BullMQ queue definitions for battery telemetry ingestion.
 * Shared between the producer (loaders) and consumer (worker).
 */

import { Queue, QueueEvents } from 'bullmq';
import { redis } from '../redis';

export const TELEMETRY_QUEUE = 'battery.telemetry';
export const SCORING_QUEUE   = 'battery.scoring';

// ── Job payload types ─────────────────────────────────────────────────────────

export interface TelemetryJob {
  serialNumber: string;
  source: string;
  recordedAt: string;           // ISO 8601
  chemistry?: string;           // for auto-registration if battery not found

  // Core health
  stateOfHealth: number;        // 0–100
  stateOfCharge: number;        // 0–100
  fullChargeCapacityKwh: number;
  cycleCount: number;

  // Thermal
  cellTempMin: number;
  cellTempMax: number;
  cellTempAvg: number;

  // Electrical
  voltageMin: number;
  voltageMax: number;
  internalResistanceAvg?: number;

  // Usage
  chargingEvents24h?: number;
  dcFastChargeRatio?: number;
  odometer?: number;

  // Optional raw payload for audit
  rawPayload?: Record<string, unknown>;
}

export interface ScoringJob {
  batteryId: string;
  triggeredBy: 'telemetry_ingest' | 'manual' | 'scheduled';
}

// ── Queue instances ───────────────────────────────────────────────────────────

export const telemetryQueue = new Queue<TelemetryJob>(TELEMETRY_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },   // keep last 500 completed
    removeOnFail:    { count: 200 },    // keep last 200 failed for inspection
  },
});

export const scoringQueue = new Queue<ScoringJob>(SCORING_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 200 },
    removeOnFail:    { count: 100 },
  },
});

export const telemetryQueueEvents = new QueueEvents(TELEMETRY_QUEUE, {
  connection: redis,
});

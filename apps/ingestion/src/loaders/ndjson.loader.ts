#!/usr/bin/env tsx
/**
 * NDJSON loader — reads telemetry_stream.ndjson and enqueues jobs into BullMQ.
 *
 * Usage:
 *   pnpm load:ndjson                                    # default path
 *   pnpm load:ndjson -- --file ./data/synthetic/telemetry_stream.ndjson
 *   pnpm load:ndjson -- --file ./data/synthetic/telemetry_stream.ndjson --batch 200
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { telemetryQueue, type TelemetryJob } from '../queues/telemetry.queue';

const args = process.argv.slice(2);
const getArg = (name: string, fallback: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const FILE_PATH  = resolve(getArg('file', './data/synthetic/telemetry_stream.ndjson'));
const BATCH_SIZE = parseInt(getArg('batch', '100'));

async function main() {
  console.log(`\n📡 NDJSON Loader`);
  console.log(`   File : ${FILE_PATH}`);
  console.log(`   Batch: ${BATCH_SIZE} jobs\n`);

  const rl = createInterface({
    input: createReadStream(FILE_PATH),
    crlfDelay: Infinity,
  });

  let batch: TelemetryJob[] = [];
  let totalEnqueued = 0;
  let totalLines = 0;
  let parseErrors = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const jobs = batch.map(data => ({ name: `telemetry:${data.serialNumber}`, data }));
    await telemetryQueue.addBulk(jobs);
    totalEnqueued += batch.length;
    process.stdout.write(`  Enqueued ${totalEnqueued} jobs...\r`);
    batch = [];
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalLines++;

    try {
      const raw = JSON.parse(line);

      const job: TelemetryJob = {
        serialNumber:          raw.serialNumber,
        source:                raw.source ?? 'SYNTHETIC',
        chemistry:             raw.chemistry,
        recordedAt:            raw.recordedAt,
        stateOfHealth:         raw.stateOfHealth,
        stateOfCharge:         raw.stateOfCharge,
        fullChargeCapacityKwh: raw.fullChargeCapacityKwh,
        cycleCount:            raw.cycleCount,
        cellTempMin:           raw.cellTempMin,
        cellTempMax:           raw.cellTempMax,
        cellTempAvg:           raw.cellTempAvg,
        voltageMin:            raw.voltageMin,
        voltageMax:            raw.voltageMax,
        internalResistanceAvg: raw.internalResistanceAvg,
        chargingEvents24h:     raw.chargingEvents24h,
        dcFastChargeRatio:     raw.dcFastChargeRatio,
        odometer:              raw.odometer,
      };

      batch.push(job);
      if (batch.length >= BATCH_SIZE) await flush();
    } catch {
      parseErrors++;
    }
  }

  await flush();

  console.log(`\n✓ Done`);
  console.log(`  Lines read  : ${totalLines}`);
  console.log(`  Enqueued    : ${totalEnqueued}`);
  console.log(`  Parse errors: ${parseErrors}`);
  console.log(`\n  Worker will process jobs — start with: pnpm dev\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Loader failed:', err.message);
  process.exit(1);
});

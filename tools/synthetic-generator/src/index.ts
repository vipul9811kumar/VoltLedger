#!/usr/bin/env tsx
/**
 * VoltLedger Synthetic Data Generator
 *
 * Usage:
 *   pnpm generate                          # 50 batteries, 5yr history, writes JSON
 *   pnpm generate:small                    # 10 batteries, 1yr
 *   pnpm generate:fleet                    # 100 batteries, 5yr
 *   pnpm generate -- --seed-db             # write directly to PostgreSQL
 *   pnpm generate -- --batteries 25 --weeks 104 --out ./data
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { generateFleet, type GeneratedBattery } from './generator';
import { BATTERY_MODELS } from './models';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name: string, fallback: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (name: string) => args.includes(`--${name}`);

const BATTERY_COUNT    = parseInt(getArg('batteries', '50'));
const MAX_WEEKS        = parseInt(getArg('weeks', '260'));      // 5 years default
const SAMPLE_INTERVAL  = parseInt(getArg('sample', '1'));       // weekly
const OUTPUT_DIR       = getArg('out', './data/synthetic');
const SEED_DB          = hasFlag('seed-db');
const VERBOSE          = !hasFlag('quiet');

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n⚡ VoltLedger Synthetic Generator');
  console.log('─'.repeat(50));
  console.log(`  Batteries  : ${BATTERY_COUNT}`);
  console.log(`  Max history: ${MAX_WEEKS} weeks (${(MAX_WEEKS / 52).toFixed(1)} years)`);
  console.log(`  Sampling   : every ${SAMPLE_INTERVAL} week(s)`);
  console.log(`  Mode       : ${SEED_DB ? 'seed PostgreSQL' : 'write JSON'}`);
  console.log('─'.repeat(50));

  const startTime = Date.now();

  const fleet = generateFleet({
    batteryCount: BATTERY_COUNT,
    maxWeeks: MAX_WEEKS,
    sampleEveryNWeeks: SAMPLE_INTERVAL,
    verbose: VERBOSE,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Generated ${fleet.length} batteries in ${elapsed}s`);

  const totalPoints = fleet.reduce((sum, b) => sum + b.telemetry.length, 0);
  console.log(`  Total telemetry points: ${totalPoints.toLocaleString()}`);

  // ── Stats summary ──────────────────────────────────────────────────────────
  printStats(fleet);

  if (SEED_DB) {
    await seedDatabase(fleet);
  } else {
    writeJsonOutput(fleet, OUTPUT_DIR);
  }
}

function printStats(fleet: GeneratedBattery[]) {
  const chemCounts = fleet.reduce<Record<string, number>>((acc, b) => {
    acc[b.model.chemistry] = (acc[b.model.chemistry] ?? 0) + 1;
    return acc;
  }, {});

  const profileCounts = fleet.reduce<Record<string, number>>((acc, b) => {
    acc[b.usageProfile.name] = (acc[b.usageProfile.name] ?? 0) + 1;
    return acc;
  }, {});

  const sohs = fleet.map(b => b.summary.currentSoH);
  const avgSoH = sohs.reduce((a, b) => a + b, 0) / sohs.length;
  const minSoH = Math.min(...sohs);
  const maxSoH = Math.max(...sohs);

  const flagged = fleet.filter(
    b => b.summary.riskIndicators.abnormalDegradation || b.summary.riskIndicators.thermalAnomaly,
  ).length;

  console.log('\n── Fleet Statistics ──');
  console.log(`  SoH: avg ${avgSoH.toFixed(1)}%  min ${minSoH.toFixed(1)}%  max ${maxSoH.toFixed(1)}%`);
  console.log(`  Flagged for risk: ${flagged} (${((flagged / fleet.length) * 100).toFixed(0)}%)`);
  console.log(`  Chemistry: ${Object.entries(chemCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  Profiles:  ${Object.entries(profileCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // Distribution
  const grades = fleet.map(b => gradeFromSoH(b.summary.currentSoH, b.ageWeeks));
  const gradeCounts = grades.reduce<Record<string, number>>((acc, g) => {
    acc[g] = (acc[g] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  Risk grades: ${['A', 'B', 'C', 'D', 'F'].map(g => `${g}=${gradeCounts[g] ?? 0}`).join('  ')}`);
}

/** Rough grade preview — real scoring engine runs in apps/api */
function gradeFromSoH(soh: number, ageWeeks: number): string {
  const ageYears = ageWeeks / 52;
  // Expected SoH floor for age (simple linear benchmark)
  const expectedMin = Math.max(70, 100 - ageYears * 3);
  const delta = soh - expectedMin;
  if (delta >= 10) return 'A';
  if (delta >= 5)  return 'B';
  if (delta >= 0)  return 'C';
  if (delta >= -5) return 'D';
  return 'F';
}

function writeJsonOutput(fleet: GeneratedBattery[], outDir: string) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // 1. Battery models reference file
  writeFileSync(
    join(outDir, 'battery_models.json'),
    JSON.stringify(BATTERY_MODELS, null, 2),
  );

  // 2. Fleet manifest (no telemetry — quick reference)
  const manifest = fleet.map(b => ({
    id: b.id,
    serialNumber: b.serialNumber,
    vin: b.vin,
    modelId: b.model.id,
    modelName: b.model.modelName,
    manufacturer: b.model.manufacturer,
    chemistry: b.model.chemistry,
    usageProfile: b.usageProfile.name,
    manufacturedAt: b.manufacturedAt.toISOString(),
    ageWeeks: b.ageWeeks,
    summary: b.summary,
  }));
  writeFileSync(join(outDir, 'fleet_manifest.json'), JSON.stringify(manifest, null, 2));

  // 3. Individual battery files with full telemetry
  const batteriesDir = join(outDir, 'batteries');
  if (!existsSync(batteriesDir)) mkdirSync(batteriesDir);

  for (const battery of fleet) {
    const payload = {
      id: battery.id,
      serialNumber: battery.serialNumber,
      vin: battery.vin,
      model: battery.model,
      usageProfile: battery.usageProfile.name,
      manufacturedAt: battery.manufacturedAt.toISOString(),
      ageWeeks: battery.ageWeeks,
      summary: battery.summary,
      telemetry: battery.telemetry.map(t => ({
        ...t,
        recordedAt: t.recordedAt.toISOString(),
      })),
    };
    writeFileSync(
      join(batteriesDir, `${battery.serialNumber}.json`),
      JSON.stringify(payload, null, 2),
    );
  }

  // 4. Flat telemetry NDJSON (ready for Kafka/BullMQ ingestion)
  const ndjsonPath = join(outDir, 'telemetry_stream.ndjson');
  const lines: string[] = [];
  for (const battery of fleet) {
    for (const point of battery.telemetry) {
      lines.push(JSON.stringify({
        batteryId: battery.id,
        serialNumber: battery.serialNumber,
        chemistry: battery.model.chemistry,
        source: 'SYNTHETIC',
        ...point,
        recordedAt: point.recordedAt.toISOString(),
      }));
    }
  }
  writeFileSync(ndjsonPath, lines.join('\n'));

  const totalPoints = fleet.reduce((s, b) => s + b.telemetry.length, 0);
  console.log(`\n✓ Output written to ${outDir}/`);
  console.log(`  battery_models.json         — ${BATTERY_MODELS.length} models`);
  console.log(`  fleet_manifest.json         — ${fleet.length} batteries`);
  console.log(`  batteries/*.json            — ${fleet.length} files with full telemetry`);
  console.log(`  telemetry_stream.ndjson     — ${totalPoints.toLocaleString()} points (NDJSON for ingestion)`);
  console.log('\n  Next: pipe telemetry_stream.ndjson into apps/ingestion consumer\n');
}

async function seedDatabase(fleet: GeneratedBattery[]) {
  console.log('\n📦 Seeding PostgreSQL...');
  try {
    // Dynamic import so JSON-only mode doesn't require DB connection
    const { prisma } = await import('@voltledger/db');

    for (const battery of fleet) {
      // Upsert battery model
      const model = await prisma.batteryModel.upsert({
        where: { id: battery.model.id },
        update: {},
        create: {
          id: battery.model.id,
          modelName: battery.model.modelName,
          manufacturer: battery.model.manufacturer,
          chemistry: battery.model.chemistry as any,
          capacityKwh: battery.model.capacityKwh,
          nominalVoltageV: battery.model.nominalVoltageV,
          weightKg: battery.model.weightKg,
          ratedCycleLife: battery.model.ratedCycleLife,
          calendarLifeYears: battery.model.calendarLifeYears,
          warrantyYears: battery.model.warrantyYears,
          hazardousSubstances: [],
          extinguishingAgents: [],
        },
      });

      // Create battery
      const dbBattery = await prisma.battery.upsert({
        where: { serialNumber: battery.serialNumber },
        update: { lastTelemetryAt: battery.telemetry.at(-1)?.recordedAt },
        create: {
          id: battery.id,
          serialNumber: battery.serialNumber,
          vin: battery.vin,
          batteryModelId: model.id,
          chemistry: battery.model.chemistry as any,
          nominalCapacityKwh: battery.model.capacityKwh,
          dataSource: 'SYNTHETIC' as any,
          manufacturedAt: battery.manufacturedAt,
          lastTelemetryAt: battery.telemetry.at(-1)?.recordedAt,
        },
      });

      // Bulk insert telemetry
      await prisma.batteryTelemetryPoint.createMany({
        data: battery.telemetry.map(t => ({
          batteryId: dbBattery.id,
          recordedAt: t.recordedAt,
          stateOfHealth: t.stateOfHealth,
          stateOfCharge: t.stateOfCharge,
          fullChargeCapacityKwh: t.fullChargeCapacityKwh,
          cycleCount: t.cycleCount,
          cellTempMin: t.cellTempMin,
          cellTempMax: t.cellTempMax,
          cellTempAvg: t.cellTempAvg,
          voltageMin: t.voltageMin,
          voltageMax: t.voltageMax,
          internalResistanceAvg: t.internalResistanceAvg,
          chargingEvents24h: t.chargingEvents24h,
          dcFastChargeRatio: t.dcFastChargeRatio,
          odometer: t.odometer,
          source: 'SYNTHETIC' as any,
        })),
        skipDuplicates: true,
      });

      process.stdout.write(`  ✓ ${battery.serialNumber} (${battery.telemetry.length} points)\n`);
    }

    await prisma.$disconnect();
    console.log('\n✓ Database seeded successfully.\n');
  } catch (err) {
    console.error('\n✗ DB seed failed:', (err as Error).message);
    console.error('  Make sure PostgreSQL is running: pnpm infra:up\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * Bulk-score all batteries that have no RiskScore yet.
 * Usage:
 *   pnpm bulk-score              # scores all unscored batteries
 *   pnpm bulk-score --all        # re-scores every battery (force refresh)
 *   pnpm bulk-score --serial CATL-US-23-00001  # score one battery
 */
import { prisma } from '@voltledger/db';
import { runIntelligenceEngine } from '@voltledger/scoring';

const args   = process.argv.slice(2);
const forceAll = args.includes('--all');
const singleSerial = args.includes('--serial') ? args[args.indexOf('--serial') + 1] : null;

const CONCURRENCY = 5; // parallel workers

async function scoreBattery(serial: string, idx: number, total: number): Promise<'ok' | 'skip' | 'err'> {
  try {
    const battery = await prisma.battery.findUnique({
      where: { serialNumber: serial },
      include: { batteryModel: true },
    });

    if (!battery) {
      console.log(`  [${idx}/${total}] ⚠ SKIP  ${serial} — not found`);
      return 'skip';
    }

    const recentPoints = await prisma.batteryTelemetryPoint.findMany({
      where: { batteryId: battery.id },
      orderBy: { recordedAt: 'desc' },
      take: 12,
    });

    await runIntelligenceEngine(prisma, { battery, recentPoints });

    console.log(`  [${idx}/${total}] ✓ OK    ${serial}`);
    return 'ok';
  } catch (err: any) {
    console.log(`  [${idx}/${total}] ✗ ERR   ${serial} — ${err.message}`);
    return 'err';
  }
}

async function main() {
  let serials: string[];

  if (singleSerial) {
    serials = [singleSerial];
  } else if (forceAll) {
    const batteries = await prisma.battery.findMany({ select: { serialNumber: true } });
    serials = batteries.map(b => b.serialNumber);
  } else {
    const batteries = await prisma.battery.findMany({
      where: { riskScores: { none: {} } },
      select: { serialNumber: true },
    });
    serials = batteries.map(b => b.serialNumber);
  }

  const total = serials.length;
  if (total === 0) {
    console.log('✅ All batteries already scored. Use --all to force re-score.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n🔋 Scoring ${total} batter${total === 1 ? 'y' : 'ies'} (concurrency=${CONCURRENCY})...\n`);
  const start = Date.now();

  let ok = 0, skip = 0, err = 0;

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < serials.length; i += CONCURRENCY) {
    const chunk = serials.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((serial, j) => scoreBattery(serial, i + j + 1, total))
    );
    results.forEach(r => { if (r === 'ok') ok++; else if (r === 'skip') skip++; else err++; });
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n──────────────────────────────`);
  console.log(`✅  ${ok} scored  ·  ⚠ ${skip} skipped  ·  ✗ ${err} errors  ·  ${elapsed}s`);

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

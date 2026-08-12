import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { prisma } from '@voltledger/db';

const execFileAsync = promisify(execFile);

const N_MIN = 1;
const N_MAX = 2000;

function validateInt(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const n = validateInt(body.n, N_MIN, N_MAX);
  // seed can be any 32-bit-ish integer, no meaningful business-logic bound —
  // still validated as a real integer, never passed through unchecked.
  const seed = validateInt(body.seed, -2_147_483_648, 2_147_483_647);

  if (n === null) {
    return NextResponse.json({ error: `n must be an integer between ${N_MIN} and ${N_MAX}` }, { status: 400 });
  }
  if (seed === null) {
    return NextResponse.json({ error: 'seed must be a 32-bit integer' }, { status: 400 });
  }

  const repoRoot = join(process.cwd(), '..', '..');
  const tsxBin = join(repoRoot, 'node_modules', '.bin', 'tsx');
  const scriptPath = join(repoRoot, 'tools', 'portfolio-sim', 'src', 'run.ts');

  try {
    // execFile with an argument array (never a shell string) — n/seed are
    // already validated integers, but this avoids any injection surface
    // regardless.
    const { stdout, stderr } = await execFileAsync(
      tsxBin,
      [scriptPath, '--n', String(n), '--seed', String(seed)],
      { cwd: repoRoot, env: process.env, timeout: 120_000 },
    );
    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Simulation run failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const latestRun = await prisma.portfolioSimRun.findFirst({
    orderBy: { runAt: 'desc' },
    include: { outcomes: true },
  });
  return NextResponse.json(latestRun);
}

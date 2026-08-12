import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Build spec v2 WS-B acceptance criterion: "no synthetic data appears in
 * any accuracy figure." This package is allowed to read
 * @voltledger/synthetic-generator's static CHEMISTRY_PARAMS/BATTERY_MODELS
 * constants (that's the model-under-test) — it must never import the noisy
 * trajectory/telemetry generation functions, which would let synthetic
 * output masquerade as ground truth in a validation report.
 */
const FORBIDDEN_PATTERNS = [
  'generateDegradationTrajectory',
  'generateFleet',
  'computeThermalProfile',
  'computeUsageSnapshot',
  'tools/synthetic-generator/src/degradation',
  'tools/synthetic-generator/src/generator',
  "from './degradation'",
  "from './generator'",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

test('packages/validation never imports synthetic trajectory/telemetry generation', () => {
  const src = join(__dirname);
  const files = walk(src);
  assert.ok(files.length > 0, 'expected to find validation source files to scan');

  const offenders: string[] = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf-8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (text.includes(pattern)) offenders.push(`${f}: ${pattern}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `packages/validation must never reference synthetic trajectory generation (found: ${offenders.join(', ')})`,
  );
});

test('packages/scoring never imports @voltledger/calibration or @voltledger/validation', () => {
  const scoringSrc = join(__dirname, '..', '..', 'scoring', 'src');
  const files = walk(scoringSrc);
  assert.ok(files.length > 0, 'expected to find scoring source files to scan');

  const offenders = files.filter((f) => {
    const text = readFileSync(f, 'utf-8');
    return text.includes('@voltledger/calibration') || text.includes('@voltledger/validation');
  });
  assert.deepEqual(offenders, [], `packages/scoring must stay independent of validation packages (found in: ${offenders.join(', ')})`);
});

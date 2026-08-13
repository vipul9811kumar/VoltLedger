import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Calibrated numbers must only enter packages/scoring via a hand-reviewed edit to
 * constants.ts, never a live import — same boundary packages/calibration's
 * holdout-guard.test.ts and packages/validation's no-synthetic-data.test.ts enforce for
 * their own packages.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('packages/scoring never imports @voltledger/rv-calibration', () => {
  const scoringSrc = join(__dirname, '..', '..', 'scoring', 'src');
  const files = walk(scoringSrc);
  assert.ok(files.length > 0, 'expected to find scoring source files to scan');

  const offenders = files.filter((f) => readFileSync(f, 'utf-8').includes('@voltledger/rv-calibration'));
  assert.deepEqual(
    offenders,
    [],
    `packages/scoring must not import @voltledger/rv-calibration (found in: ${offenders.join(', ')})`,
  );
});

test("packages/scoring's package.json declares no dependency on @voltledger/rv-calibration", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'scoring', 'package.json'), 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(
    !('@voltledger/rv-calibration' in deps),
    'packages/scoring/package.json must not depend on @voltledger/rv-calibration',
  );
});

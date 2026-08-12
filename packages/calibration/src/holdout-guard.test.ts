import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The circularity landmine (build spec v2, §1.1): the model-under-test
 * (packages/scoring) must never see the holdout split this package produces
 * — not even transitively. If scoring imports @voltledger/calibration at
 * all, that guarantee is gone. This test is the enforcement point the build
 * spec's WS-A acceptance criterion calls for.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('packages/scoring never imports @voltledger/calibration', () => {
  const scoringSrc = join(__dirname, '..', '..', 'scoring', 'src');
  const files = walk(scoringSrc);
  assert.ok(files.length > 0, 'expected to find scoring source files to scan');

  const offenders = files.filter((f) => readFileSync(f, 'utf-8').includes('@voltledger/calibration'));
  assert.deepEqual(
    offenders,
    [],
    `packages/scoring must not import @voltledger/calibration (found in: ${offenders.join(', ')})`,
  );
});

test("packages/scoring's package.json declares no dependency on @voltledger/calibration", () => {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'scoring', 'package.json'), 'utf-8'),
  );
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(
    !('@voltledger/calibration' in deps),
    'packages/scoring/package.json must not depend on @voltledger/calibration',
  );
});

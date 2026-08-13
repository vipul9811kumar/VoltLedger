import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PassportContext, PassportResolveResult } from '@voltledger/types';
import { reconcileSoH } from '@voltledger/scoring';
import { MockPassportResolver } from './mock.resolver';
import { CatenaXPassportResolver } from './resolvers/catena-x.resolver';
import { expectedSoHForIdentifier } from './scenario-generator';

const mock = new MockPassportResolver();

/** Mirrors the PassportContext projection duplicated in apps/api/src/routes/batteries.ts —
 *  a resolver only ever produces the passport side; isVerified/identityChainValid come from a
 *  separate verification step, so they're passed in explicitly here. */
function toPassportContext(
  result: PassportResolveResult,
  isVerified: boolean,
  identityChainValid?: boolean,
): PassportContext | undefined {
  if (!result.success || !result.passportData) return undefined;
  const p = result.passportData;
  return {
    passportId: p.passportUniqueId,
    tierAccess: result.tierAccess,
    isVerified,
    identityChainValid,
    carbonFootprintKgCo2e: p.carbonFootprintKgCo2e,
    recycledContentPct: p.recycledContentPct,
    unitSoH: p.unitSoH,
    chargeCycleCount: p.chargeCycleCount,
    tempHistoryMax: p.tempHistoryMax,
    batteryStatusCode: p.batteryStatusCode,
  };
}

test('NO_PASSPORT: resolve fails; reconciliation falls back to telemetry-only', async () => {
  const result = await mock.resolve('TEST-NOPASS-001', { forceScenario: 'NO_PASSPORT' });
  assert.equal(result.success, false);

  const ctx = toPassportContext(result, false);
  assert.equal(ctx, undefined);

  const reconciled = reconcileSoH(82, ctx);
  assert.equal(reconciled.source, 'TELEMETRY');
});

test('PUBLIC_ONLY: resolves but carries no restricted SoH; reconciliation ignores it', async () => {
  const result = await mock.resolve('TEST-PUBONLY-002', { forceScenario: 'PUBLIC_ONLY' });
  assert.equal(result.success, true);
  assert.equal(result.tierAccess, 'PUBLIC');
  assert.equal(result.passportData?.unitSoH, undefined);

  const ctx = toPassportContext(result, true, true);
  const reconciled = reconcileSoH(82, ctx);
  assert.equal(reconciled.source, 'TELEMETRY'); // PUBLIC tier is treated like "no restricted data" by reconcileSoH
});

test('RESTRICTED_CONSISTENT + telemetry present: blends passport + telemetry, high confidence', async () => {
  const identifier = 'TEST-CONSISTENT-003';
  const result = await mock.resolve(identifier, { forceScenario: 'RESTRICTED_CONSISTENT' });
  assert.equal(result.success, true);
  assert.equal(result.tierAccess, 'RESTRICTED');
  assert.ok(result.passportData?.unitSoH != null);

  const { expectedSoH } = expectedSoHForIdentifier(identifier);
  const ctx = toPassportContext(result, true, true);
  const reconciled = reconcileSoH(expectedSoH, ctx); // telemetry follows the same curve → should agree

  assert.equal(reconciled.source, 'BLENDED');
  assert.ok(Math.abs(reconciled.delta ?? 0) <= 8, `expected small delta, got ${reconciled.delta}`);
  assert.ok(reconciled.confidence >= 0.85, `expected high confidence, got ${reconciled.confidence}`);
});

test('RESTRICTED_CONSISTENT, no telemetry: passport-only reconciliation', async () => {
  const result = await mock.resolve('TEST-PASSONLY-004', { forceScenario: 'RESTRICTED_CONSISTENT' });
  const ctx = toPassportContext(result, true, true);
  const reconciled = reconcileSoH(undefined, ctx);
  assert.equal(reconciled.source, 'PASSPORT');
});

test('RESTRICTED_CONFLICTING: passport SoH deliberately diverges from curve-following telemetry — fires the fraud-signal path', async () => {
  const identifier = 'TEST-CONFLICT-005';
  const result = await mock.resolve(identifier, { forceScenario: 'RESTRICTED_CONFLICTING' });
  assert.equal(result.tierAccess, 'RESTRICTED');

  const { expectedSoH } = expectedSoHForIdentifier(identifier);
  const ctx = toPassportContext(result, true, true);
  const reconciled = reconcileSoH(expectedSoH, ctx);

  assert.equal(reconciled.source, 'BLENDED');
  assert.ok(Math.abs(reconciled.delta ?? 0) > 8, `expected a >8pp delta, got ${reconciled.delta}`);
  assert.ok(reconciled.confidence < 0.92, `expected reduced confidence from the discrepancy, got ${reconciled.confidence}`);
});

test('TAMPERED: identity check (mirroring the verify route logic) fails', async () => {
  const serial = 'TEST-TAMPER-006';
  const result = await mock.resolve(serial, { forceScenario: 'TAMPERED' });
  assert.equal(result.tierAccess, 'RESTRICTED');
  assert.ok(result.passportData?.unitSoH != null); // otherwise a normal-looking passport

  // Same check apps/api/src/routes/passport.ts's /verify route applies.
  const passportMatchesSerial = result.passportData!.passportUniqueId.includes(serial);
  assert.equal(passportMatchesSerial, false);
});

test('REISSUED_IDENTITY: repurposed status + a link to the prior passport, identity otherwise valid', async () => {
  const serial = 'TEST-REISSUE-007';
  const result = await mock.resolve(serial, { forceScenario: 'REISSUED_IDENTITY' });
  assert.equal(result.passportData?.batteryStatusCode, 'REPURPOSED');
  assert.ok(result.passportData?.priorPassportId, 'expected a priorPassportId link');
  assert.ok(result.passportData!.passportUniqueId.includes(serial), 'identity chain should still validate');
});

test('ACCESS_PENDING vs. granted: same battery, restricted fields withheld until access is granted', async () => {
  const identifier = 'TEST-PENDING-008';
  const pending = await mock.resolve(identifier, { forceScenario: 'ACCESS_PENDING' });
  assert.equal(pending.tierAccess, 'RESTRICTED');
  assert.equal(pending.restrictedAccessStatus, 'PENDING_LEGITIMATE_INTEREST');
  assert.equal(pending.passportData?.unitSoH, undefined); // fields withheld

  const pendingCtx = toPassportContext(pending, true, true);
  const pendingReconciled = reconcileSoH(82, pendingCtx);
  assert.equal(pendingReconciled.source, 'TELEMETRY'); // working fallback, doesn't depend on the ruling

  const granted = await mock.resolve(identifier, { forceScenario: 'RESTRICTED_CONSISTENT' });
  assert.equal(granted.restrictedAccessStatus, 'GRANTED');
  assert.ok(granted.passportData?.unitSoH != null);
});

test('forceScenario is honored by a non-mock resolver stub, tagged with its own framework', async () => {
  const catenaX = new CatenaXPassportResolver();
  const result = await catenaX.resolve('BPNL-TEST-009', { forceScenario: 'RESTRICTED_CONSISTENT' });
  assert.equal(result.framework, 'CATENA_X');
  assert.equal(result.success, true);
  assert.ok(result.passportData?.unitSoH != null);
});

test('regression: default (no forceScenario) mock behavior is unchanged — deterministic per identifier', async () => {
  // Compare fields that don't depend on Date.now() (manufacturingDate/issuedAt/expiresAt are
  // computed relative to call time and legitimately differ by milliseconds between calls,
  // same as before this refactor — not a determinism regression).
  const a = await mock.resolve('CATL-EU-24-00001');
  const b = await mock.resolve('CATL-EU-24-00001');
  assert.equal(a.tierAccess, b.tierAccess);
  assert.equal(a.passportData?.passportUniqueId, b.passportData?.passportUniqueId);
  assert.equal(a.passportData?.ratedCapacityAh, b.passportData?.ratedCapacityAh);
  assert.equal(a.passportData?.unitSoH, b.passportData?.unitSoH);
  assert.equal(a.passportData?.chargeCycleCount, b.passportData?.chargeCycleCount);
});

test('regression: default (no forceScenario) stub resolvers still fail honestly', async () => {
  const catenaX = new CatenaXPassportResolver();
  const result = await catenaX.resolve('BPNL-TEST-010');
  assert.equal(result.success, false);
  assert.match(result.error ?? '', /not yet implemented/);
});

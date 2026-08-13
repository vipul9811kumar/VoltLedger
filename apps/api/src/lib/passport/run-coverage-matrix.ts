/**
 * WS-F coverage-matrix proof.
 *
 * Runs one precondition→verification→results pass per data-completeness cell in build spec
 * v2 §3's scenario matrix, using the real resolver + reconciliation code (no DB, no HTTP —
 * pure in-process calls), and writes docs/validation/COVERAGE_MATRIX.md narrating each run.
 *
 * "forceScenario" (see scenario-generator.ts) is what makes each cell reachable on demand
 * instead of relying on the mock resolver's organic hash-random distribution.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PassportContext, PassportResolveResult, CoverageScenario } from '@voltledger/types';
import { reconcileSoH } from '@voltledger/scoring';
import { MockPassportResolver } from './mock.resolver';
import { expectedSoHForIdentifier } from './scenario-generator';

const mock = new MockPassportResolver();

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

interface CellRun {
  cell: string;
  matrixLabel: string;
  identifier: string;
  scenario: CoverageScenario;
  hasTelemetry: boolean;
  precondition: string;
  verification: string;
  results: string;
}

async function runCellAsync(
  cellLabel: string,
  matrixLabel: string,
  identifier: string,
  scenario: CoverageScenario,
  telemetryPresent: boolean,
): Promise<CellRun> {
  const result = await mock.resolve(identifier, { forceScenario: scenario });
  const { chemistry, ageYears, expectedSoH } = expectedSoHForIdentifier(identifier);
  const telemetrySoH = telemetryPresent ? Math.round(expectedSoH * 10) / 10 : undefined;

  const precondition = [
    `chemistry ${chemistry}, age ${ageYears.toFixed(1)}yr`,
    result.success ? `passport resolved (${result.tierAccess}${result.restrictedAccessStatus ? `, access ${result.restrictedAccessStatus}` : ''})` : 'no passport resolved',
    telemetryPresent ? `telemetry present (SoH ${telemetrySoH}%)` : 'no telemetry',
  ].join('; ');

  let verification = 'not applicable';
  if (result.success && result.passportData) {
    const identityValid = result.passportData.passportUniqueId.includes(identifier.toUpperCase());
    verification = identityValid
      ? 'identity chain valid (passportUniqueId contains serial)'
      : '**identity chain INVALID** — passportUniqueId does not contain the battery serial (tamper signal)';
    if (result.passportData.priorPassportId) {
      verification += `; linked to prior passport \`${result.passportData.priorPassportId}\` (reissued/repurposed identity)`;
    }
  }

  const ctx = toPassportContext(result, true, result.success ? result.passportData?.passportUniqueId.includes(identifier.toUpperCase()) : undefined);
  const reconciled = reconcileSoH(telemetrySoH, ctx);
  const results = `reconciled SoH ${reconciled.value.toFixed(1)}% via **${reconciled.source}**, confidence ${(reconciled.confidence * 100).toFixed(0)}%` +
    (reconciled.delta != null ? `, passport↔telemetry Δ${reconciled.delta > 0 ? '+' : ''}${reconciled.delta.toFixed(1)}pp` : '');

  return { cell: cellLabel, matrixLabel, identifier, scenario, hasTelemetry: telemetryPresent, precondition, verification, results };
}

async function main() {
  const runs: CellRun[] = [];

  runs.push(await runCellAsync('Full (passport + telemetry)', 'full passport+telemetry', 'COVMX-FULL-001', 'RESTRICTED_CONSISTENT', true));
  runs.push(await runCellAsync('Passport-only', 'passport-only', 'COVMX-PASSONLY-002', 'RESTRICTED_CONSISTENT', false));
  runs.push(await runCellAsync('Telemetry-only', 'telemetry-only', 'COVMX-TELONLY-003', 'NO_PASSPORT', true));
  runs.push(await runCellAsync('Neither (2027 forward-only, pre-regulation asset)', 'neither (2027 forward-only)', 'COVMX-NEITHER-004', 'NO_PASSPORT', false));
  runs.push(await runCellAsync('Conflicting (passport vs. telemetry disagree >8pp)', 'conflicting', 'COVMX-CONFLICT-005', 'RESTRICTED_CONFLICTING', true));
  runs.push(await runCellAsync('Tampered (forged passport identity)', 'tampered', 'COVMX-TAMPER-006', 'TAMPERED', true));
  runs.push(await runCellAsync('Reissued identity (repurposed/second-life battery)', 'repurposed/second-life (§7 item 7)', 'COVMX-REISSUE-007', 'REISSUED_IDENTITY', true));

  // Access-pending vs. granted — run twice on the same identifier to show both outcomes
  // (build spec §7 item 5: "model both outcomes").
  const pendingRun = await runCellAsync('Access pending Commission implementing act', 'access pending (§8 guardrail)', 'COVMX-PENDING-008', 'ACCESS_PENDING', true);
  const grantedRun = await runCellAsync('Same battery, access granted', 'access granted (§8 guardrail)', 'COVMX-PENDING-008', 'RESTRICTED_CONSISTENT', true);
  runs.push(pendingRun, grantedRun);

  const sections = runs.map(r => `### ${r.cell}

- **Matrix cell:** ${r.matrixLabel}
- **Precondition:** ${r.precondition}
- **Verification:** ${r.verification}
- **Results:** ${r.results}
`).join('\n');

  const upliftNote = `The access-pending/granted pair above uses the *same* battery
(\`COVMX-PENDING-008\`) run twice — once with restricted fields withheld
(\`ACCESS_PENDING\`) and once with them available (\`RESTRICTED_CONSISTENT\`) — to show both
outcomes side by side, per build spec §7 item 5 ("model both outcomes; keep telemetry-only
fallback so the product never depends on the ruling"). Compare the two \`Results\` lines above:
the pending run falls back to \`TELEMETRY\` source; the granted run reconciles via
\`BLENDED\`/\`PASSPORT\` with materially higher confidence — concretely showing what legitimate-
interest access is worth once granted, without the product ever being blocked while it waits.`;

  const doc = `# Coverage Matrix (WS-F)

## What this is and isn't

This proves build spec v2 §3's "data-completeness axis" — the axis the spec calls VoltLedger's
actual differentiator ("anyone scores a battery with perfect data; VoltLedger's value shows in
the ugly cells") — by running the real resolver and reconciliation code (\`reconcileSoH\` in
\`packages/scoring/src/passport.ts\`, completely unmodified by WS-F) against a deliberately
forced version of every matrix cell, in-process, no DB or HTTP involved.

\`forceScenario\` (see \`apps/api/src/lib/passport/scenario-generator.ts\`) is what makes each
cell reachable on demand — it is **not exposed over the public API** in this pass; it only
exists for this report and \`coverage-matrix.test.ts\`'s hard assertions, deliberately, since
\`POST /v1/passport/resolve\` is reachable by any authenticated lender API key and its output
gets persisted and later feeds real scoring/LTV. Whether and how a live demo lets someone pick
a scenario interactively, with proper gating, is WS-G's job (the demo surface), not this
workstream's.

## Matrix cells

${sections}

## Access pending vs. granted (both outcomes, side by side)

${upliftNote}

## Known limitations

- The four non-mock resolver stubs (Catena-X, GS1, Direct-OEM, Aggregator) can also produce
  every scenario above via \`forceScenario\` (see \`coverage-matrix.test.ts\`'s dedicated test for
  this), but this report only exercises the mock resolver, since that's the one path an actual
  demo runs through today — real identifiers never route to the other four resolvers in
  practice (their \`canHandle()\` checks require BPN/GTIN/OEM-prefixed identifiers the synthetic
  generator doesn't produce).
- This report calls \`reconcileSoH\` directly, not the full \`runIntelligenceEngine\`/
  \`computeRiskScore\` pipeline — the coverage-state logic being proven here lives entirely in
  \`reconcileSoH\`, and that function was verified unmodified by WS-F (see
  \`packages/scoring/src/passport.ts\`).

## How to reproduce

\`pnpm coverage-matrix\` (from repo root) regenerates this file.
`;

  const docsDir = join(__dirname, '..', '..', '..', '..', '..', 'docs', 'validation');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'COVERAGE_MATRIX.md'), doc);

  console.log(`Ran ${runs.length} coverage-matrix cells.`);
  for (const r of runs) {
    console.log(`  ${r.cell}: ${r.results}`);
  }
  console.log(`\nWrote docs/validation/COVERAGE_MATRIX.md`);
}

main();

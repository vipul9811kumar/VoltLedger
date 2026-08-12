import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { prisma } from '@voltledger/db';
import { generatePortfolio, makeRng } from './generate-portfolio';
import { scoreWithSignal, scoreWithoutSignal } from './score-loan';
import { simulateLoanLifecycle } from './hazard';
import { summarizeArm, cohortBreakdown } from './aggregate';
import { renderResultsReport } from './report';
import { renderMethodologyNote, METHODOLOGY_VERSION } from './methodology';
import type { LoanOutcome, MethodologyParams } from './types';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback: string) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    n: parseInt(get('n', '300')),
    seed: parseInt(get('seed', '42')),
  };
}

async function main() {
  const { n, seed } = parseArgs();

  const paramsPath = join(__dirname, '..', 'data', 'methodology-params.json');
  const params: MethodologyParams = JSON.parse(readFileSync(paramsPath, 'utf-8'));

  console.log(`Generating ${n}-loan synthetic portfolio (seed=${seed})...`);
  const loans = generatePortfolio(n, seed, params);

  const withOutcomes: LoanOutcome[] = [];
  const withoutOutcomes: LoanOutcome[] = [];

  // Matched-pair design: each loan gets its own per-loan RNG, freshly seeded
  // identically for both arms, so WITH and WITHOUT see the same random
  // "luck" in whether/when a default rolls — the only things that can differ
  // between arms are the policy-driven inputs (LTV band -> probability,
  // loan amount -> recovery cap), not independent noise. This is what makes
  // the loss delta attributable to the policy, per Gate D's "what's held
  // constant."
  for (const loan of loans) {
    const withOrigination = scoreWithSignal(loan);
    const withoutOrigination = scoreWithoutSignal(loan, params);

    const loanSeed = seed * 1_000_003 + loan.index;
    withOutcomes.push(simulateLoanLifecycle(loan, withOrigination, params, makeRng(loanSeed)));
    withoutOutcomes.push(simulateLoanLifecycle(loan, withoutOrigination, params, makeRng(loanSeed)));
  }

  const withSummary = summarizeArm(withOutcomes);
  const withoutSummary = summarizeArm(withoutOutcomes);
  const lossDeltaUsd = withoutSummary.totalNetLossUsd - withSummary.totalNetLossUsd;

  const byChemistry = cohortBreakdown(withOutcomes, withoutOutcomes, (o) => o.loan.chemistry);
  const bySegment = cohortBreakdown(withOutcomes, withoutOutcomes, (o) => o.loan.segment);

  // ── Persist ──────────────────────────────────────────────────────────────
  const run = await prisma.portfolioSimRun.create({
    data: {
      methodologyVersion: METHODOLOGY_VERSION,
      nLoans: n,
      seed,
      provenance: 'SIMULATED_CALIBRATED',
      withNetLossUsd: withSummary.totalNetLossUsd,
      withoutNetLossUsd: withoutSummary.totalNetLossUsd,
      lossDeltaUsd,
      withLgdPct: withSummary.lossGivenDefaultPct,
      withoutLgdPct: withoutSummary.lossGivenDefaultPct,
    },
  });

  const outcomeRows = [...withOutcomes, ...withoutOutcomes].map((o) => ({
    runId: run.id,
    chemistry: o.loan.chemistry,
    segment: o.loan.segment,
    arm: o.arm,
    originatedLtvPct: o.origination.originatedLtvPct,
    loanAmountUsd: o.origination.loanAmountUsd,
    defaulted: o.defaulted,
    defaultMonth: o.defaultMonth,
    realizedRecoveryUsd: o.realizedRecoveryUsd,
    netLossUsd: o.netLossUsd,
  }));
  await prisma.simLoanOutcome.createMany({ data: outcomeRows });

  // ── Reports ──────────────────────────────────────────────────────────────
  const docsDir = join(__dirname, '..', '..', '..', 'docs', 'validation');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(
    join(docsDir, 'PORTFOLIO_LOSS_SIMULATION.md'),
    renderResultsReport({
      generatedAt: run.runAt.toISOString(),
      seed,
      nLoans: n,
      withSummary,
      withoutSummary,
      byChemistry,
      bySegment,
    }),
  );

  const toolDir = join(__dirname, '..');
  writeFileSync(join(toolDir, 'METHODOLOGY.md'), renderMethodologyNote(params));

  console.log(`\nPortfolioSimRun ${run.id} — ${n} loans x 2 arms.`);
  console.log(`  WITH:    net loss ${withSummary.totalNetLossUsd.toFixed(0)} USD, default rate ${withSummary.defaultRatePct.toFixed(2)}%, LGD ${withSummary.lossGivenDefaultPct.toFixed(2)}%`);
  console.log(`  WITHOUT: net loss ${withoutSummary.totalNetLossUsd.toFixed(0)} USD, default rate ${withoutSummary.defaultRatePct.toFixed(2)}%, LGD ${withoutSummary.lossGivenDefaultPct.toFixed(2)}%`);
  console.log(`  Loss delta: ${lossDeltaUsd.toFixed(0)} USD`);
  console.log(`\nWrote docs/validation/PORTFOLIO_LOSS_SIMULATION.md`);
  console.log(`Wrote tools/portfolio-sim/METHODOLOGY.md`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

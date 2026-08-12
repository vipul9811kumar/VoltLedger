import Link from 'next/link';
import { prisma } from '@voltledger/db';
import { summarizeArm, cohortBreakdown } from '@/lib/aggregate';
import { RunSummary } from '@/components/RunSummary';
import { CohortTable } from '@/components/CohortTable';

export const dynamic = 'force-dynamic';

export default async function LatestRunPage() {
  const run = await prisma.portfolioSimRun.findFirst({
    orderBy: { runAt: 'desc' },
    include: { outcomes: true },
  });

  if (!run) {
    return (
      <div className="card">
        <p className="text-slate-300">
          No simulation runs yet. Go to{' '}
          <Link href="/parameters" className="text-accent">Parameters</Link> and click "Run simulation".
        </p>
      </div>
    );
  }

  const withOutcomes = run.outcomes.filter((o) => o.arm === 'WITH');
  const withoutOutcomes = run.outcomes.filter((o) => o.arm === 'WITHOUT');
  const withSummary = summarizeArm(withOutcomes);
  const withoutSummary = summarizeArm(withoutOutcomes);
  const byChemistry = cohortBreakdown(run.outcomes, (o) => o.chemistry);
  const bySegment = cohortBreakdown(run.outcomes, (o) => o.segment);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Latest run</h1>
        <p className="text-sm text-slate-400 mt-1">
          See <Link href="/runs" className="text-accent">run history</Link> for earlier runs, or{' '}
          <Link href="/parameters" className="text-accent">parameters</Link> to adjust and re-run.
        </p>
      </div>
      <RunSummary
        nLoans={run.nLoans}
        seed={run.seed}
        runAt={run.runAt.toISOString()}
        withSummary={withSummary}
        withoutSummary={withoutSummary}
      />
      <CohortTable title="By chemistry" rows={byChemistry} />
      <CohortTable title="By segment" rows={bySegment} />
    </div>
  );
}

import { notFound } from 'next/navigation';
import { prisma } from '@voltledger/db';
import { summarizeArm, cohortBreakdown } from '@/lib/aggregate';
import { RunSummary } from '@/components/RunSummary';
import { CohortTable } from '@/components/CohortTable';

export const dynamic = 'force-dynamic';

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const run = await prisma.portfolioSimRun.findUnique({
    where: { id: params.id },
    include: { outcomes: true },
  });

  if (!run) notFound();

  const withOutcomes = run.outcomes.filter((o) => o.arm === 'WITH');
  const withoutOutcomes = run.outcomes.filter((o) => o.arm === 'WITHOUT');
  const withSummary = summarizeArm(withOutcomes);
  const withoutSummary = summarizeArm(withoutOutcomes);
  const byChemistry = cohortBreakdown(run.outcomes, (o) => o.chemistry);
  const bySegment = cohortBreakdown(run.outcomes, (o) => o.segment);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Run detail</h1>
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

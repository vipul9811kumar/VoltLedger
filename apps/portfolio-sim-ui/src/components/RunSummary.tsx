import type { ArmSummary } from '@/lib/aggregate';

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function RunSummary({
  nLoans,
  seed,
  runAt,
  withSummary,
  withoutSummary,
}: {
  nLoans: number;
  seed: number;
  runAt: string;
  withSummary: ArmSummary;
  withoutSummary: ArmSummary;
}) {
  const lossDelta = withoutSummary.totalNetLossUsd - withSummary.totalNetLossUsd;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        {new Date(runAt).toLocaleString()} · seed {seed} · {nLoans} loans
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="label">WITH VoltLedger</span>
            <span className="arm-WITH text-xs px-2 py-0.5 rounded">WITH</span>
          </div>
          <div className="text-2xl font-semibold text-slate-100">{fmtUsd(withSummary.totalNetLossUsd)}</div>
          <div className="text-sm text-slate-400 mt-1">
            {withSummary.defaultRatePct.toFixed(2)}% default · {withSummary.lossGivenDefaultPct.toFixed(2)}% LGD
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="label">WITHOUT (flat LTV)</span>
            <span className="arm-WITHOUT text-xs px-2 py-0.5 rounded">WITHOUT</span>
          </div>
          <div className="text-2xl font-semibold text-slate-100">{fmtUsd(withoutSummary.totalNetLossUsd)}</div>
          <div className="text-sm text-slate-400 mt-1">
            {withoutSummary.defaultRatePct.toFixed(2)}% default · {withoutSummary.lossGivenDefaultPct.toFixed(2)}% LGD
          </div>
        </div>

        <div className="card border-accent/40">
          <div className="label mb-2">Loss delta (WITHOUT − WITH)</div>
          <div className="text-2xl font-semibold text-accent">{fmtUsd(lossDelta)}</div>
          <div className="text-sm text-slate-400 mt-1">Headline number — read with METHODOLOGY.md</div>
        </div>
      </div>
    </div>
  );
}

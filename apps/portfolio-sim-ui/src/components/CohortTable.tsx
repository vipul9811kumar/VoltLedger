import type { CohortRow } from '@/lib/aggregate';

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function CohortTable({ title, rows }: { title: string; rows: CohortRow[] }) {
  return (
    <div className="card overflow-x-auto">
      <h3 className="font-medium text-slate-100 mb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left label border-b border-border">
            <th className="py-2 pr-4">Cohort</th>
            <th className="py-2 pr-4">n (WITH)</th>
            <th className="py-2 pr-4">Default % (WITH)</th>
            <th className="py-2 pr-4">Net loss (WITH)</th>
            <th className="py-2 pr-4">LGD % (WITH)</th>
            <th className="py-2 pr-4">Default % (W/O)</th>
            <th className="py-2 pr-4">Net loss (W/O)</th>
            <th className="py-2 pr-4">LGD % (W/O)</th>
            <th className="py-2 pr-4">Loss delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border/50">
              <td className="py-2 pr-4 text-slate-100">{r.key}</td>
              <td className="py-2 pr-4">{r.with.nLoans}</td>
              <td className="py-2 pr-4">{fmtPct(r.with.defaultRatePct)}</td>
              <td className="py-2 pr-4">{fmtUsd(r.with.totalNetLossUsd)}</td>
              <td className="py-2 pr-4">{fmtPct(r.with.lossGivenDefaultPct)}</td>
              <td className="py-2 pr-4">{fmtPct(r.without.defaultRatePct)}</td>
              <td className="py-2 pr-4">{fmtUsd(r.without.totalNetLossUsd)}</td>
              <td className="py-2 pr-4">{fmtPct(r.without.lossGivenDefaultPct)}</td>
              <td className="py-2 pr-4 text-accent">{fmtUsd(r.lossDeltaUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

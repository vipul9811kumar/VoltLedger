export const dynamic = 'force-dynamic';

import { getFleetOpsSecondLife } from '@/lib/fleet-ops-data';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const USE_CASE_COLORS: Record<string, string> = {
  'EV Fleet (lower demand)':        'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Stationary — Grid':              'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'Stationary — Commercial':        'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  'Stationary — Residential':       'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  'Refurbishment / Resale':         'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  'Recycling Only':                 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

function useCaseBadge(label: string | null) {
  if (!label) return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  return USE_CASE_COLORS[label] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20';
}

export default async function FleetOpsSecondLifePage() {
  let data: Awaited<ReturnType<typeof getFleetOpsSecondLife>>;
  try {
    data = await getFleetOpsSecondLife();
  } catch (err: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Second Life Pipeline</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mt-4">
          <p className="text-red-400 font-semibold text-sm mb-1">Could not reach the API</p>
          <p className="text-red-300/70 text-xs font-mono break-all">{err?.message ?? String(err)}</p>
        </div>
      </div>
    );
  }

  const { summary, candidates } = data;
  const useCaseEntries = Object.entries(summary.useCaseBreakdown);
  const totalViable = summary.viable || 1;

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Second Life Pipeline</h1>
        <p className="text-slate-500 text-sm mt-1">Batteries assessed for reuse beyond primary fleet service</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Viable candidates</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2 font-mono">{fmt(summary.viable)}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            of {fmt(summary.viable + summary.nonViable)} assessed
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Recovery Value</p>
          <p className="text-2xl font-bold text-white mt-2 font-mono">{usd(summary.totalEstValueUsd)}</p>
          <p className="text-[10px] text-slate-500 mt-1">across viable batteries</p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Avg Value / Battery</p>
          <p className="text-2xl font-bold text-white mt-2 font-mono">
            {usd(summary.viable > 0 ? Math.round(summary.totalEstValueUsd / summary.viable) : 0)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">estimated second-life value</p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Recycler Revenue</p>
          <p className="text-2xl font-bold text-slate-300 mt-2 font-mono">{usd(summary.recyclerValueUsd)}</p>
          <p className="text-[10px] text-slate-500 mt-1">from non-viable batteries</p>
        </div>
      </div>

      {/* Use case breakdown + candidates */}
      <div className="grid grid-cols-5 gap-4">

        {/* Use case breakdown */}
        <div className="col-span-2 bg-[#111827] border border-[#1e2d40] rounded-xl p-5 self-start">
          <h2 className="text-sm font-semibold text-white mb-4">Use Case Breakdown</h2>
          {useCaseEntries.length === 0 ? (
            <p className="text-slate-500 text-xs">No viable candidates</p>
          ) : (
            <div className="space-y-3">
              {useCaseEntries.map(([label, count]) => {
                const pct = Math.round((count / totalViable) * 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-300 font-mono font-medium">{fmt(count)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          useCaseBadge(label).includes('emerald') ? 'bg-emerald-500/60' :
                          useCaseBadge(label).includes('blue')    ? 'bg-blue-500/60' :
                          useCaseBadge(label).includes('purple')  ? 'bg-purple-500/60' :
                          useCaseBadge(label).includes('indigo')  ? 'bg-indigo-500/60' :
                          useCaseBadge(label).includes('cyan')    ? 'bg-cyan-500/60' : 'bg-slate-500/60'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 text-right">{pct}%</p>
                  </div>
                );
              })}
            </div>
          )}
          {summary.nonViable > 0 && (
            <div className="mt-5 pt-4 border-t border-[#1e2d40]">
              <p className="text-[11px] text-slate-500">
                <span className="text-slate-400 font-mono">{fmt(summary.nonViable)}</span> batteries disqualified
                — recycler value <span className="text-slate-400 font-mono">{usd(summary.recyclerValueUsd)}</span>
              </p>
            </div>
          )}
        </div>

        {/* Candidates table */}
        <div className="col-span-3 bg-[#111827] border border-[#1e2d40] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e2d40]">
            <h2 className="text-sm font-semibold text-white">Viable candidates</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Sorted by estimated second-life value — highest first</p>
          </div>
          {candidates.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-500 text-sm">No viable second-life candidates yet</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2d40]">
                    <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-5 py-3">Battery</th>
                    <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">SoH</th>
                    <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Score</th>
                    <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Recommended Use</th>
                    <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Life Left</th>
                    <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider font-medium px-5 py-3">Est. Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2d40]/50">
                  {candidates.map(c => (
                    <tr key={c.batteryId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-white font-medium font-mono text-xs">{c.serialNumber}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">{c.manufacturer} · {c.modelName}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold font-mono ${
                          c.currentSoH >= 80 ? 'text-emerald-400' : c.currentSoH >= 70 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {c.currentSoH.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold font-mono ${
                          c.viabilityScore >= 70 ? 'text-emerald-400' : c.viabilityScore >= 40 ? 'text-yellow-400' : 'text-slate-400'
                        }`}>
                          {c.viabilityScore.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.recommendedUseCase ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${useCaseBadge(c.recommendedUseCase)}`}>
                            {c.recommendedUseCase}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-slate-400 font-mono">
                          {c.estimatedRemainingLifeYears != null
                            ? `${c.estimatedRemainingLifeYears.toFixed(1)} yr`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-bold text-emerald-400 font-mono">{usd(c.estimatedSecondLifeValueUsd)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-[#1e2d40] flex justify-between items-center">
                <span className="text-[11px] text-slate-600">{fmt(candidates.length)} viable {candidates.length === 1 ? 'battery' : 'batteries'}</span>
                <span className="text-[11px] text-slate-500 font-mono">Total: {usd(summary.totalEstValueUsd)}</span>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

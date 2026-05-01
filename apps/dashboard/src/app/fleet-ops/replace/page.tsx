export const dynamic = 'force-dynamic';

import { getFleetOpsReplace } from '@/lib/fleet-ops-data';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function urgencyLabel(daysUntil: number) {
  if (daysUntil <= 0)  return { label: 'Immediate',  color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/20' };
  if (daysUntil <= 30) return { label: '≤ 30 days',  color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/20' };
  if (daysUntil <= 60) return { label: '≤ 60 days',  color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/20' };
  return                       { label: '≤ 90 days',  color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/20' };
}

function confidenceBadge(level: string) {
  if (level === 'HIGH')   return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (level === 'MEDIUM') return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20';
  return                         'bg-slate-500/15 text-slate-400 border-slate-500/20';
}

export default async function FleetOpsReplacePage() {
  let data: Awaited<ReturnType<typeof getFleetOpsReplace>>;
  try {
    data = await getFleetOpsReplace();
  } catch (err: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Replacement Queue</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mt-4">
          <p className="text-red-400 font-semibold text-sm mb-1">Could not reach the API</p>
          <p className="text-red-300/70 text-xs font-mono break-all">{err?.message ?? String(err)}</p>
        </div>
      </div>
    );
  }

  const { summary, upcoming } = data;

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Replacement Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Batteries forecast to drop below 80% SoH</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Immediate</p>
          <p className="text-3xl font-bold text-red-400 mt-2 font-mono">{fmt(summary.immediate)}</p>
          <p className="text-[10px] text-slate-500 mt-1">already below 80%</p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Next 30 days</p>
          <p className="text-3xl font-bold text-red-400 mt-2 font-mono">{fmt(summary.days30)}</p>
          <p className="text-[10px] text-slate-500 mt-1">forecast to hit 80%</p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Next 60 days</p>
          <p className="text-3xl font-bold text-orange-400 mt-2 font-mono">{fmt(summary.days60)}</p>
          <p className="text-[10px] text-slate-500 mt-1">forecast to hit 80%</p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Next 90 days</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2 font-mono">{fmt(summary.days90)}</p>
          <p className="text-[10px] text-slate-500 mt-1">forecast to hit 80%</p>
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Est. 6-mo Cost</p>
          <p className="text-xl font-bold text-white mt-2 font-mono">{usd(summary.estimatedCostUsd)}</p>
          <p className="text-[10px] text-slate-500 mt-1">{fmt(summary.immediate + summary.totalForecast)} batteries total</p>
        </div>
      </div>

      {/* Upcoming replacement table */}
      {upcoming.length === 0 ? (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">No batteries in the replacement forecast window</p>
        </div>
      ) : (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e2d40]">
            <h2 className="text-sm font-semibold text-white">Upcoming replacements</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Sorted by projected date — soonest first</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2d40]">
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-5 py-3">Battery</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Chemistry</th>
                <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Current SoH</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Hits 80% by</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Urgency</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Confidence</th>
                <th className="text-right text-[10px] text-slate-500 uppercase tracking-wider font-medium px-5 py-3">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d40]/50">
              {upcoming.map(b => {
                const urgency = urgencyLabel(b.daysUntil);
                return (
                  <tr key={b.batteryId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium font-mono text-xs">{b.serialNumber}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">{b.manufacturer} · {b.modelName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400 font-mono">{b.chemistry}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold font-mono ${
                        b.currentSoH >= 85 ? 'text-emerald-400' : b.currentSoH >= 80 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {b.currentSoH.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-white">
                        {new Date(b.projectedDate80Pct).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {b.daysUntil > 0 ? `in ${b.daysUntil} days` : 'overdue'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${urgency.bg} ${urgency.color}`}>
                        {urgency.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${confidenceBadge(b.confidenceLevel)}`}>
                        {b.confidenceLevel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-xs text-slate-300 font-mono">{usd(b.estimatedCostUsd)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-[#1e2d40] flex justify-between items-center">
            <span className="text-[11px] text-slate-600">{fmt(upcoming.length)} batteries in forecast window</span>
            <span className="text-[11px] text-slate-500 font-mono">Total: {usd(upcoming.length * 10_000)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

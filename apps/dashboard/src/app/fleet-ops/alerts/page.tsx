export const dynamic = 'force-dynamic';

import { getFleetOpsAlerts } from '@/lib/fleet-ops-data';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

const FILTER_TABS = [
  { key: undefined,      label: 'All alerts' },
  { key: 'thermal',      label: 'Thermal' },
  { key: 'dcfc',         label: 'DCFC overuse' },
  { key: 'degradation',  label: 'Degradation' },
] as const;

export default async function FleetOpsAlertsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const activeType = searchParams.type ?? undefined;

  let data: Awaited<ReturnType<typeof getFleetOpsAlerts>>;
  try {
    data = await getFleetOpsAlerts(activeType);
  } catch (err: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Active Alerts</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mt-4">
          <p className="text-red-400 font-semibold text-sm mb-1">Could not reach the API</p>
          <p className="text-red-300/70 text-xs font-mono break-all">{err?.message ?? String(err)}</p>
        </div>
      </div>
    );
  }

  const { counts, alerts } = data;

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Active Alerts</h1>
          <p className="text-slate-500 text-sm mt-1">Batteries with flagged risk conditions</p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-red-400 font-mono">{fmt(counts.thermal)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Thermal</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-yellow-400 font-mono">{fmt(counts.dcfc)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">DCFC overuse</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-orange-400 font-mono">{fmt(counts.degradation)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Degradation</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-white font-mono">{fmt(counts.total)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-[#1e2d40] pb-0">
        {FILTER_TABS.map(tab => {
          const isActive = activeType === tab.key;
          return (
            <a
              key={tab.label}
              href={tab.key ? `/fleet-ops/alerts?type=${tab.key}` : '/fleet-ops/alerts'}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                isActive
                  ? 'bg-[#111827] border-[#1e2d40] text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Table */}
      {alerts.length === 0 ? (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-10 text-center">
          <p className="text-slate-500 text-sm">No batteries match this filter</p>
        </div>
      ) : (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2d40]">
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Battery</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Chemistry</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Risk Score</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Active Flags</th>
                <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium px-4 py-3">Last Scored</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d40]/50">
              {alerts.map(a => (
                <tr key={a.batteryId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium font-mono text-xs">{a.serialNumber}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{a.manufacturer} · {a.modelName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400 font-mono">{a.chemistry}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold font-mono ${
                      a.compositeScore >= 70 ? 'text-red-400' : a.compositeScore >= 40 ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      {a.compositeScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {a.flags.thermal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
                          🌡 Thermal
                        </span>
                      )}
                      {a.flags.dcfc && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                          ⚡ DCFC
                        </span>
                      )}
                      {a.flags.degradation && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
                          📉 Degradation
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">
                      {new Date(a.scoredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-[#1e2d40] text-[11px] text-slate-600">
            {fmt(alerts.length)} {alerts.length === 1 ? 'battery' : 'batteries'} shown
          </div>
        </div>
      )}
    </div>
  );
}

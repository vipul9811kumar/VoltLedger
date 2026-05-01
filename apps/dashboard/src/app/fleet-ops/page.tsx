export const dynamic = 'force-dynamic';

import { getFleetOpsStats } from '@/lib/fleet-ops-data';
import { SoHHistogram } from '@/components/SoHHistogram';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default async function FleetOpsOverviewPage() {
  let stats: Awaited<ReturnType<typeof getFleetOpsStats>>;

  try {
    stats = await getFleetOpsStats();
  } catch (err: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Fleet Readiness</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mt-4">
          <p className="text-red-400 font-semibold text-sm mb-1">Could not reach the API</p>
          <p className="text-red-300/70 text-xs font-mono break-all">{err?.message ?? String(err)}</p>
        </div>
      </div>
    );
  }

  const { total, shiftReady, limitedRange, grounded, shiftReadyPct, avgSoH, alerts, replacementQueue, sohBuckets } = stats;

  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet Readiness</h1>
          <p className="text-slate-500 text-sm mt-1">Battery health across your EV fleet</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="text-xs text-slate-600 mt-0.5">{fmt(total)} batteries tracked</p>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Shift Ready */}
        <div className="bg-[#0d1a0d] border border-emerald-900/50 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Shift Ready</p>
          <p className="text-4xl font-bold text-emerald-400 mt-2 font-mono">{shiftReadyPct}%</p>
          <p className="text-xs text-slate-500 mt-1">{fmt(shiftReady)} / {fmt(total)} vehicles</p>
          <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${shiftReadyPct}%` }} />
          </div>
        </div>

        {/* Avg SoH */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Avg State of Health</p>
          <p className={`text-4xl font-bold mt-2 font-mono ${avgSoH >= 85 ? 'text-emerald-400' : avgSoH >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
            {avgSoH.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 mt-1">fleet average</p>
          <div className="mt-3 flex gap-2 text-[10px]">
            <span className="text-slate-600">↓{fmt(grounded)} grounded</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{fmt(limitedRange)} limited</span>
          </div>
        </div>

        {/* Active Alerts */}
        <div className={`bg-[#111827] border rounded-xl p-5 ${alerts.total > 0 ? 'border-yellow-900/50' : 'border-[#1e2d40]'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Active Alerts</p>
          <p className={`text-4xl font-bold mt-2 font-mono ${alerts.total > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
            {fmt(alerts.total)}
          </p>
          <div className="mt-2 space-y-0.5">
            <p className="text-[10px] text-slate-500">🌡 {fmt(alerts.thermal)} thermal anomaly</p>
            <p className="text-[10px] text-slate-500">⚡ {fmt(alerts.dcfc)} DCFC overuse</p>
            <p className="text-[10px] text-slate-500">📉 {fmt(alerts.abnormalDegradation)} abnormal degradation</p>
          </div>
        </div>

        {/* Replace in 90d */}
        <div className={`bg-[#111827] border rounded-xl p-5 ${replacementQueue.days90 > 0 ? 'border-red-900/40' : 'border-[#1e2d40]'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Replace in 90 Days</p>
          <p className={`text-4xl font-bold mt-2 font-mono ${replacementQueue.days90 > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {fmt(replacementQueue.days90)}
          </p>
          <p className="text-xs text-slate-500 mt-1">batteries reaching 80% SoH</p>
          {replacementQueue.estimatedCostUsd > 0 && (
            <p className="text-xs text-red-400/70 mt-2 font-mono">
              ~{usd(replacementQueue.estimatedCostUsd)} est. cost
            </p>
          )}
        </div>
      </div>

      {/* SoH Distribution + Alerts breakdown */}
      <div className="grid grid-cols-5 gap-4">

        {/* SoH Histogram */}
        <div className="col-span-3 bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">SoH Distribution</h2>
            <div className="flex items-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" />Shift ready (≥80%)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-yellow-500/60 inline-block" />Limited range</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500/60 inline-block" />Grounded</span>
            </div>
          </div>
          <SoHHistogram buckets={sohBuckets} total={total} />
          <div className="mt-4 pt-4 border-t border-[#1e2d40] grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-emerald-400 font-mono">{fmt(shiftReady)}</p>
              <p className="text-[10px] text-slate-500">Full shift (≥80%)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-400 font-mono">{fmt(limitedRange)}</p>
              <p className="text-[10px] text-slate-500">Limited range (70–80%)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-400 font-mono">{fmt(grounded)}</p>
              <p className="text-[10px] text-slate-500">Grounded (&lt;70%)</p>
            </div>
          </div>
        </div>

        {/* Replacement Queue + Alert Detail */}
        <div className="col-span-2 space-y-4">

          {/* Replacement queue */}
          <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Replacement Queue</h2>
            <div className="space-y-3">
              {[
                { label: 'Next 30 days', count: replacementQueue.days30, color: 'text-red-400',    bar: 'bg-red-500' },
                { label: 'Next 60 days', count: replacementQueue.days60, color: 'text-orange-400', bar: 'bg-orange-500' },
                { label: 'Next 90 days', count: replacementQueue.days90, color: 'text-yellow-400', bar: 'bg-yellow-500' },
              ].map(({ label, count, color, bar }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-mono font-medium ${color}`}>{fmt(count)} batteries</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bar}/60 rounded-full`}
                      style={{ width: replacementQueue.days90 > 0 ? `${Math.round((count / replacementQueue.days90) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {replacementQueue.days90 > 0 && (
              <p className="text-xs text-slate-600 mt-4 font-mono border-t border-[#1e2d40] pt-3">
                Est. 90-day cost: <span className="text-slate-400">{usd(replacementQueue.estimatedCostUsd)}</span>
              </p>
            )}
          </div>

          {/* Alert breakdown */}
          <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Alert Breakdown</h2>
            <div className="space-y-2">
              {[
                { label: 'Thermal anomaly',       count: alerts.thermal,             icon: '🌡', color: 'text-red-400' },
                { label: 'DCFC overuse',           count: alerts.dcfc,                icon: '⚡', color: 'text-yellow-400' },
                { label: 'Abnormal degradation',  count: alerts.abnormalDegradation, icon: '📉', color: 'text-orange-400' },
              ].map(({ label, count, icon, color }) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3">
                  <span className="text-xs text-slate-400 flex items-center gap-2">
                    <span>{icon}</span>{label}
                  </span>
                  <span className={`text-xs font-mono font-medium ${count > 0 ? color : 'text-slate-600'}`}>
                    {fmt(count)}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

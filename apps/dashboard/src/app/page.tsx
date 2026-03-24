import { StatCard } from '@/components/StatCard';
import { GradeBadge } from '@/components/GradeBadge';
import { GradeDistChart } from '@/components/GradeDistChart';
import { getFleetStats, getFlaggedBatteries } from '@/lib/data';
import Link from 'next/link';

export const revalidate = 60; // refresh every 60s

export default async function OverviewPage() {
  const [stats, flagged] = await Promise.all([
    getFleetStats(),
    getFlaggedBatteries(),
  ]);

  const totalScored = Object.values(stats.gradeCounts).reduce((a, b) => a + b, 0);
  const highRiskCount = (stats.gradeCounts['D'] ?? 0) + (stats.gradeCounts['F'] ?? 0);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fleet Overview</h1>
        <p className="text-slate-500 text-sm mt-1">
          Battery intelligence across your loan portfolio
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Batteries"
          value={stats.total}
          sub="across all lenders"
        />
        <StatCard
          label="Scored (7d)"
          value={totalScored}
          sub={`${stats.recentlyScored} in last 24h`}
          accent="text-blue-400"
        />
        <StatCard
          label="High Risk"
          value={highRiskCount}
          sub="Grade D or F"
          accent={highRiskCount > 0 ? 'text-red-400' : 'text-white'}
        />
        <StatCard
          label="Active"
          value={stats.statusCounts['ACTIVE'] ?? 0}
          sub="status: active"
          accent="text-emerald-400"
        />
      </div>

      {/* Grade Distribution + Flagged */}
      <div className="grid grid-cols-5 gap-4">
        {/* Grade Distribution */}
        <div className="col-span-2 bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Risk Grade Distribution</h2>
          <GradeDistChart gradeCounts={stats.gradeCounts} />
          <div className="flex gap-3 mt-3 flex-wrap">
            {(['A','B','C','D','F'] as const).map(g => (
              <div key={g} className="flex items-center gap-1.5">
                <GradeBadge grade={g} size="sm" />
                <span className="text-xs text-slate-500">{stats.gradeCounts[g] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Flagged Batteries */}
        <div className="col-span-3 bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Flagged — Needs Attention</h2>
            <Link href="/flagged" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>

          {flagged.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No flagged batteries in the last 7 days
            </div>
          ) : (
            <div className="space-y-2">
              {flagged.slice(0, 6).map(b => {
                const score = b.riskScores[0];
                return (
                  <Link
                    key={b.id}
                    href={`/battery/${b.serialNumber}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/3 hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-mono text-white">{b.serialNumber}</p>
                      <p className="text-xs text-slate-500">
                        {b.batteryModel.manufacturer} · {b.batteryModel.modelName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {score && (
                        <>
                          <span className="text-xs text-slate-400 font-mono">
                            {score.compositeScore}
                          </span>
                          <GradeBadge grade={score.grade} size="sm" />
                          <div className="flex gap-1">
                            {score.abnormalDegradation && (
                              <span title="Abnormal degradation" className="text-xs text-orange-400">↓SoH</span>
                            )}
                            {score.thermalAnomalyDetected && (
                              <span title="Thermal anomaly" className="text-xs text-red-400">🌡</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

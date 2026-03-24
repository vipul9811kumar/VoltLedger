export const dynamic = 'force-dynamic';

import { getBatteryList } from '@/lib/data';
import { GradeBadge } from '@/components/GradeBadge';
import Link from 'next/link';

export const revalidate = 30;

const GRADE_FILTERS = ['All', 'A', 'B', 'C', 'D', 'F'];

export default async function FleetPage({
  searchParams,
}: {
  searchParams: { page?: string; grade?: string };
}) {
  const page = parseInt(searchParams.page ?? '1');
  const grade = searchParams.grade && searchParams.grade !== 'All'
    ? searchParams.grade
    : undefined;

  const { batteries, total, pages } = await getBatteryList(page, 25, grade);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet</h1>
          <p className="text-slate-500 text-sm mt-1">{total} batteries total</p>
        </div>

        {/* Grade filters */}
        <div className="flex gap-2">
          {GRADE_FILTERS.map(g => (
            <Link
              key={g}
              href={`/fleet?grade=${g}`}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                (searchParams.grade ?? 'All') === g
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white border border-transparent hover:border-[#1e2d40]'
              }`}
            >
              {g}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d40]">
              {['Serial', 'Model', 'Chemistry', 'Status', 'Score', 'Grade', 'Last Telemetry', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batteries.map(b => {
              const score = b.riskScores[0];
              return (
                <tr key={b.id} className="border-b border-[#1e2d40]/50 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-white text-xs">{b.serialNumber}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {b.batteryModel.manufacturer} {b.batteryModel.modelName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 text-xs font-mono">
                      {b.chemistry}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${
                      b.status === 'ACTIVE' ? 'text-emerald-400' :
                      b.status === 'DECOMMISSIONED' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-white">
                    {score ? score.compositeScore : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {score
                      ? <GradeBadge grade={score.grade} size="sm" />
                      : <span className="text-slate-600 text-xs">unscored</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {b.lastTelemetryAt
                      ? new Date(b.lastTelemetryAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/battery/${b.serialNumber}`}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Detail →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-[#1e2d40] flex items-center justify-between">
            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/fleet?page=${page - 1}&grade=${searchParams.grade ?? 'All'}`}
                  className="px-3 py-1 text-xs bg-white/5 text-slate-300 rounded hover:bg-white/10">
                  ← Prev
                </Link>
              )}
              {page < pages && (
                <Link href={`/fleet?page=${page + 1}&grade=${searchParams.grade ?? 'All'}`}
                  className="px-3 py-1 text-xs bg-white/5 text-slate-300 rounded hover:bg-white/10">
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import type { SoHBucket } from '@/lib/fleet-ops-data';

export function SoHHistogram({ buckets, total }: { buckets: SoHBucket[]; total: number }) {
  const max = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="space-y-2">
      {buckets.map(b => {
        const pct     = total > 0 ? Math.round((b.count / total) * 100) : 0;
        const barPct  = Math.round((b.count / max) * 100);
        return (
          <div key={b.label} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-16 shrink-0 text-right font-mono">{b.label}</span>
            <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all ${
                  b.ready ? 'bg-emerald-500/70' : b.label === '<70%' ? 'bg-red-500/60' : 'bg-yellow-500/60'
                }`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 w-20 shrink-0 font-mono">
              {b.count.toLocaleString()} <span className="text-slate-600">({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

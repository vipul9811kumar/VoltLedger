'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { RvBacktestRow } from '@/lib/data';

export function RvBacktestChart({ rows }: { rows: RvBacktestRow[] }) {
  // Rates, not levels — modeled %-change-from-prior-period vs. the real Manheim EV Index's
  // own %MoM. Comparing modeledIndexLevel against a real %-change field would be an
  // apples-to-oranges axis mismatch.
  const chartData = rows.map((r) => ({
    period: r.releaseLabel,
    modeled: r.modeledPctChangeFromPrev,
    real: r.realEvIndexPctMoM,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" />
        <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8 }}
          labelStyle={{ color: '#94a3b8', fontSize: 12 }}
          formatter={(v: number | string) => {
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n) ? [`${n > 0 ? '+' : ''}${n}%`, ''] : ['—', ''];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="modeled" name="Modeled portfolio %MoM" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
        <Line type="monotone" dataKey="real" name="Real Manheim EV Index %MoM" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ErrorStats } from '@/lib/data';

export function SohAccuracyChart({ overallByChemistry }: { overallByChemistry: Record<string, ErrorStats> }) {
  const chartData = Object.entries(overallByChemistry).map(([chemistry, stats]) => ({
    chemistry,
    mae: Math.round(stats.maeLossPctPer100Cycles * 100) / 100,
    n: stats.n,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" vertical={false} />
        <XAxis dataKey="chemistry" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8 }}
          labelStyle={{ color: '#94a3b8', fontSize: 12 }}
          itemStyle={{ color: '#3b82f6' }}
          formatter={(v: number, _name, item) => [`${v}%/100cyc (n=${item.payload.n})`, 'MAE']}
        />
        <Bar dataKey="mae" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={64} />
      </BarChart>
    </ResponsiveContainer>
  );
}

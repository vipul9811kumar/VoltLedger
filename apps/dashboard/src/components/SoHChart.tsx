'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Point { recordedAt: Date | string; stateOfHealth: number }

export function SoHChart({ data }: { data: Point[] }) {
  const chartData = data.map(p => ({
    date:  new Date(p.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    soh:   Math.round(p.stateOfHealth * 10) / 10,
  }));

  const min = Math.floor(Math.min(...chartData.map(d => d.soh)) - 2);
  const max = Math.ceil(Math.max(...chartData.map(d => d.soh)) + 1);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1e2d40', borderRadius: 8 }}
          labelStyle={{ color: '#94a3b8', fontSize: 12 }}
          itemStyle={{ color: '#3b82f6' }}
          formatter={(v: number) => [`${v}%`, 'SoH']}
        />
        <ReferenceLine y={80} stroke="#eab308" strokeDasharray="4 4" strokeOpacity={0.5} />
        <Line
          type="monotone"
          dataKey="soh"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

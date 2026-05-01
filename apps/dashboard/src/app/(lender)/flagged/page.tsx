export const dynamic = 'force-dynamic';

import { getFlaggedBatteries } from '@/lib/data';
import { GradeBadge } from '@/components/GradeBadge';
import Link from 'next/link';


export default async function FlaggedPage() {
  const batteries = await getFlaggedBatteries();

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Flagged Batteries</h1>
        <p className="text-slate-500 text-sm mt-1">
          Batteries with abnormal degradation, thermal anomalies, or Grade D/F risk
        </p>
      </div>

      {batteries.length === 0 ? (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-white font-semibold">No flagged batteries</p>
          <p className="text-slate-500 text-sm mt-1">All scored batteries are within normal thresholds</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batteries.map(b => {
            const score = b.riskScores[0];
            const flags = score ? [
              score.abnormalDegradation    && { label: 'Abnormal Degradation', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              score.thermalAnomalyDetected && { label: 'Thermal Anomaly', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
              score.highDcfcUsage          && { label: 'High DCFC Usage', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
              score.deepDischargeHistory   && { label: 'Deep Discharge', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
            ].filter(Boolean) : [];

            return (
              <Link
                key={b.id}
                href={`/battery/${b.serialNumber}`}
                className="block bg-[#111827] border border-[#1e2d40] rounded-xl p-5 hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-white font-medium">{b.serialNumber}</p>
                      {score && <GradeBadge grade={score.grade} showLabel />}
                    </div>
                    <p className="text-sm text-slate-500">
                      {b.batteryModel.manufacturer} · {b.batteryModel.modelName}
                    </p>
                    {/* Flag pills */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {flags.map((f: any) => f && (
                        <span
                          key={f.label}
                          className={`text-xs px-2 py-0.5 rounded border ${f.color}`}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {score && (
                    <div className="text-right">
                      <p className="text-3xl font-bold font-mono text-white">{score.compositeScore}</p>
                      <p className="text-xs text-slate-500">/1000</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {new Date(score.scoredAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

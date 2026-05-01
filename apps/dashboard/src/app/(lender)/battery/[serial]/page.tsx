import { notFound } from 'next/navigation';
import { getBatteryDetail } from '@/lib/data';
import { GradeBadge } from '@/components/GradeBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { SoHChart } from '@/components/SoHChart';
import Link from 'next/link';

export const revalidate = 60;

function usd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

export default async function BatteryDetailPage({ params }: { params: { serial: string } }) {
  const battery = await getBatteryDetail(params.serial);

  if (!battery) notFound();

  const risk     = battery.riskScores[0];
  const rv       = battery.residualValues[0];
  const ltv      = battery.ltvRecommendations[0];
  const sl       = battery.secondLifeAssessments[0];
  const forecast = battery.degradationForecasts[0];

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/fleet" className="hover:text-white">Fleet</Link>
        <span>/</span>
        <span className="text-slate-300 font-mono">{battery.serialNumber}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{battery.serialNumber}</h1>
            {risk && <GradeBadge grade={risk.grade} size="lg" showLabel />}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {battery.batteryModel.manufacturer} · {battery.batteryModel.modelName} ·{' '}
            <span className="font-mono">{battery.chemistry}</span> ·{' '}
            {battery.nominalCapacityKwh} kWh
          </p>
        </div>
        {risk && (
          <div className="text-right">
            <p className="text-4xl font-bold font-mono text-white">{risk.compositeScore}</p>
            <p className="text-xs text-slate-500">/1000 composite score</p>
          </div>
        )}
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-3 gap-4">

        {/* Risk Score Panel */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Risk Score</h2>

          {risk ? (
            <>
              <div className="space-y-3">
                <ScoreBar label="Degradation"        value={risk.degradationScore ?? 0} />
                <ScoreBar label="Thermal"            value={risk.thermalScore ?? 0} />
                <ScoreBar label="Usage Pattern"      value={risk.usagePatternScore ?? 0} />
                <ScoreBar label="Capacity Retention" value={risk.capacityRetentionScore ?? 0} />
                <ScoreBar label="Age-Adjusted"       value={risk.ageAdjustedScore ?? 0} />
              </div>

              {/* Flags */}
              {(risk.abnormalDegradation || risk.thermalAnomalyDetected || risk.highDcfcUsage || risk.deepDischargeHistory) && (
                <div className="pt-2 border-t border-[#1e2d40] space-y-1.5">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Flags</p>
                  {risk.abnormalDegradation    && <Flag label="Abnormal Degradation" color="orange" />}
                  {risk.thermalAnomalyDetected && <Flag label="Thermal Anomaly" color="red" />}
                  {risk.highDcfcUsage          && <Flag label="High DCFC Usage" color="yellow" />}
                  {risk.deepDischargeHistory   && <Flag label="Deep Discharge History" color="orange" />}
                </div>
              )}

              <p className="text-xs text-slate-600">
                {risk.confidenceLevel != null && <>Confidence: {Math.round(risk.confidenceLevel * 100)}% · </>}
                {new Date(risk.scoredAt).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No score available</p>
          )}
        </div>

        {/* SoH History Chart */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">SoH History (12 weeks)</h2>
          <SoHHistory batteryId={battery.serialNumber} />

          {forecast && (
            <div className="pt-3 border-t border-[#1e2d40]">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Forecast</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <ForecastPoint label="12m" value={`${forecast.sohAt12Months.toFixed(1)}%`} />
                <ForecastPoint label="24m" value={`${forecast.sohAt24Months.toFixed(1)}%`} />
                <ForecastPoint label="36m" value={`${forecast.sohAt36Months.toFixed(1)}%`} />
                <ForecastPoint label="60m" value={`${forecast.sohAt60Months.toFixed(1)}%`} />
              </div>
              {forecast.projectedDate80Pct && (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠ Hits 80% SoH: {new Date(forecast.projectedDate80Pct).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Battery Info */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Battery Info</h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="VIN"        value={battery.vin ?? '—'} mono />
            <InfoRow label="Status"     value={battery.status} />
            <InfoRow label="Chemistry"  value={battery.chemistry} mono />
            <InfoRow label="Capacity"   value={`${battery.nominalCapacityKwh} kWh`} />
            <InfoRow label="Manufactured" value={battery.manufacturedAt
              ? new Date(battery.manufacturedAt).toLocaleDateString() : '—'} />
            <InfoRow label="Last Data"  value={battery.lastTelemetryAt
              ? new Date(battery.lastTelemetryAt).toLocaleDateString() : '—'} />
          </dl>
        </div>
      </div>

      {/* Financial row */}
      <div className="grid grid-cols-3 gap-4">

        {/* Residual Value */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Residual Value</h2>
          {rv ? (
            <>
              <p className="text-3xl font-bold text-white">{usd(rv.batteryResidualValueUsd)}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {Math.round(rv.batteryValuePctOfVehicle * 100)}% of {usd(rv.vehicleMarketValueUsd)} vehicle value
              </p>
              <div className="mt-4 space-y-1.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Forecast</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <ForecastPoint label="12m" value={usd(rv.residualAt12MonthsUsd)} />
                  <ForecastPoint label="24m" value={usd(rv.residualAt24MonthsUsd)} />
                  <ForecastPoint label="36m" value={usd(rv.residualAt36MonthsUsd)} />
                  <ForecastPoint label="60m" value={usd(rv.residualAt60MonthsUsd)} />
                </div>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">No estimate available</p>}
        </div>

        {/* LTV */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">LTV Recommendation</h2>
          {ltv ? (
            <>
              <p className="text-3xl font-bold text-white">
                {Math.round(ltv.recommendedLtvPct * 10) / 10}%
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Max loan: {usd(ltv.requestedLoanAmountUsd)}
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Base rate</span>
                  <span className="text-white font-mono">5.00%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Risk premium</span>
                  <span className="text-orange-400 font-mono">+{ltv.riskPremiumBps}bps</span>
                </div>
                <div className="flex justify-between text-xs border-t border-[#1e2d40] pt-2">
                  <span className="text-slate-400 font-medium">Total rate</span>
                  <span className="text-white font-mono font-semibold">
                    {((500 + ltv.riskPremiumBps) / 100).toFixed(2)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-3 italic">{ltv.rationale}</p>
            </>
          ) : <p className="text-sm text-slate-500">No recommendation available</p>}
        </div>

        {/* Second Life */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Second Life</h2>
          {sl ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-semibold ${sl.isViable ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sl.isViable ? 'Viable' : 'Recycling Only'}
                </span>
                <span className="text-xs text-slate-500">SoH {sl.currentSoH.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {sl.recommendedUseCase?.replace(/_/g, ' ')}
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining life</span>
                  <span className="text-white">{sl.estimatedRemainingLifeYears}yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">2nd life value</span>
                  <span className="text-white">{usd(sl.estimatedSecondLifeValueUsd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recycler value</span>
                  <span className="text-white">{usd(sl.recyclerValueUsd)}</span>
                </div>
              </div>
              {sl.disqualifiers.length > 0 && (
                <div className="mt-3 pt-2 border-t border-[#1e2d40] space-y-1">
                  {sl.disqualifiers.map((d: string) => (
                    <p key={d} className="text-xs text-orange-400/80">⚠ {d}</p>
                  ))}
                </div>
              )}
            </>
          ) : <p className="text-sm text-slate-500">No assessment available</p>}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

async function SoHHistory({ batteryId }: { batteryId: string }) {
  const { getBatterySoHHistory } = await import('@/lib/data');
  const history = await getBatterySoHHistory(batteryId);
  if (history.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">No telemetry data</p>;
  }
  return <SoHChart data={history} />;
}

function Flag({ label, color }: { label: string; color: string }) {
  const cls: Record<string, string> = {
    red:    'text-red-400 bg-red-500/10 border-red-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  };
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded border ${cls[color]}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? 'text-white font-mono text-xs' : 'text-white'}>{value}</dd>
    </div>
  );
}

function ForecastPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

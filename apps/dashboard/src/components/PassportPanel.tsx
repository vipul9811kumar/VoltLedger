/**
 * PassportPanel
 *
 * Renders three states:
 *   1. No passport — explains why + what would unlock it
 *   2. Public tier — carbon footprint, composition, recycled content
 *   3. Restricted tier — all public fields + SoH, cycles, temp history, status, events
 */

import type { PassportResponse } from '@/lib/data';
import { PassportTierBadge } from './PassportTierBadge';

interface Props {
  passport: PassportResponse;
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <dt className="text-slate-500 text-xs shrink-0">{label}</dt>
      <dd className={`text-xs text-right ${mono ? 'text-white font-mono' : 'text-slate-200'}`}>{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 mt-3 first:mt-0">{children}</p>
  );
}

function StatusPill({ code }: { code: string | null }) {
  if (!code) return <span className="text-slate-500 text-xs">—</span>;
  const map: Record<string, string> = {
    GOOD:       'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    DEGRADED:   'text-yellow-400  bg-yellow-500/10  border-yellow-500/30',
    FAULTY:     'text-red-400     bg-red-500/10     border-red-500/30',
    REPURPOSED: 'text-blue-400    bg-blue-500/10    border-blue-500/30',
  };
  return (
    <span className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border ${map[code] ?? 'text-slate-400 border-slate-600'}`}>
      {code}
    </span>
  );
}

function NegativeEvents({ events }: { events: Array<{ type: string; date: string; description: string }> }) {
  if (!events?.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Recorded Events</p>
      {events.map((e, i) => (
        <div key={i} className="bg-red-500/5 border border-red-500/20 rounded p-2 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-red-400 font-mono">{e.type.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-slate-500">{e.date}</span>
          </div>
          <p className="text-[11px] text-slate-400">{e.description}</p>
        </div>
      ))}
    </div>
  );
}

export function PassportPanel({ passport }: Props) {
  // ── State 1: No passport ──────────────────────────────────────────────────
  if (!passport.hasPassport) {
    return (
      <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">EU Battery Passport</h2>
          <span className="text-[10px] text-slate-600 border border-slate-700 rounded px-2 py-0.5">Not available</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-2">
          <p className="text-sm text-slate-400">
            No EU Battery Passport on record for this asset.
          </p>
          <p className="text-xs text-slate-600">
            EU Battery Regulation 2023/1542 mandates passports for batteries placed on the EU market from 18 February 2027. This battery was registered before that requirement.
          </p>
          <div className="pt-2 border-t border-slate-700 space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">What you can still do</p>
            <p className="text-xs text-slate-500">Scoring uses telemetry data only. Confidence level is lower without passport verification.</p>
            <p className="text-xs text-slate-500">If this battery is EU-market eligible, trigger a passport lookup via <span className="font-mono text-slate-400">POST /v1/passport/resolve</span>.</p>
          </div>
        </div>
      </div>
    );
  }

  const pub         = passport.public!;
  const restricted  = passport.restricted;
  const verification = passport.verification;

  // ── States 2 & 3: Passport present ───────────────────────────────────────
  return (
    <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">EU Battery Passport</h2>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{passport.passportUniqueId}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <PassportTierBadge tier={passport.tierAccess!} verified={passport.isVerified} />
          {passport.dataExchangeFramework && (
            <span className="text-[10px] text-slate-600 font-mono">{passport.dataExchangeFramework}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* ── Column 1: Carbon + Circularity ─────────────────────────── */}
        <div>
          <SectionTitle>Carbon Footprint</SectionTitle>
          <dl className="space-y-1.5">
            <Row
              label="CO₂e / kWh"
              value={pub.carbonFootprintKgCo2e != null
                ? <>{pub.carbonFootprintKgCo2e.toFixed(1)} <span className="text-slate-500">kg</span></>
                : '—'}
              mono
            />
            <Row
              label="Intensity class"
              value={pub.carbonIntensityClass
                ? <span className="font-mono font-bold text-emerald-400">{pub.carbonIntensityClass}</span>
                : '—'}
            />
            <Row label="Recycled content" value={pub.recycledContentPct != null ? `${pub.recycledContentPct.toFixed(1)}%` : '—'} mono />
          </dl>

          <SectionTitle>Recycled Material</SectionTitle>
          <dl className="space-y-1.5">
            {pub.composition.cobaltPct != null && pub.composition.cobaltPct > 0 && (
              <Row label="Recycled Co" value={`${pub.circularity.recycledCobaltPct ?? 0}%`} mono />
            )}
            <Row label="Recycled Li"   value={`${pub.circularity.recycledLithiumPct ?? 0}%`} mono />
            {pub.composition.nickelPct != null && pub.composition.nickelPct > 0 && (
              <Row label="Recycled Ni" value={`${pub.circularity.recycledNickelPct ?? 0}%`} mono />
            )}
          </dl>
        </div>

        {/* ── Column 2: Composition + Performance ────────────────────── */}
        <div>
          <SectionTitle>Composition</SectionTitle>
          <dl className="space-y-1.5">
            <Row label="Lithium"   value={`${pub.composition.lithiumPct ?? 0}%`}   mono />
            {(pub.composition.cobaltPct ?? 0) > 0 && (
              <Row label="Cobalt"  value={`${pub.composition.cobaltPct ?? 0}%`}    mono />
            )}
            {(pub.composition.nickelPct ?? 0) > 0 && (
              <Row label="Nickel"  value={`${pub.composition.nickelPct ?? 0}%`}    mono />
            )}
            {(pub.composition.manganesePct ?? 0) > 0 && (
              <Row label="Manganese" value={`${pub.composition.manganesePct ?? 0}%`} mono />
            )}
          </dl>

          <SectionTitle>Performance</SectionTitle>
          <dl className="space-y-1.5">
            <Row label="Rated capacity"  value={pub.performance.ratedCapacityAh != null ? `${pub.performance.ratedCapacityAh.toFixed(0)} Ah` : '—'} mono />
            <Row label="Energy density"  value={pub.performance.energyDensityWhKg != null ? `${pub.performance.energyDensityWhKg.toFixed(0)} Wh/kg` : '—'} mono />
            <Row label="Rated cycles"    value={pub.performance.expectedLifetimeCycles?.toLocaleString() ?? '—'} mono />
            <Row label="Temp range"      value={pub.performance.temperatureRangeMin != null
              ? `${pub.performance.temperatureRangeMin}°C to ${pub.performance.temperatureRangeMax}°C`
              : '—'} mono />
          </dl>
        </div>

        {/* ── Column 3: Restricted tier / identity ───────────────────── */}
        <div>
          {restricted ? (
            <>
              <SectionTitle>Live Battery State</SectionTitle>
              <dl className="space-y-1.5">
                <Row
                  label="Passport SoH"
                  value={restricted.unitSoH != null
                    ? <span className={restricted.unitSoH >= 85 ? 'text-emerald-400' : restricted.unitSoH >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                        {restricted.unitSoH.toFixed(1)}%
                      </span>
                    : '—'}
                />
                <Row label="Charge cycles"  value={restricted.chargeCycleCount?.toLocaleString() ?? '—'} mono />
                <Row label="Status"         value={<StatusPill code={restricted.batteryStatusCode} />} />
                <Row label="Temp max (life)" value={restricted.tempHistoryMax != null ? `${restricted.tempHistoryMax.toFixed(1)}°C` : '—'} mono />
                <Row label="Temp avg (life)" value={restricted.tempHistoryAvg != null ? `${restricted.tempHistoryAvg.toFixed(1)}°C` : '—'} mono />
              </dl>

              {restricted.negativeEvents?.length > 0 && (
                <NegativeEvents events={restricted.negativeEvents} />
              )}
            </>
          ) : (
            <div className="mt-1">
              <SectionTitle>Live Battery State</SectionTitle>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded p-3 space-y-1">
                <p className="text-xs text-slate-500">Restricted-tier data not available.</p>
                {passport.restrictedAccessStatus === 'PENDING_LEGITIMATE_INTEREST' ? (
                  <p className="text-[11px] text-slate-600">
                    SoH, cycle count, and temperature history exist for this battery but require
                    legitimate-interest access, pending the EU Commission's implementing act (Reg
                    2023/1542 Art. 13). Risk scoring falls back to telemetry-only in the meantime.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    No restricted-tier data on record for this passport (public tier only).
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Identity verification ─────────────────── */}
          {verification && (
            <div className="mt-3 pt-3 border-t border-[#1e2d40]">
              <SectionTitle>Identity Verification</SectionTitle>
              <dl className="space-y-1.5">
                <Row
                  label="Chain valid"
                  value={verification.identityChainValid
                    ? <span className="text-emerald-400">Yes</span>
                    : <span className="text-red-400">No</span>}
                />
                <Row
                  label="Confidence"
                  value={`${Math.round(verification.confidenceScore * 100)}%`}
                  mono
                />
              </dl>
              {verification.discrepancies.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {verification.discrepancies.map((d, i) => (
                    <p key={i} className="text-[10px] text-orange-400/80">⚠ {d}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EoL guidance footer */}
      {pub.circularity.eolGuidanceText && (
        <div className="mt-4 pt-3 border-t border-[#1e2d40]">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">End-of-Life Guidance</p>
          <p className="text-[11px] text-slate-600 leading-relaxed">{pub.circularity.eolGuidanceText}</p>
        </div>
      )}

      {/* Metadata footer */}
      <div className="mt-3 pt-2 border-t border-[#1e2d40] flex gap-6 text-[10px] text-slate-600">
        {passport.issuedAt && <span>Issued: {new Date(passport.issuedAt).toLocaleDateString()}</span>}
        {passport.expiresAt && <span>Expires: {new Date(passport.expiresAt).toLocaleDateString()}</span>}
        {passport.lastSyncedAt && <span>Synced: {new Date(passport.lastSyncedAt).toLocaleDateString()}</span>}
        {passport.passportQrUrl && (
          <span className="ml-auto font-mono">{passport.dataExchangeFramework}</span>
        )}
      </div>
    </div>
  );
}

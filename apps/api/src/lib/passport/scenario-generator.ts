/**
 * Shared scenario-driven passport generator (WS-F).
 *
 * Extracted from mock.resolver.ts's original logic (that logic is now the "organic" default
 * path here — byte-identical behavior when no scenario is forced). Adds deliberate,
 * deterministic branches for each CoverageScenario so the demo/test/coverage-matrix layer can
 * request a specific data-completeness cell on demand instead of relying on hash-luck.
 *
 * Used by mock.resolver.ts (always) and the four stub resolvers (only when
 * options?.forceScenario is set — their default, no-scenario behavior stays an honest
 * "not yet implemented" failure).
 */

import type {
  PassportResolveResult,
  RawPassportData,
  ResolveOptions,
  DataExchangeFramework,
  BatteryStatusCode,
  CoverageScenario,
} from '@voltledger/types';

// Seeded deterministic random from a string — same identifier always gives the same passport
function seededRand(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = (Math.imul(h, index + 1337)) | 0;
  return Math.abs(h) / 2147483647;
}

export function r(seed: string, index: number, min: number, max: number): number {
  return min + seededRand(seed, index) * (max - min);
}

// Carbon footprint benchmarks per chemistry (kg CO2e / kWh — typical lifecycle values)
const CARBON_BY_CHEMISTRY: Record<string, { min: number; max: number; class: string }> = {
  LFP: { min: 55, max: 80,  class: 'B' },
  NMC: { min: 80, max: 120, class: 'C' },
  NCA: { min: 90, max: 130, class: 'C' },
};

// Composition profiles per chemistry (mass %)
const COMPOSITION: Record<string, { cobalt: number; lithium: number; nickel: number; manganese: number }> = {
  LFP: { cobalt: 0,    lithium: 5.4, nickel: 0,    manganese: 0   },
  NMC: { cobalt: 6.5,  lithium: 4.8, nickel: 15.5, manganese: 7.2 },
  NCA: { cobalt: 10.2, lithium: 5.1, nickel: 20.4, manganese: 0   },
};

const DEG_RATE_PER_YEAR: Record<string, number> = { LFP: 1.5, NMC: 2.5, NCA: 3.0 };
const CYCLE_RATE_PER_YEAR: Record<string, number> = { LFP: 350, NMC: 250, NCA: 200 };

function batteryStatusFromSoH(soh: number): BatteryStatusCode {
  if (soh >= 85) return 'GOOD';
  if (soh >= 70) return 'DEGRADED';
  return 'FAULTY';
}

function carbonClass(kgPerKwh: number): string {
  if (kgPerKwh < 60)  return 'A';
  if (kgPerKwh < 80)  return 'B';
  if (kgPerKwh < 100) return 'C';
  if (kgPerKwh < 120) return 'D';
  return 'E';
}

function inferChemistry(serial: string): string {
  if (serial.startsWith('CATL') || serial.startsWith('BYD')) return 'LFP';
  if (serial.startsWith('PANA')) return 'NCA';
  return 'NMC';
}

/** Expected SoH for a given chemistry/age — the same curve the "organic" restricted-tier
 *  payload uses, exposed so CONFLICTING scenarios can deliberately diverge from it. */
function expectedSoH(chemistry: string, ageYears: number): number {
  const baseSoH = 100 - ageYears * (DEG_RATE_PER_YEAR[chemistry] ?? 2.5);
  return Math.min(100, Math.max(50, baseSoH));
}

function buildPublicData(identifier: string, serial: string, chemistry: string): {
  publicData: RawPassportData;
  ageYears: number;
  capacityAh: number;
} {
  const bench = CARBON_BY_CHEMISTRY[chemistry] ?? CARBON_BY_CHEMISTRY.NMC;
  const comp  = COMPOSITION[chemistry] ?? COMPOSITION.NMC;

  const capacityKwh = 60 + r(identifier, 2, 0, 60);
  const capacityAh  = (capacityKwh * 1000) / 370; // ~370V nominal
  const ageYears = 0.5 + r(identifier, 3, 0, 4);

  const carbonFootprint = r(identifier, 4, bench.min, bench.max);

  const publicData: RawPassportData = {
    passportUniqueId: `30PPID/${serial}-EU2027`,
    passportQrUrl:    `https://passport.voltledger.io/qr/${serial}`,

    batteryCategory:       'EV',
    manufacturerName:      serial.split('-')[0],
    manufacturingDate:     new Date(
      Date.now() - ageYears * 365.25 * 86400 * 1000,
    ).toISOString(),
    manufacturingLocation: serial.includes('-EU-') ? 'Germany' : serial.includes('-CA-') ? 'Canada' : 'USA',

    carbonFootprintKgCo2e: Math.round(carbonFootprint * 10) / 10,
    carbonIntensityClass:  carbonClass(carbonFootprint),

    recycledContentPct:   Math.round(r(identifier, 5, 8, 28) * 10) / 10,
    cobaltPct:            Math.round(comp.cobalt * 10) / 10,
    lithiumPct:           Math.round(comp.lithium * 10) / 10,
    nickelPct:            Math.round(comp.nickel * 10) / 10,
    manganesePct:         Math.round(comp.manganese * 10) / 10,

    ratedCapacityAh:       Math.round(capacityAh * 10) / 10,
    energyDensityWhKg:     Math.round(r(identifier, 6, 140, 260) * 10) / 10,
    powerDensityWKg:       Math.round(r(identifier, 7, 600, 1400) * 10) / 10,
    expectedLifetimeCycles: chemistry === 'LFP' ? 3000 : chemistry === 'NMC' ? 1500 : 1200,
    temperatureRangeMin:   chemistry === 'LFP' ? -20 : -10,
    temperatureRangeMax:   chemistry === 'LFP' ? 60  : 45,

    recycledCobaltPct:   chemistry === 'LFP' ? 0 : Math.round(r(identifier, 8, 3, 18) * 10) / 10,
    recycledLithiumPct:  Math.round(r(identifier, 9, 2, 12) * 10) / 10,
    recycledNickelPct:   chemistry === 'LFP' ? 0 : Math.round(r(identifier, 10, 5, 22) * 10) / 10,
    eolGuidanceText:     `Disassemble in accordance with EN IEC 62619. Hazardous materials: Li-ion cells require certified recycler. Do not puncture or incinerate.`,

    issuedAt:  new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 365.25 * 86400 * 1000).toISOString(),
  };

  return { publicData, ageYears, capacityAh };
}

function buildRestrictedFields(
  identifier: string,
  chemistry: string,
  ageYears: number,
  capacityAh: number,
  unitSoHOverride?: number,
): Partial<RawPassportData> {
  const unitSoH = unitSoHOverride ?? (() => {
    const noise = r(identifier, 12, -3, 3);
    return Math.min(100, Math.max(50, Math.round((expectedSoH(chemistry, ageYears) + noise) * 10) / 10));
  })();

  const chargeCycleCount = Math.round(ageYears * (CYCLE_RATE_PER_YEAR[chemistry] ?? 250));

  const negEvents: Array<{ type: string; date: string; description: string }> = [];
  if (seededRand(identifier, 13) < 0.15) {
    negEvents.push({
      type:        'THERMAL_EVENT',
      date:        new Date(Date.now() - r(identifier, 14, 60, 730) * 86400 * 1000).toISOString().slice(0, 10),
      description: 'Cell temperature exceedance >55°C recorded during fast-charge session.',
    });
  }
  if (seededRand(identifier, 15) < 0.08) {
    negEvents.push({
      type:        'DEEP_DISCHARGE',
      date:        new Date(Date.now() - r(identifier, 16, 30, 400) * 86400 * 1000).toISOString().slice(0, 10),
      description: 'Pack discharged below 2.5V/cell threshold on 3 occasions.',
    });
  }

  return {
    unitSoH,
    unitSoC:              Math.round(r(identifier, 17, 20, 85) * 10) / 10,
    chargeCycleCount,
    fullChargeCapacityAh: Math.round(capacityAh * (unitSoH / 100) * 10) / 10,
    remainingCapacityAh:  Math.round(capacityAh * (unitSoH / 100) * r(identifier, 18, 0.5, 0.9) * 10) / 10,
    tempHistoryMin:       Math.round(r(identifier, 19, -15, 5) * 10) / 10,
    tempHistoryMax:       Math.round(r(identifier, 20, 38, 62) * 10) / 10,
    tempHistoryAvg:       Math.round(r(identifier, 21, 20, 32) * 10) / 10,
    batteryStatusCode:    batteryStatusFromSoH(unitSoH),
    negativeEvents:       negEvents,
  };
}

export function generatePassportForScenario(
  identifier: string,
  framework: DataExchangeFramework,
  options?: ResolveOptions,
): PassportResolveResult {
  const start = Date.now();
  const resolvedAt = new Date();
  const serial = identifier.toUpperCase();
  const chemistry = inferChemistry(serial);

  const scenario = options?.forceScenario;

  // ── NO_PASSPORT: forced, or the organic ~60%-coverage roll when no scenario is forced ──
  const organicHasCoverage = seededRand(identifier, 1) < 0.60;
  if (scenario === 'NO_PASSPORT' || (!scenario && !organicHasCoverage)) {
    return {
      success: false,
      error: 'No EU Battery Passport found for this identifier (pre-regulation asset)',
      tierAccess: 'PUBLIC',
      resolvedAt,
      framework,
      latencyMs: Date.now() - start,
    };
  }

  const { publicData, ageYears, capacityAh } = buildPublicData(identifier, serial, chemistry);

  // ── TAMPERED: valid-looking payload, but the identity itself doesn't match the battery ──
  if (scenario === 'TAMPERED') {
    const tamperedPublicData: RawPassportData = {
      ...publicData,
      passportUniqueId: `30PPID/UNKNOWN-${Math.abs(Math.round(r(identifier, 30, 10000, 99999)))}-EU2027`,
    };
    const restricted = buildRestrictedFields(identifier, chemistry, ageYears, capacityAh);
    return {
      success: true,
      passportData: { ...tamperedPublicData, ...restricted },
      tierAccess: 'RESTRICTED',
      restrictedAccessStatus: 'GRANTED',
      resolvedAt,
      framework,
      latencyMs: Date.now() - start,
    };
  }

  // ── REISSUED_IDENTITY: valid chain, but flagged as a repurposed battery with a link back
  //    to the passport it supersedes (build spec §7 item 7) ──
  if (scenario === 'REISSUED_IDENTITY') {
    const restricted = buildRestrictedFields(identifier, chemistry, ageYears, capacityAh);
    return {
      success: true,
      passportData: {
        ...publicData,
        ...restricted,
        batteryStatusCode: 'REPURPOSED',
        priorPassportId: `30PPID/${serial}-EU2024-ORIGINAL`,
      },
      tierAccess: 'RESTRICTED',
      restrictedAccessStatus: 'GRANTED',
      resolvedAt,
      framework,
      latencyMs: Date.now() - start,
    };
  }

  // ── ACCESS_PENDING: restricted-tier data exists in principle, but VoltLedger hasn't been
  //    granted access yet — fields withheld, distinct from "no data"/PUBLIC-only ──
  if (scenario === 'ACCESS_PENDING') {
    return {
      success: true,
      passportData: publicData,
      tierAccess: 'RESTRICTED',
      restrictedAccessStatus: 'PENDING_LEGITIMATE_INTEREST',
      resolvedAt,
      framework,
      latencyMs: Date.now() - start,
    };
  }

  // ── PUBLIC_ONLY: forced, or the organic ~70%-of-covered roll when no scenario is forced ──
  const organicHasRestricted = options?.preferRestrictedTier || seededRand(identifier, 11) < 0.30;
  if (scenario === 'PUBLIC_ONLY' || (!scenario && !organicHasRestricted)) {
    return {
      success: true,
      passportData: publicData,
      tierAccess: 'PUBLIC',
      resolvedAt,
      framework,
      latencyMs: Date.now() - start,
    };
  }

  // ── RESTRICTED_CONFLICTING: unitSoH deliberately far from the expected chemistry/age curve —
  //    when paired with telemetry that *does* follow the curve, this produces a >8pp
  //    passport-vs-telemetry delta and fires reconcileSoH's fraud-signal path ──
  if (scenario === 'RESTRICTED_CONFLICTING') {
    const curve = expectedSoH(chemistry, ageYears);
    // Always subtract (never add): the curve is always fairly high (~86.5-99.25% given the
    // possible age/chemistry range), so adding could clip against the 100% ceiling and shrink
    // the effective delta below the 8pp threshold. Subtracting keeps the full offset intact.
    const offset = r(identifier, 32, 12, 20); // always > the 8pp fraud-signal threshold
    const forcedSoH = Math.min(100, Math.max(40, Math.round((curve - offset) * 10) / 10));
    const restricted = buildRestrictedFields(identifier, chemistry, ageYears, capacityAh, forcedSoH);
    return {
      success: true,
      passportData: { ...publicData, ...restricted },
      tierAccess: 'RESTRICTED',
      restrictedAccessStatus: 'GRANTED',
      resolvedAt,
      framework,
      latencyMs: Date.now() - start,
    };
  }

  // ── RESTRICTED_CONSISTENT (forced), or the organic restricted-tier roll ──
  const restricted = buildRestrictedFields(identifier, chemistry, ageYears, capacityAh);
  return {
    success: true,
    passportData: { ...publicData, ...restricted },
    tierAccess: 'RESTRICTED',
    restrictedAccessStatus: 'GRANTED',
    resolvedAt,
    framework,
    latencyMs: Date.now() - start,
  };
}

/** The expected chemistry/age SoH curve — exposed for tests/reports that need to construct
 *  telemetry values consistent with (or deliberately divergent from) a passport's organic SoH. */
export function expectedSoHForIdentifier(identifier: string): { chemistry: string; ageYears: number; expectedSoH: number } {
  const serial = identifier.toUpperCase();
  const chemistry = inferChemistry(serial);
  const ageYears = 0.5 + r(identifier, 3, 0, 4);
  return { chemistry, ageYears, expectedSoH: expectedSoH(chemistry, ageYears) };
}

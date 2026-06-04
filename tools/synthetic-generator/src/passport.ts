/**
 * Synthetic EU Battery Passport Generator
 *
 * Produces realistic passport records for a generated fleet.
 * Mirrors the real-world ramp-up model:
 *   - 60% of batteries get a passport (post-2027 origination simulation)
 *   - Of those: 70% public tier only, 30% restricted tier
 *   - Restricted SoH is consistent with actual telemetry (±2% noise)
 *   - ~15% of restricted passports have one or more negative events
 *
 * Run: pnpm generate -- --passports   (adds passports to the JSON output)
 *      pnpm generate -- --seed-db --passports  (seeds DB including passports)
 */

import type { GeneratedBattery } from './generator';
import type { Chemistry } from './models';

export type PassportTier = 'PUBLIC' | 'RESTRICTED';

export interface NegativeEvent {
  type: string;
  date: string;
  description: string;
}

export interface GeneratedPassportPublic {
  passportUniqueId: string;
  passportQrUrl: string;
  tierAccess: 'PUBLIC';
  dataExchangeFramework: 'MOCK';

  batteryCategory: string;
  manufacturerName: string;
  manufacturingDate: string;
  manufacturingLocation: string;

  carbonFootprintKgCo2e: number;
  carbonIntensityClass: string;

  recycledContentPct: number;
  cobaltPct: number;
  lithiumPct: number;
  nickelPct: number;
  manganesePct: number;

  ratedCapacityAh: number;
  energyDensityWhKg: number;
  powerDensityWKg: number;
  expectedLifetimeCycles: number;
  temperatureRangeMin: number;
  temperatureRangeMax: number;

  recycledCobaltPct: number;
  recycledLithiumPct: number;
  recycledNickelPct: number;
  eolGuidanceText: string;

  issuedAt: string;
  expiresAt: string;
}

export interface GeneratedPassportRestricted extends GeneratedPassportPublic {
  tierAccess: 'RESTRICTED';
  unitSoH: number;
  unitSoC: number;
  chargeCycleCount: number;
  fullChargeCapacityAh: number;
  remainingCapacityAh: number;
  tempHistoryMin: number;
  tempHistoryMax: number;
  tempHistoryAvg: number;
  batteryStatusCode: 'GOOD' | 'DEGRADED' | 'FAULTY';
  negativeEvents: NegativeEvent[];
}

export type GeneratedPassport = GeneratedPassportPublic | GeneratedPassportRestricted;

export interface PassportCoverage {
  hasPassport: boolean;
  passport?: GeneratedPassport;
}

// ── Deterministic seeded random ───────────────────────────────────────────────

function seededRand(seed: string, idx: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  h = (Math.imul(h, idx + 1337)) | 0;
  return Math.abs(h) / 2147483647;
}

function r(seed: string, idx: number, min: number, max: number): number {
  return min + seededRand(seed, idx) * (max - min);
}

// ── Chemistry constants ───────────────────────────────────────────────────────

const CARBON: Record<Chemistry, { min: number; max: number }> = {
  LFP: { min: 55, max: 80  },
  NMC: { min: 80, max: 120 },
  NCA: { min: 90, max: 130 },
};

const COMPOSITION: Record<Chemistry, { cobalt: number; lithium: number; nickel: number; manganese: number }> = {
  LFP: { cobalt: 0,    lithium: 5.4, nickel: 0,    manganese: 0   },
  NMC: { cobalt: 6.5,  lithium: 4.8, nickel: 15.5, manganese: 7.2 },
  NCA: { cobalt: 10.2, lithium: 5.1, nickel: 20.4, manganese: 0   },
};

function carbonClass(kgPerKwh: number): string {
  if (kgPerKwh < 60)  return 'A';
  if (kgPerKwh < 80)  return 'B';
  if (kgPerKwh < 100) return 'C';
  if (kgPerKwh < 120) return 'D';
  return 'E';
}

function batteryStatus(soh: number): 'GOOD' | 'DEGRADED' | 'FAULTY' {
  if (soh >= 85) return 'GOOD';
  if (soh >= 70) return 'DEGRADED';
  return 'FAULTY';
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generatePassportCoverage(battery: GeneratedBattery): PassportCoverage {
  const seed = battery.serialNumber;

  // 60% coverage
  if (seededRand(seed, 0) >= 0.60) return { hasPassport: false };

  const chemistry  = battery.model.chemistry as Chemistry;
  const bench      = CARBON[chemistry];
  const comp       = COMPOSITION[chemistry];
  const capacityKwh = battery.model.capacityKwh;
  const capacityAh  = (capacityKwh * 1000) / battery.model.nominalVoltageV;
  const ageYears   = battery.ageWeeks / 52;

  const carbonFootprint = r(seed, 1, bench.min, bench.max);

  const location =
    battery.serialNumber.includes('-EU-') ? 'Germany' :
    battery.serialNumber.includes('-CA-') ? 'Canada'  :
    battery.serialNumber.includes('-IN-') ? 'India'   : 'USA';

  const publicPayload: GeneratedPassportPublic = {
    passportUniqueId:       `30PPID/${battery.serialNumber}-EU2027`,
    passportQrUrl:          `https://passport.voltledger.io/qr/${battery.serialNumber}`,
    tierAccess:             'PUBLIC',
    dataExchangeFramework:  'MOCK',
    batteryCategory:        'EV',
    manufacturerName:       battery.model.manufacturer,
    manufacturingDate:      battery.manufacturedAt.toISOString(),
    manufacturingLocation:  location,

    carbonFootprintKgCo2e: Math.round(carbonFootprint * 10) / 10,
    carbonIntensityClass:  carbonClass(carbonFootprint),

    recycledContentPct:   Math.round(r(seed, 2, 8, 28) * 10) / 10,
    cobaltPct:            Math.round(comp.cobalt * 10) / 10,
    lithiumPct:           Math.round(comp.lithium * 10) / 10,
    nickelPct:            Math.round(comp.nickel * 10) / 10,
    manganesePct:         Math.round(comp.manganese * 10) / 10,

    ratedCapacityAh:       Math.round(capacityAh * 10) / 10,
    energyDensityWhKg:     Math.round(r(seed, 3, 140, 260) * 10) / 10,
    powerDensityWKg:       Math.round(r(seed, 4, 600, 1400) * 10) / 10,
    expectedLifetimeCycles: chemistry === 'LFP' ? 3000 : chemistry === 'NMC' ? 1500 : 1200,
    temperatureRangeMin:   chemistry === 'LFP' ? -20 : -10,
    temperatureRangeMax:   chemistry === 'LFP' ? 60  : 45,

    recycledCobaltPct:   chemistry === 'LFP' ? 0 : Math.round(r(seed, 5, 3, 18) * 10) / 10,
    recycledLithiumPct:  Math.round(r(seed, 6, 2, 12) * 10) / 10,
    recycledNickelPct:   chemistry === 'LFP' ? 0 : Math.round(r(seed, 7, 5, 22) * 10) / 10,

    eolGuidanceText: `Disassemble per EN IEC 62619. Li-ion cells require certified recycler. Hazardous: ${chemistry === 'NMC' || chemistry === 'NCA' ? 'cobalt, nickel. ' : ''}Do not puncture or incinerate.`,

    issuedAt:  new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 365.25 * 86400 * 1000).toISOString(),
  };

  // 30% get restricted tier
  if (seededRand(seed, 8) >= 0.30) {
    return { hasPassport: true, passport: publicPayload };
  }

  // Restricted: SoH aligned with actual telemetry ± small noise
  const actualSoH  = battery.summary.currentSoH;
  const noise      = r(seed, 9, -2, 2);
  const unitSoH    = Math.min(100, Math.max(50, Math.round((actualSoH + noise) * 10) / 10));
  const cycleRate: Record<Chemistry, number> = { LFP: 350, NMC: 250, NCA: 200 };
  const chargeCycleCount = Math.round(ageYears * cycleRate[chemistry]);

  const negativeEvents: NegativeEvent[] = [];
  if (battery.summary.riskIndicators.thermalAnomaly || seededRand(seed, 10) < 0.12) {
    negativeEvents.push({
      type:        'THERMAL_EVENT',
      date:        new Date(Date.now() - r(seed, 11, 60, 730) * 86400 * 1000).toISOString().slice(0, 10),
      description: 'Cell temperature exceedance >55°C during fast-charge session.',
    });
  }
  if (seededRand(seed, 12) < 0.06) {
    negativeEvents.push({
      type:        'DEEP_DISCHARGE',
      date:        new Date(Date.now() - r(seed, 13, 30, 400) * 86400 * 1000).toISOString().slice(0, 10),
      description: 'Pack discharged below 2.5V/cell on 3+ occasions.',
    });
  }

  const restricted: GeneratedPassportRestricted = {
    ...publicPayload,
    tierAccess:           'RESTRICTED',
    unitSoH,
    unitSoC:              Math.round(r(seed, 14, 20, 85) * 10) / 10,
    chargeCycleCount,
    fullChargeCapacityAh: Math.round(capacityAh * (unitSoH / 100) * 10) / 10,
    remainingCapacityAh:  Math.round(capacityAh * (unitSoH / 100) * r(seed, 15, 0.5, 0.9) * 10) / 10,
    tempHistoryMin:       Math.round(r(seed, 16, -15, 5) * 10) / 10,
    tempHistoryMax:       Math.round(r(seed, 17, 38, 62) * 10) / 10,
    tempHistoryAvg:       Math.round(r(seed, 18, 20, 32) * 10) / 10,
    batteryStatusCode:    batteryStatus(unitSoH),
    negativeEvents,
  };

  return { hasPassport: true, passport: restricted };
}

/** Generate passport coverage for an entire fleet */
export function generateFleetPassports(
  fleet: GeneratedBattery[],
): Array<{ serialNumber: string } & PassportCoverage> {
  return fleet.map(b => ({
    serialNumber: b.serialNumber,
    ...generatePassportCoverage(b),
  }));
}

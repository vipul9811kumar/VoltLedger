/**
 * Mock Passport Resolver
 *
 * Generates realistic EU Battery Passport data from a battery's serial number
 * and any known telemetry context. Used for demos and local dev.
 *
 * Coverage model (mirrors real-world ramp):
 *   - 60% of batteries get a passport (post-2027 originations)
 *   - Of those: 70% public tier only, 30% restricted tier
 *   - Restricted-tier SoH is consistent with telemetry (±3% noise)
 */

import type {
  PassportResolver,
  PassportResolveResult,
  RawPassportData,
  ResolveOptions,
  BatteryStatusCode,
} from '@voltledger/types';

// Seeded deterministic random from a string — same serial always gives same passport
function seededRand(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = (Math.imul(h, index + 1337)) | 0;
  return Math.abs(h) / 2147483647;
}

function r(seed: string, index: number, min: number, max: number): number {
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

export class MockPassportResolver implements PassportResolver {
  readonly framework = 'MOCK' as const;

  canHandle(_identifier: string): boolean {
    return true; // mock handles everything
  }

  async resolve(
    identifier: string,
    options?: ResolveOptions,
  ): Promise<PassportResolveResult> {
    const start = Date.now();

    // Simulate latency
    await new Promise(res => setTimeout(res, 40 + Math.floor(r(identifier, 0, 0, 60))));

    // ~60% of batteries have a passport (post-2027 ramp)
    const hasCoverage = seededRand(identifier, 1) < 0.60;
    if (!hasCoverage) {
      return {
        success: false,
        error: 'No EU Battery Passport found for this identifier (pre-regulation asset)',
        tierAccess: 'PUBLIC',
        resolvedAt: new Date(),
        framework: 'MOCK',
        latencyMs: Date.now() - start,
      };
    }

    // Parse chemistry from serial (e.g. "CATL-EU-24-00001")
    const serial = identifier.toUpperCase();
    let chemistry = 'NMC';
    if (serial.startsWith('CATL') || serial.startsWith('BYD')) chemistry = 'LFP';
    if (serial.startsWith('PANA')) chemistry = 'NCA';

    const bench = CARBON_BY_CHEMISTRY[chemistry] ?? CARBON_BY_CHEMISTRY.NMC;
    const comp  = COMPOSITION[chemistry] ?? COMPOSITION.NMC;

    const capacityKwh = 60 + r(identifier, 2, 0, 60);
    const capacityAh  = (capacityKwh * 1000) / 370; // ~370V nominal
    const ageYears = 0.5 + r(identifier, 3, 0, 4);

    const carbonFootprint = r(identifier, 4, bench.min, bench.max);

    // Public tier payload
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

    // ~30% of passport batteries have restricted tier
    const hasRestricted = options?.preferRestrictedTier
      || seededRand(identifier, 11) < 0.30;

    if (!hasRestricted) {
      return {
        success: true,
        passportData: publicData,
        tierAccess: 'PUBLIC',
        resolvedAt: new Date(),
        framework: 'MOCK',
        latencyMs: Date.now() - start,
      };
    }

    // Restricted tier: SoH consistent with chemistry + age degradation
    const degRatePerYear: Record<string, number> = { LFP: 1.5, NMC: 2.5, NCA: 3.0 };
    const baseSoH   = 100 - ageYears * (degRatePerYear[chemistry] ?? 2.5);
    const noise     = r(identifier, 12, -3, 3);
    const unitSoH   = Math.min(100, Math.max(50, Math.round((baseSoH + noise) * 10) / 10));
    const cycleRate: Record<string, number> = { LFP: 350, NMC: 250, NCA: 200 }; // cycles/year typical
    const chargeCycleCount = Math.round(ageYears * (cycleRate[chemistry] ?? 250));

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
      success: true,
      passportData: {
        ...publicData,
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
      },
      tierAccess: 'RESTRICTED',
      resolvedAt: new Date(),
      framework:  'MOCK',
      latencyMs:  Date.now() - start,
    };
  }
}

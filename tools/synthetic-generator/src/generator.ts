/**
 * Main battery fleet generator.
 * Produces a realistic set of batteries with full telemetry histories.
 */

import { randomUUID } from 'crypto';
import {
  BATTERY_MODELS,
  CHEMISTRY_PARAMS,
  USAGE_PROFILES,
  type BatteryModelDef,
  type UsageProfile,
} from './models';
import { generateDegradationTrajectory } from './degradation';

export interface GeneratedBattery {
  id: string;
  serialNumber: string;
  vin: string;
  model: BatteryModelDef;
  usageProfile: UsageProfile;
  manufacturedAt: Date;
  ageWeeks: number;         // how old the battery is today
  telemetry: GeneratedTelemetryPoint[];
  summary: {
    currentSoH: number;
    currentCycles: number;
    currentOdometerKm: number;
    riskIndicators: {
      abnormalDegradation: boolean;
      highDcfc: boolean;
      thermalAnomaly: boolean;
    };
  };
}

export interface GeneratedTelemetryPoint {
  recordedAt: Date;
  stateOfHealth: number;
  stateOfCharge: number;
  fullChargeCapacityKwh: number;
  cycleCount: number;
  cellTempMin: number;
  cellTempMax: number;
  cellTempAvg: number;
  voltageMin: number;
  voltageMax: number;
  internalResistanceAvg: number;
  chargingEvents24h: number;
  dcFastChargeRatio: number;
  odometer: number;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSerial(manufacturer: string, index: number): string {
  const prefix = manufacturer.slice(0, 4).toUpperCase().replace(/\s/g, '');
  const region = randomFrom(['US', 'EU', 'CA', 'IN', 'AU']);
  const year = randomFrom(['23', '24', '25']);
  const seq = String(index).padStart(5, '0');
  return `${prefix}-${region}-${year}-${seq}`;
}

function generateVin(index: number): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  const wmi = randomFrom(['1HG', '2T1', 'KMH', 'WDD', '5YJ', 'JN1', 'SCA']);
  let vin = wmi;
  for (let i = 0; i < 14; i++) {
    vin += chars[Math.floor(Math.random() * chars.length)];
  }
  return vin;
}

/** Detect abnormal degradation — SoH loss >15% in first 2 years */
function detectAbnormalDegradation(telemetry: GeneratedTelemetryPoint[], ageWeeks: number): boolean {
  if (ageWeeks < 104) return false;
  const at104 = telemetry.find(t => {
    const weekIdx = Math.round(
      (telemetry[telemetry.length - 1].recordedAt.getTime() - t.recordedAt.getTime()) /
        (7 * 24 * 3600 * 1000),
    );
    return ageWeeks - weekIdx === 104;
  });
  if (!at104) return false;
  const current = telemetry[telemetry.length - 1];
  return current.stateOfHealth < at104.stateOfHealth - 15;
}

export interface GeneratorOptions {
  batteryCount: number;
  /** Max history in weeks. Default 260 (5 years). Min age 12 weeks. */
  maxWeeks: number;
  /** Telemetry sampling interval in weeks. Default 1 (weekly). */
  sampleEveryNWeeks: number;
  /** Seed for reproducible output (not strictly seeded, but sets a mode). */
  verbose: boolean;
}

export function generateFleet(options: GeneratorOptions): GeneratedBattery[] {
  const { batteryCount, maxWeeks, sampleEveryNWeeks, verbose } = options;
  const fleet: GeneratedBattery[] = [];
  const now = new Date();

  for (let i = 0; i < batteryCount; i++) {
    const model = randomFrom(BATTERY_MODELS);
    const profile = randomFrom(USAGE_PROFILES);
    const params = CHEMISTRY_PARAMS[model.chemistry];

    // Random age between 3 months and maxWeeks
    const ageWeeks = 12 + Math.floor(Math.random() * (maxWeeks - 12));

    const manufacturedAt = new Date(now.getTime() - ageWeeks * 7 * 24 * 3600 * 1000);
    const serialNumber = generateSerial(model.manufacturer, i + 1);
    const vin = generateVin(i + 1);

    if (verbose) {
      process.stdout.write(
        `  [${i + 1}/${batteryCount}] ${serialNumber} · ${model.chemistry} · ${profile.name} · ${ageWeeks}w\n`,
      );
    }

    // Generate full weekly trajectory
    const trajectory = generateDegradationTrajectory(
      params,
      profile,
      model.capacityKwh,
      model.nominalVoltageV,
      ageWeeks,
    );

    // Down-sample if sampleEveryNWeeks > 1
    const sampled = trajectory.filter(p => p.week % sampleEveryNWeeks === 0);

    // Convert trajectory points to telemetry with real timestamps
    const telemetry: GeneratedTelemetryPoint[] = sampled.map(point => {
      const weekAge = ageWeeks - point.week;
      const recordedAt = new Date(now.getTime() - weekAge * 7 * 24 * 3600 * 1000);
      // Add a small jitter within the week so timestamps aren't all midnight Monday
      recordedAt.setHours(Math.floor(Math.random() * 24));
      recordedAt.setMinutes(Math.floor(Math.random() * 60));

      return {
        recordedAt,
        stateOfHealth: point.soh,
        stateOfCharge: point.usage.stateOfCharge,
        fullChargeCapacityKwh: point.usage.fullChargeCapacityKwh,
        cycleCount: point.cycleCount,
        cellTempMin: point.thermal.cellTempMin,
        cellTempMax: point.thermal.cellTempMax,
        cellTempAvg: point.thermal.cellTempAvg,
        voltageMin: point.usage.voltageMin,
        voltageMax: point.usage.voltageMax,
        internalResistanceAvg: point.usage.internalResistanceAvg,
        chargingEvents24h: point.usage.chargingEvents,
        dcFastChargeRatio: point.usage.dcFastChargeRatio,
        odometer: point.usage.odometer,
      };
    });

    const latest = telemetry[telemetry.length - 1];

    fleet.push({
      id: randomUUID(),
      serialNumber,
      vin,
      model,
      usageProfile: profile,
      manufacturedAt,
      ageWeeks,
      telemetry,
      summary: {
        currentSoH: latest?.stateOfHealth ?? 100,
        currentCycles: latest ? trajectory[trajectory.length - 1].cycleCount : 0,
        currentOdometerKm: latest?.odometer ?? 0,
        riskIndicators: {
          abnormalDegradation: detectAbnormalDegradation(telemetry, ageWeeks),
          highDcfc: profile.dcfcRatio > 0.4,
          thermalAnomaly: latest ? latest.cellTempMax > params.tempOperatingMax : false,
        },
      },
    });
  }

  return fleet;
}

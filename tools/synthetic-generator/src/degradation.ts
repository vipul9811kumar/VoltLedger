/**
 * Electrochemical degradation model for VoltLedger synthetic data.
 *
 * SoH(t) = 100 - calendarLoss - cycleLoss - dcfcLoss - thermalLoss + noise
 *
 * Based on real-world degradation studies:
 *   - Attia et al. (2022): Calendar aging parametrization
 *   - Dubarry et al. (2020): DCFC impact on capacity fade
 *   - Waldmann et al. (2014): Temperature effects on Li-ion aging
 */

import type { ChemistryParams, UsageProfile } from './models';

export interface DegradationPoint {
  weeksSinceManufacture: number;
  soh: number;             // 0–100 (%)
  cycleCount: number;
  cumulativeKm: number;
}

export interface ThermalProfile {
  cellTempMin: number;
  cellTempMax: number;
  cellTempAvg: number;
}

export interface UsageSnapshot {
  stateOfCharge: number;       // 0–100
  fullChargeCapacityKwh: number;
  chargingEvents: number;
  dcFastChargeRatio: number;
  voltageMin: number;
  voltageMax: number;
  internalResistanceAvg: number;
  odometer: number;
}

/** Small Gaussian noise — keeps telemetry realistic, not perfectly smooth */
function gaussianNoise(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute SoH at a given point in time using a physics-inspired model.
 *
 * The model separates:
 *   1. Calendar aging   — time-dependent (even idle batteries age)
 *   2. Cycle aging      — charge-cycle dependent
 *   3. DCFC stress      — amplifies cycle aging based on fast-charge ratio
 *   4. Thermal stress   — accelerates all aging above optimal temp
 *   5. Gaussian noise   — sensor variance and real-world variability
 */
export function computeSoH(
  params: ChemistryParams,
  profile: UsageProfile,
  weeksElapsed: number,
): number {
  const yearsElapsed = weeksElapsed / 52;

  // 1. Calendar aging — logarithmic after year 1 (slows down as electrolyte stabilizes)
  const calendarLoss =
    params.calendarLossPctPerYear *
    (yearsElapsed < 1
      ? yearsElapsed
      : 1 + Math.log(yearsElapsed) * 0.6);

  // 2. Cycle count estimate for this week
  const cyclesPerYear = profile.chargesPerDay * 365 * profile.avgDailyDepthOfDischarge;
  const totalCycles = cyclesPerYear * yearsElapsed;
  const cycleLoss = (totalCycles / 100) * params.cycleLossPctPer100Cycles;

  // 3. DCFC stress — accelerates cycle aging proportionally
  const dcfcLoss = cycleLoss * params.dcfcSensitivity * profile.dcfcRatio;

  // 4. Thermal stress — °C above optimal × sensitivity × years
  const avgCellTemp = params.tempOptimal + profile.tempBias;
  const tempExcess = Math.max(0, avgCellTemp - params.tempOptimal);
  const thermalLoss = params.thermalLossPctPerDegPerYear * tempExcess * yearsElapsed;

  // 5. Raw SoH before noise
  const rawSoH = 100 - calendarLoss - cycleLoss - dcfcLoss - thermalLoss;

  // 6. Add sensor noise (±0.4% stddev — realistic BMS variance)
  const noisySoH = rawSoH + gaussianNoise(0, 0.4);

  return clamp(noisySoH, 0, 100);
}

/** Compute total cycle count at a given week */
export function computeCycleCount(profile: UsageProfile, weeksElapsed: number): number {
  const yearsElapsed = weeksElapsed / 52;
  const cyclesPerYear = profile.chargesPerDay * 365 * profile.avgDailyDepthOfDischarge;
  const raw = Math.round(cyclesPerYear * yearsElapsed);
  return Math.max(0, raw);
}

/** Compute cumulative odometer at a given week */
export function computeOdometer(profile: UsageProfile, weeksElapsed: number): number {
  const totalKm = profile.avgDailyKm * weeksElapsed * 7;
  return Math.max(0, Math.round(totalKm + gaussianNoise(0, 20)));
}

/** Generate a realistic thermal snapshot for a given chemistry + usage + season */
export function computeThermalProfile(
  params: ChemistryParams,
  profile: UsageProfile,
  weekOfYear: number,     // 0–51
): ThermalProfile {
  // Seasonal temperature variation (Northern Hemisphere bias)
  const seasonalBias = -8 * Math.cos((2 * Math.PI * weekOfYear) / 52);
  const ambientTemp = params.tempOptimal + seasonalBias + profile.tempBias;

  // Cell temp is higher than ambient during operation
  const operationalHeat = profile.avgDailyDepthOfDischarge * 10;

  const cellTempAvg = clamp(
    ambientTemp + operationalHeat / 2 + gaussianNoise(0, 1.5),
    params.tempOperatingMin,
    params.tempOperatingMax,
  );
  const cellTempMin = clamp(
    cellTempAvg - 5 - Math.random() * 3,
    params.tempOperatingMin - 5,
    cellTempAvg,
  );
  const cellTempMax = clamp(
    cellTempAvg + operationalHeat / 2 + gaussianNoise(0, 2),
    cellTempAvg,
    params.tempOperatingMax + 5,
  );

  return {
    cellTempMin: Math.round(cellTempMin * 10) / 10,
    cellTempMax: Math.round(cellTempMax * 10) / 10,
    cellTempAvg: Math.round(cellTempAvg * 10) / 10,
  };
}

/** Generate electrical + usage snapshot for a telemetry point */
export function computeUsageSnapshot(
  params: ChemistryParams,
  profile: UsageProfile,
  currentSoH: number,
  nominalCapacityKwh: number,
  nominalVoltageV: number,
): UsageSnapshot {
  // Full charge capacity degrades linearly with SoH
  const fullChargeCapacityKwh = nominalCapacityKwh * (currentSoH / 100);

  // SoC — random snapshot of state at reading time, respecting usage profile
  const socMin = params.socMin + (profile.avgSocAtCharge - 50) * 0.3;
  const socMax = clamp(params.socMax - (100 - profile.avgSocAtCharge) * 0.2, 50, 100);
  const stateOfCharge = clamp(
    gaussianNoise((socMin + socMax) / 2, 15),
    socMin,
    socMax,
  );

  // Voltage correlates with SoC and SoH
  const voltageRange = nominalVoltageV * 0.12; // ±12% of nominal
  const voltageNominal = nominalVoltageV * (0.85 + (stateOfCharge / 100) * 0.15);
  const voltageMin = clamp(voltageNominal - voltageRange * 0.5, nominalVoltageV * 0.75, voltageNominal);
  const voltageMax = clamp(voltageNominal + voltageRange * 0.3, voltageNominal, nominalVoltageV * 1.05);

  // Internal resistance increases as battery ages (SoH degrades)
  // LFP: ~0.5 mΩ new → ~1.2 mΩ at 80% SoH
  const resistanceBase = nominalVoltageV * 0.001;  // rough scale
  const agingFactor = 1 + (1 - currentSoH / 100) * 2.5;
  const internalResistanceAvg = clamp(
    resistanceBase * agingFactor + gaussianNoise(0, resistanceBase * 0.1),
    0.1,
    5.0,
  );

  const chargingEvents = Math.round(
    profile.chargesPerDay * 7 + gaussianNoise(0, 0.5),
  );

  const dcFastChargeRatio = clamp(
    profile.dcfcRatio + gaussianNoise(0, 0.05),
    0,
    1,
  );

  return {
    stateOfCharge: Math.round(stateOfCharge * 10) / 10,
    fullChargeCapacityKwh: Math.round(fullChargeCapacityKwh * 100) / 100,
    chargingEvents: Math.max(0, chargingEvents),
    dcFastChargeRatio: Math.round(dcFastChargeRatio * 100) / 100,
    voltageMin: Math.round(voltageMin * 10) / 10,
    voltageMax: Math.round(voltageMax * 10) / 10,
    internalResistanceAvg: Math.round(internalResistanceAvg * 100) / 100,
    odometer: 0, // set by caller from cumulative odometer
  };
}

/**
 * Generate a full degradation trajectory for a battery from manufacture
 * to `totalWeeks`, sampled weekly.
 */
export function generateDegradationTrajectory(
  params: ChemistryParams,
  profile: UsageProfile,
  nominalCapacityKwh: number,
  nominalVoltageV: number,
  totalWeeks: number,
): Array<{
  week: number;
  soh: number;
  cycleCount: number;
  odometerKm: number;
  thermal: ThermalProfile;
  usage: UsageSnapshot;
}> {
  const trajectory = [];

  for (let week = 0; week <= totalWeeks; week++) {
    const soh = computeSoH(params, profile, week);
    const cycleCount = computeCycleCount(profile, week);
    const odometerKm = computeOdometer(profile, week);
    const thermal = computeThermalProfile(params, profile, week % 52);
    const usage = computeUsageSnapshot(params, profile, soh, nominalCapacityKwh, nominalVoltageV);

    trajectory.push({
      week,
      soh: Math.round(soh * 10) / 10,
      cycleCount,
      odometerKm,
      thermal,
      usage: { ...usage, odometer: odometerKm },
    });
  }

  return trajectory;
}

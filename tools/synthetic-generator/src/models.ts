/**
 * Synthetic battery model definitions.
 * Based on real-world chemistry specs and manufacturer data.
 */

export type Chemistry = 'LFP' | 'NMC' | 'NCA';

export interface BatteryModelDef {
  id: string;
  modelName: string;
  manufacturer: string;
  chemistry: Chemistry;
  capacityKwh: number;
  nominalVoltageV: number;
  weightKg: number;
  ratedCycleLife: number;       // cycles to 80% SoH
  calendarLifeYears: number;
  warrantyYears: number;
  vehicleSegment: string;
}

// Real-world inspired battery pack models
export const BATTERY_MODELS: BatteryModelDef[] = [
  {
    id: 'catl-lfp-60',
    modelName: 'LFP-60 Standard Range',
    manufacturer: 'CATL',
    chemistry: 'LFP',
    capacityKwh: 60.0,
    nominalVoltageV: 355,
    weightKg: 385,
    ratedCycleLife: 3000,
    calendarLifeYears: 15,
    warrantyYears: 8,
    vehicleSegment: 'Passenger / Compact',
  },
  {
    id: 'catl-lfp-80',
    modelName: 'LFP-80 Long Range',
    manufacturer: 'CATL',
    chemistry: 'LFP',
    capacityKwh: 80.0,
    nominalVoltageV: 370,
    weightKg: 490,
    ratedCycleLife: 3000,
    calendarLifeYears: 15,
    warrantyYears: 8,
    vehicleSegment: 'Passenger / Mid-size',
  },
  {
    id: 'lg-nmc-75',
    modelName: 'Chem NCMA 75',
    manufacturer: 'LG Energy Solution',
    chemistry: 'NMC',
    capacityKwh: 75.0,
    nominalVoltageV: 400,
    weightKg: 455,
    ratedCycleLife: 1500,
    calendarLifeYears: 10,
    warrantyYears: 8,
    vehicleSegment: 'Passenger / Mid-size',
  },
  {
    id: 'panasonic-nca-100',
    modelName: '2170 NCA 100',
    manufacturer: 'Panasonic',
    chemistry: 'NCA',
    capacityKwh: 100.0,
    nominalVoltageV: 400,
    weightKg: 540,
    ratedCycleLife: 1200,
    calendarLifeYears: 10,
    warrantyYears: 8,
    vehicleSegment: 'Passenger / Premium',
  },
  {
    id: 'byd-lfp-50',
    modelName: 'Blade LFP 50',
    manufacturer: 'BYD',
    chemistry: 'LFP',
    capacityKwh: 50.0,
    nominalVoltageV: 320,
    weightKg: 310,
    ratedCycleLife: 3500,
    calendarLifeYears: 15,
    warrantyYears: 8,
    vehicleSegment: 'Passenger / Compact',
  },
  {
    id: 'sk-nmc-commercial',
    modelName: 'NMC-Commercial 120',
    manufacturer: 'SK On',
    chemistry: 'NMC',
    capacityKwh: 120.0,
    nominalVoltageV: 800,
    weightKg: 660,
    ratedCycleLife: 2000,
    calendarLifeYears: 12,
    warrantyYears: 8,
    vehicleSegment: 'Commercial / Fleet',
  },
];

// Electrochemical degradation parameters per chemistry
export interface ChemistryParams {
  // Calendar aging (% SoH lost per year at rest)
  calendarLossPctPerYear: number;
  // Cycle aging (% SoH lost per 100 full cycles)
  cycleLossPctPer100Cycles: number;
  // Multiplier on cycle loss for DCFC fraction (0–1)
  dcfcSensitivity: number;
  // Thermal sensitivity: extra % SoH loss per °C above optimal per year
  thermalLossPctPerDegPerYear: number;
  // Optimal storage/operation temperature °C
  tempOptimal: number;
  // Typical cell temp range during operation
  tempOperatingMin: number;
  tempOperatingMax: number;
  // Acceptable SoC window for daily driving (min/max charge level)
  socMin: number;
  socMax: number;
}

export const CHEMISTRY_PARAMS: Record<Chemistry, ChemistryParams> = {
  LFP: {
    calendarLossPctPerYear: 0.8,
    cycleLossPctPer100Cycles: 0.5,
    dcfcSensitivity: 0.25,       // LFP handles DCFC well
    thermalLossPctPerDegPerYear: 0.04,
    tempOptimal: 25,
    tempOperatingMin: 18,
    tempOperatingMax: 42,
    socMin: 10,
    socMax: 100,                 // LFP can charge to 100% regularly
  },
  NMC: {
    calendarLossPctPerYear: 1.5,
    cycleLossPctPer100Cycles: 1.0,
    dcfcSensitivity: 0.7,
    thermalLossPctPerDegPerYear: 0.10,
    tempOptimal: 20,
    tempOperatingMin: 15,
    tempOperatingMax: 38,
    socMin: 15,
    socMax: 90,                  // NMC degrades if charged to 100% often
  },
  NCA: {
    calendarLossPctPerYear: 2.0,
    cycleLossPctPer100Cycles: 1.2,
    dcfcSensitivity: 1.0,
    thermalLossPctPerDegPerYear: 0.14,
    tempOptimal: 20,
    tempOperatingMin: 15,
    tempOperatingMax: 35,
    socMin: 15,
    socMax: 90,
  },
};

// Usage profiles — simulate different driver/fleet behaviors
export interface UsageProfile {
  name: string;
  // Average daily km driven
  avgDailyKm: number;
  // Fraction of charging events that are DCFC
  dcfcRatio: number;
  // Average daily charge depth (0–1, fraction of capacity used per day)
  avgDailyDepthOfDischarge: number;
  // Typical SoC at which driver plugs in (0–100)
  avgSocAtCharge: number;
  // How often battery charges per day (events)
  chargesPerDay: number;
  // Temperature environment bias (°C added to cell temp avg)
  tempBias: number;
}

export const USAGE_PROFILES: UsageProfile[] = [
  {
    name: 'DAILY_COMMUTER',
    avgDailyKm: 50,
    dcfcRatio: 0.05,
    avgDailyDepthOfDischarge: 0.3,
    avgSocAtCharge: 30,
    chargesPerDay: 0.8,
    tempBias: 0,
  },
  {
    name: 'HIGH_MILEAGE_DRIVER',
    avgDailyKm: 150,
    dcfcRatio: 0.35,
    avgDailyDepthOfDischarge: 0.7,
    avgSocAtCharge: 15,
    chargesPerDay: 1.5,
    tempBias: 3,
  },
  {
    name: 'RIDESHARE_FLEET',
    avgDailyKm: 250,
    dcfcRatio: 0.6,
    avgDailyDepthOfDischarge: 0.85,
    avgSocAtCharge: 10,
    chargesPerDay: 2.5,
    tempBias: 5,
  },
  {
    name: 'WEEKEND_DRIVER',
    avgDailyKm: 20,
    dcfcRatio: 0.02,
    avgDailyDepthOfDischarge: 0.15,
    avgSocAtCharge: 60,
    chargesPerDay: 0.3,
    tempBias: -2,
  },
  {
    name: 'COMMERCIAL_DELIVERY',
    avgDailyKm: 180,
    dcfcRatio: 0.5,
    avgDailyDepthOfDischarge: 0.8,
    avgSocAtCharge: 12,
    chargesPerDay: 2.0,
    tempBias: 4,
  },
];

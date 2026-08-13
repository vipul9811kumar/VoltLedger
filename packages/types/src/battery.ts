/**
 * Core battery domain types for VoltLedger
 */

export type BatteryChemistry = 'LFP' | 'NMC' | 'NCA' | 'LTO' | 'UNKNOWN';
export type BatteryStatus = 'ACTIVE' | 'FLAGGED' | 'DECOMMISSIONED' | 'SECOND_LIFE';
export type DataSourceType = 'OEM_API' | 'MQTT_TELEMATICS' | 'MANUAL_UPLOAD' | 'AUCTION_SCAN';

/**
 * Build spec v2 §1.3's transparency guardrail: everything the Evidence Layer surfaces states
 * whether it's REAL_ANCHORED (real battery, real data source), SIMULATED_CALIBRATED (synthetic
 * demo data, calibrated model), or ILLUSTRATIVE (not tied to any real-or-synthetic battery at
 * all — no current producer, reserved for future ad-hoc scenarios). See
 * packages/scoring/src/provenance.ts for how this is derived from a battery's DataSource.
 */
export type Provenance = 'REAL_ANCHORED' | 'SIMULATED_CALIBRATED' | 'ILLUSTRATIVE';

export interface Battery {
  id: string;
  vin: string;
  batterySerialNumber: string;
  make: string;
  model: string;
  year: number;
  chemistry: BatteryChemistry;
  nominalCapacityKwh: number;
  packVoltageNominal: number;
  cellCount: number;
  status: BatteryStatus;
  dataSource: DataSourceType;
  firstSeenAt: string;   // ISO 8601
  lastUpdatedAt: string;
  oemWarrantyExpiresAt?: string;
}

export interface BatteryTelemetryPoint {
  id: string;
  batteryId: string;
  recordedAt: string;          // ISO 8601 - TimescaleDB hypertable key
  stateOfHealth: number;       // SoH: 0–100 (%)
  stateOfCharge: number;       // SoC: 0–100 (%)
  fullChargeCapacityKwh: number;
  cycleCount: number;
  cellTempMin: number;         // °C
  cellTempMax: number;         // °C
  cellTempAvg: number;         // °C
  voltageMin: number;          // V
  voltageMax: number;          // V
  internalResistanceAvg?: number; // mΩ
  chargingEvents24h?: number;
  dcFastChargeRatio?: number;  // 0–1 (fraction of charges that were DCFC)
  odometer?: number;           // km
  rawPayload?: Record<string, unknown>;
}

export interface BatterySummary {
  battery: Battery;
  latestSoH: number;
  latestSoC: number;
  totalCycles: number;
  lastTelemetryAt: string;
  riskGrade?: RiskGrade;
  estimatedResidualValueUsd?: number;
}

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

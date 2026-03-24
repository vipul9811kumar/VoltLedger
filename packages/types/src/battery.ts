/**
 * Core battery domain types for VoltLedger
 */

export type BatteryChemistry = 'LFP' | 'NMC' | 'NCA' | 'LTO' | 'UNKNOWN';
export type BatteryStatus = 'ACTIVE' | 'FLAGGED' | 'DECOMMISSIONED' | 'SECOND_LIFE';
export type DataSourceType = 'OEM_API' | 'MQTT_TELEMATICS' | 'MANUAL_UPLOAD' | 'AUCTION_SCAN';

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

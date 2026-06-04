/**
 * EU Battery Passport types — Regulation (EU) 2023/1542
 */

export type PassportTier = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
export type DataExchangeFramework = 'CATENA_X' | 'GS1' | 'DIRECT_OEM' | 'THIRD_PARTY_AGGREGATOR' | 'MOCK';
export type SoHSource = 'PASSPORT' | 'TELEMETRY' | 'BLENDED' | 'NONE';
export type BatteryStatusCode = 'GOOD' | 'DEGRADED' | 'FAULTY' | 'REPURPOSED';

// ── Raw passport data shape returned by all resolvers ─────────────────────────

export interface RawPassportData {
  passportUniqueId: string;     // ISO/IEC 15459 identifier
  passportQrUrl?: string;

  // Public tier
  batteryCategory?: string;
  manufacturerName?: string;
  manufacturingDate?: string;
  manufacturingLocation?: string;

  carbonFootprintKgCo2e?: number;
  carbonIntensityClass?: string;

  recycledContentPct?: number;
  cobaltPct?: number;
  lithiumPct?: number;
  nickelPct?: number;
  manganesePct?: number;

  ratedCapacityAh?: number;
  energyDensityWhKg?: number;
  powerDensityWKg?: number;
  expectedLifetimeCycles?: number;
  temperatureRangeMin?: number;
  temperatureRangeMax?: number;

  recycledCobaltPct?: number;
  recycledLithiumPct?: number;
  recycledNickelPct?: number;
  eolGuidanceText?: string;

  // Restricted tier — only present when access was granted
  unitSoH?: number;
  unitSoC?: number;
  chargeCycleCount?: number;
  fullChargeCapacityAh?: number;
  remainingCapacityAh?: number;
  tempHistoryMin?: number;
  tempHistoryMax?: number;
  tempHistoryAvg?: number;
  batteryStatusCode?: BatteryStatusCode;
  negativeEvents?: Array<{ type: string; date: string; description: string }>;

  issuedAt?: string;
  expiresAt?: string;
}

// ── Resolver contract ─────────────────────────────────────────────────────────

export interface ResolveOptions {
  preferRestrictedTier?: boolean;
  lenderContextId?: string;
}

export interface PassportResolveResult {
  success: boolean;
  passportData?: RawPassportData;
  error?: string;
  tierAccess: PassportTier;
  resolvedAt: Date;
  framework: DataExchangeFramework;
  latencyMs: number;
}

export interface PassportResolver {
  readonly framework: DataExchangeFramework;
  resolve(identifier: string, options?: ResolveOptions): Promise<PassportResolveResult>;
  canHandle(identifier: string): boolean;
}

// ── Scoring context ──────────────────────────────────────────────────────────

export interface PassportContext {
  passportId: string;
  tierAccess: PassportTier;
  isVerified: boolean;
  identityChainValid?: boolean;

  // Public tier (always available when passport exists)
  carbonFootprintKgCo2e?: number;
  recycledContentPct?: number;

  // Restricted tier (null when not authorized)
  unitSoH?: number;
  chargeCycleCount?: number;
  tempHistoryMax?: number;
  batteryStatusCode?: BatteryStatusCode;
}

export interface ReconciledSoH {
  value: number;
  source: SoHSource;
  confidence: number;         // 0–1
  passportSoH?: number;
  telemetrySoH?: number;
  delta?: number;             // passportSoH − telemetrySoH
}

// ── Origination audit ────────────────────────────────────────────────────────

export interface OriginationEvidenceSnapshot {
  capturedAt: string;
  batterySerial: string;
  vin?: string | null;
  chemistry: string;
  nominalCapacityKwh: number;

  sohSource: SoHSource;
  sohUsedPct: number;

  passportPresent: boolean;
  passportUniqueId?: string;
  passportTier?: PassportTier | null;
  passportVerified: boolean;
  passportFields?: Partial<RawPassportData>;

  riskScore?: {
    compositeScore: number;
    grade: string;
    confidenceLevel: number;
  };
}

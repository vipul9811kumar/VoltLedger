/**
 * EU Battery Passport types — Regulation (EU) 2023/1542
 */

export type PassportTier = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
export type DataExchangeFramework = 'CATENA_X' | 'GS1' | 'DIRECT_OEM' | 'THIRD_PARTY_AGGREGATOR' | 'MOCK';
export type SoHSource = 'PASSPORT' | 'TELEMETRY' | 'BLENDED' | 'NONE';
export type BatteryStatusCode = 'GOOD' | 'DEGRADED' | 'FAULTY' | 'REPURPOSED';

/**
 * WS-F data-completeness scenarios (build spec v2 §3's "scenario matrix"). The resolver only
 * ever controls the passport side of a battery's data — whether telemetry exists is a separate
 * fact — so these are passport-scenarios, not full matrix cells. See
 * apps/api/src/lib/passport/scenario-generator.ts.
 */
export type CoverageScenario =
  | 'NO_PASSPORT'             // resolve() fails — no passport exists
  | 'PUBLIC_ONLY'             // resolves, PUBLIC tier, no restricted fields
  | 'RESTRICTED_CONSISTENT'   // resolves, RESTRICTED, unitSoH matches expected chemistry/age curve
  | 'RESTRICTED_CONFLICTING'  // resolves, RESTRICTED, unitSoH deliberately diverges from the curve
  | 'TAMPERED'                // resolves, RESTRICTED, passportUniqueId doesn't contain the real serial
  | 'REISSUED_IDENTITY'       // resolves, RESTRICTED, batteryStatusCode: 'REPURPOSED', priorPassportId set
  | 'ACCESS_PENDING';         // resolves, RESTRICTED-eligible but fields withheld pending access grant

/** Whether VoltLedger has actually been granted restricted-tier access — distinct from
 *  whether restricted data exists at all. See build spec v2 §8's transparency guardrail. */
export type RestrictedAccessStatus = 'GRANTED' | 'PENDING_LEGITIMATE_INTEREST';

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

  /** Links to the passport this one supersedes — set only for a reissued/repurposed-battery
   *  identity (CoverageScenario 'REISSUED_IDENTITY'). */
  priorPassportId?: string;

  issuedAt?: string;
  expiresAt?: string;
}

// ── Resolver contract ─────────────────────────────────────────────────────────

export interface ResolveOptions {
  preferRestrictedTier?: boolean;
  lenderContextId?: string;
  /** Demo/test-only: deterministically force a specific data-completeness scenario instead of
   *  the resolver's organic seeded-random distribution. Not exposed over the public HTTP API —
   *  see apps/api/src/lib/passport/scenario-generator.ts. */
  forceScenario?: CoverageScenario;
}

export interface PassportResolveResult {
  success: boolean;
  passportData?: RawPassportData;
  error?: string;
  tierAccess: PassportTier;
  /** Whether restricted-tier access has actually been granted, distinct from whether
   *  restricted-tier data exists. Absent/undefined means not applicable (e.g. PUBLIC tier or
   *  no passport at all) — only meaningful when tierAccess would otherwise be RESTRICTED. */
  restrictedAccessStatus?: RestrictedAccessStatus;
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

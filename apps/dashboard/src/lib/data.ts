/**
 * Server-side data fetching — calls the VoltLedger API.
 * No direct Prisma / DB access from the dashboard.
 */

const API_URL      = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN ?? '';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'x-service-token': SERVICE_TOKEN },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types (minimal — match API response shapes) ───────────────────────────────

type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

interface RiskScore {
  compositeScore: number;
  grade: RiskGrade;
  scoredAt: string;
  confidenceLevel?: number;
  // Sub-scores (0–100)
  degradationScore?: number;
  thermalScore?: number;
  usagePatternScore?: number;
  capacityRetentionScore?: number;
  ageAdjustedScore?: number;
  // Flags
  abnormalDegradation: boolean;
  thermalAnomalyDetected: boolean;
  highDcfcUsage: boolean;
  deepDischargeHistory: boolean;
}

interface BatteryModel {
  id: string;
  manufacturer: string;
  modelName: string;
  capacityKwh?: number;
  chemistry?: string;
  nominalVoltageV?: number;
  ratedCycleLife?: number;
  warrantyYears?: number;
}

interface Battery {
  id: string;
  serialNumber: string;
  vin?: string | null;
  chemistry: string;
  nominalCapacityKwh: number;
  status: string;
  manufacturedAt?: string | null;
  lastTelemetryAt?: string | null;
  batteryModel: BatteryModel;
  riskScores: RiskScore[];
}

// ── Fleet overview ─────────────────────────────────────────────────────────────

export async function getFleetStats() {
  return apiFetch<{
    total: number;
    gradeCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    recentlyScored: number;
  }>('/v1/batteries/fleet/stats');
}

// ── Battery list (with latest risk score) ─────────────────────────────────────

export async function getBatteryList(page = 1, pageSize = 20, grade?: string) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(grade ? { grade } : {}),
  });
  return apiFetch<{ batteries: Battery[]; total: number; pages: number }>(
    `/v1/batteries/fleet/batteries?${params}`
  );
}

// ── Single battery detail ─────────────────────────────────────────────────────

export async function getBatteryDetail(serialNumber: string) {
  try {
    return await apiFetch<Battery & {
      residualValues: any[];
      ltvRecommendations: any[];
      secondLifeAssessments: any[];
      degradationForecasts: any[];
    }>(`/v1/batteries/${serialNumber}/detail`);
  } catch {
    return null;
  }
}

// ── Telemetry history for SoH sparkline ───────────────────────────────────────

export async function getBatterySoHHistory(batteryId: string, weeks = 12) {
  // batteryId here is actually serialNumber (called with b.serialNumber in pages)
  return apiFetch<Array<{
    recordedAt: string;
    stateOfHealth: number;
    cellTempMax: number;
    stateOfCharge: number;
  }>>(`/v1/batteries/${batteryId}/telemetry?weeks=${weeks}`);
}

// ── Flagged batteries (need attention) ────────────────────────────────────────

export async function getFlaggedBatteries() {
  return apiFetch<Battery[]>('/v1/batteries/fleet/flagged');
}

// ── EU Battery Passport ────────────────────────────────────────────────────────

export type PassportTier = 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';

export interface PassportComposition {
  cobaltPct:    number | null;
  lithiumPct:   number | null;
  nickelPct:    number | null;
  manganesePct: number | null;
}

export interface PassportPerformance {
  ratedCapacityAh:        number | null;
  energyDensityWhKg:      number | null;
  powerDensityWKg:        number | null;
  expectedLifetimeCycles: number | null;
  temperatureRangeMin:    number | null;
  temperatureRangeMax:    number | null;
}

export interface PassportCircularity {
  recycledCobaltPct:  number | null;
  recycledLithiumPct: number | null;
  recycledNickelPct:  number | null;
  eolGuidanceText:    string | null;
}

export interface PassportPublicTier {
  batteryCategory:       string | null;
  manufacturerName:      string | null;
  manufacturingDate:     string | null;
  manufacturingLocation: string | null;
  carbonFootprintKgCo2e: number | null;
  carbonIntensityClass:  string | null;
  recycledContentPct:    number | null;
  composition:           PassportComposition;
  performance:           PassportPerformance;
  circularity:           PassportCircularity;
}

export interface PassportRestrictedTier {
  unitSoH:              number | null;
  unitSoC:              number | null;
  chargeCycleCount:     number | null;
  fullChargeCapacityAh: number | null;
  remainingCapacityAh:  number | null;
  tempHistoryMin:       number | null;
  tempHistoryMax:       number | null;
  tempHistoryAvg:       number | null;
  batteryStatusCode:    string | null;
  negativeEvents:       Array<{ type: string; date: string; description: string }>;
}

export interface PassportVerification {
  identityChainValid: boolean;
  confidenceScore:    number;
  discrepancies:      string[];
  verifiedAt:         string;
}

export interface BatteryPassport {
  id:                    string;
  batteryId:             string;
  passportUniqueId:      string;
  passportQrUrl:         string | null;
  dataExchangeFramework: string;
  tierAccess:            PassportTier;
  isVerified:            boolean;
  lastSyncedAt:          string | null;
  issuedAt:              string | null;
  expiresAt:             string | null;
  public:                PassportPublicTier;
  restricted:            PassportRestrictedTier | null;
  verification:          PassportVerification | null;
}

export interface PassportResponse {
  hasPassport: boolean;
  serial?:     string;
  message?:    string;
  // present when hasPassport = true
  id?:                    string;
  batteryId?:             string;
  passportUniqueId?:      string;
  passportQrUrl?:         string | null;
  dataExchangeFramework?: string;
  tierAccess?:            PassportTier;
  isVerified?:            boolean;
  lastSyncedAt?:          string | null;
  issuedAt?:              string | null;
  expiresAt?:             string | null;
  public?:                PassportPublicTier;
  restricted?:            PassportRestrictedTier | null;
  verification?:          PassportVerification | null;
}

export async function getBatteryPassport(serial: string): Promise<PassportResponse> {
  try {
    return await apiFetch<PassportResponse>(`/v1/passport/battery/${serial}`);
  } catch {
    return { hasPassport: false, serial, message: 'Could not fetch passport data' };
  }
}

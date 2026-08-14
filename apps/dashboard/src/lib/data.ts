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

interface ResidualValueEstimate {
  batteryResidualValueUsd: number;
  vehicleMarketValueUsd: number;
  batteryValuePctOfVehicle: number;
  residualAt12MonthsUsd: number;
  residualAt24MonthsUsd: number;
  residualAt36MonthsUsd: number;
  residualAt60MonthsUsd: number;
  sohSourceUsed?: string;              // PASSPORT | TELEMETRY | BLENDED | NONE | PROXY
  verificationUpliftUsd?: number | null;
  dataLessBatteryResidualValueUsd?: number | null;
}

export type Provenance = 'REAL_ANCHORED' | 'SIMULATED_CALIBRATED' | 'ILLUSTRATIVE';

interface Battery {
  id: string;
  serialNumber: string;
  vin?: string | null;
  chemistry: string;
  nominalCapacityKwh: number;
  status: string;
  manufacturedAt?: string | null;
  lastTelemetryAt?: string | null;
  provenance?: Provenance;
  batteryModel: BatteryModel;
  riskScores: RiskScore[];
}

// ── Fleet overview ─────────────────────────────────────────────────────────────

export async function getFleetStats() {
  try {
    return await apiFetch<{
      total: number;
      gradeCounts: Record<string, number>;
      statusCounts: Record<string, number>;
      recentlyScored: number;
    }>('/v1/batteries/fleet/stats');
  } catch {
    return { total: 0, gradeCounts: {}, statusCounts: {}, recentlyScored: 0 };
  }
}

// ── Battery list (with latest risk score) ─────────────────────────────────────

export async function getBatteryList(page = 1, pageSize = 20, grade?: string) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(grade ? { grade } : {}),
  });
  try {
    return await apiFetch<{ batteries: Battery[]; total: number; pages: number }>(
      `/v1/batteries/fleet/batteries?${params}`
    );
  } catch {
    return { batteries: [], total: 0, pages: 0 };
  }
}

// ── Single battery detail ─────────────────────────────────────────────────────

export async function getBatteryDetail(serialNumber: string) {
  try {
    return await apiFetch<Battery & {
      residualValues: ResidualValueEstimate[];
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
  try {
    return await apiFetch<Array<{
      recordedAt: string;
      stateOfHealth: number;
      cellTempMax: number;
      stateOfCharge: number;
    }>>(`/v1/batteries/${batteryId}/telemetry?weeks=${weeks}`);
  } catch {
    return [];
  }
}

// ── Flagged batteries (need attention) ────────────────────────────────────────

export async function getFlaggedBatteries() {
  try {
    return await apiFetch<Battery[]>('/v1/batteries/fleet/flagged');
  } catch {
    return [];
  }
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
  restrictedAccessStatus?: 'GRANTED' | 'PENDING_LEGITIMATE_INTEREST' | null;
  priorPassportId?:       string | null;
  verification?:          PassportVerification | null;
}

export async function getBatteryPassport(serial: string): Promise<PassportResponse> {
  try {
    return await apiFetch<PassportResponse>(`/v1/passport/battery/${serial}`);
  } catch {
    return { hasPassport: false, serial, message: 'Could not fetch passport data' };
  }
}

// ── Validation section (WS-G) ───────────────────────────────────────────────────

export interface ValidationDocumentSummary {
  id: string;
  title: string;
  workstream: string;
  summary: string;
}

export interface ValidationDocumentContent {
  id: string;
  title: string;
  workstream: string;
  content: string;
}

export interface PortfolioSimLatest {
  id: string;
  runAt: string;
  methodologyVersion: string;
  nLoans: number;
  seed: number;
  provenance: Provenance;
  withNetLossUsd: number;
  withoutNetLossUsd: number;
  lossDeltaUsd: number;
  withLgdPct: number;
  withoutLgdPct: number;
  portfolioSimUiUrl: string;
}

export interface ErrorStats {
  n: number;
  maeLossPctPer100Cycles: number;
  rmseLossPctPer100Cycles: number;
  maeRulCycles: number;
  rmseRulCycles: number;
}

export interface SohRulChartData {
  generatedAt: string;
  overallByChemistry: Record<string, ErrorStats>;
}

export interface RvBacktestRow {
  period: string;
  releaseLabel: string;
  modeledIndexLevel: number;
  modeledPctChangeFromPrev: number | null;
  realEvIndexPctYoY: number | null;
  realEvIndexPctMoM: number | null;
  directionAgreement: 'AGREE' | 'DISAGREE' | 'N/A';
}

export interface RvBacktestChartData {
  rows: RvBacktestRow[];
}

export async function getValidationDocuments() {
  try {
    return await apiFetch<{ documents: ValidationDocumentSummary[] }>('/v1/validation/documents');
  } catch {
    return { documents: [] };
  }
}

export async function getValidationDocumentContent(id: string) {
  try {
    return await apiFetch<ValidationDocumentContent>(`/v1/validation/documents/${id}`);
  } catch {
    return null;
  }
}

export async function getPortfolioSimLatest() {
  try {
    return await apiFetch<PortfolioSimLatest>('/v1/validation/portfolio-sim-latest');
  } catch {
    return null;
  }
}

export async function getSohRulChart() {
  try {
    return await apiFetch<SohRulChartData>('/v1/validation/charts/soh-rul');
  } catch {
    return null;
  }
}

export async function getRvBacktestChart() {
  try {
    return await apiFetch<RvBacktestChartData>('/v1/validation/charts/rv-backtest');
  } catch {
    return null;
  }
}

/**
 * Typed client for VoltLedger's public /v1/* API — called exactly as an
 * external lender's LOS would call it: over HTTP, with an X-Api-Key header.
 * Never imports @voltledger/db or @voltledger/scoring directly; that would
 * defeat the point of this app, which is to validate the real API contract.
 *
 * Every call returns {request, response} so the UI can render the raw
 * exchange (spec's "API request/response is inspectable" requirement).
 */

const API_URL = process.env.VOLTLEDGER_API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.VOLTLEDGER_API_KEY ?? '';

export type ApiTrace<T> =
  | { request: { method: string; url: string; body?: unknown }; response: { status: number; body: T }; ok: true }
  | { request: { method: string; url: string; body?: unknown }; response: { status: number; body: { error: string } | unknown }; ok: false };

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiTrace<T>> {
  const url = `${API_URL}${path}`;
  const request = { method, url, body };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'X-Api-Key': API_KEY,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    // Network failure (API unreachable, DNS, refused connection, etc.) —
    // a real external lender's LOS has to handle this too; surface it as a
    // trace, not a crash.
    const message = e instanceof Error ? e.message : 'Network request failed';
    return { request, response: { status: 0, body: { error: `Could not reach VoltLedger API: ${message}` } }, ok: false };
  }

  let responseBody: unknown;
  try {
    responseBody = await res.json();
  } catch {
    responseBody = { error: `Non-JSON response (status ${res.status})` };
  }

  if (res.ok) {
    return { request, response: { status: res.status, body: responseBody as T }, ok: true };
  }
  return { request, response: { status: res.status, body: responseBody }, ok: false };
}

// ── Response shapes (mirrors apps/api/src/routes/*.ts) ────────────────────────

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface BatteryLookupResult {
  id: string;
  serialNumber: string;
  vin?: string | null;
  chemistry: string;
  nominalCapacityKwh: number;
  status: string;
  batteryModel?: { manufacturer: string; modelName: string };
  riskScores?: Array<{ compositeScore: number; grade: RiskGrade }>;
}

export type Provenance = 'REAL_ANCHORED' | 'SIMULATED_CALIBRATED' | 'ILLUSTRATIVE';

export interface RiskResponse {
  batteryId: string;
  serialNumber: string;
  scoredAt: string;
  modelVersion: string;
  provenance: Provenance;
  compositeScore: number;
  grade: RiskGrade;
  confidenceLevel: number;
  subScores: {
    degradation: number;
    thermal: number;
    usagePattern: number;
    capacityRetention: number;
    ageAdjusted: number;
  };
  flags: {
    abnormalDegradation: boolean;
    thermalAnomalyDetected: boolean;
    highDcfcUsage: boolean;
    deepDischargeHistory: boolean;
  };
}

export interface LtvResponse {
  batteryId: string;
  serialNumber: string;
  generatedAt: string;
  provenance: Provenance;
  recommendation: {
    recommendedLtvPct: number;
    maxLtvPct: number;
    maxLoanAmountUsd: number;
    adjustedResidualUsd: number;
    grade: RiskGrade;
    rationale: string;
  };
  pricing: {
    baseRateBps: number;
    riskPremiumBps: number;
    totalRateBps: number;
    totalRatePct: number;
  };
  flagged: boolean;
}

export interface ResidualValueResponse {
  batteryId: string;
  serialNumber: string;
  estimatedAt: string;
  provenance: Provenance;
  current: {
    vehicleMarketValueUsd: number;
    batteryResidualValueUsd: number;
    batteryValuePctOfVehicle: number;
    confidenceLow: number;
    confidenceHigh: number;
  };
  forecast: Record<string, unknown>;
}

export interface AttestResponse {
  auditId: string;
  batteryId: string;
  batterySerial: string;
  passportPresent: boolean;
  passportTier: string | null;
  passportVerified: boolean;
  sohSource: string;
  sohUsedPct: number | null;
  compositeScore: number | null;
  riskGrade: RiskGrade | null;
  attestationText: string;
  provenance: Provenance;
  checkedAt: string;
}

// ── Calls ──────────────────────────────────────────────────────────────────────

export function lookupBattery(query: { vin?: string; serial?: string }) {
  const params = new URLSearchParams();
  if (query.vin) params.set('vin', query.vin);
  if (query.serial) params.set('id', query.serial);
  return call<BatteryLookupResult>('GET', `/v1/batteries/lookup?${params}`);
}

export function getRisk(serial: string) {
  return call<RiskResponse>('GET', `/v1/batteries/${encodeURIComponent(serial)}/risk`);
}

export function getLtv(serial: string) {
  return call<LtvResponse>('GET', `/v1/batteries/${encodeURIComponent(serial)}/ltv`);
}

export function getResidualValue(serial: string) {
  return call<ResidualValueResponse>('GET', `/v1/batteries/${encodeURIComponent(serial)}/residual-value`);
}

export function attestOrigination(body: { batterySerial: string; vehicleValueUsd?: number }) {
  return call<AttestResponse>('POST', '/v1/origination/attest', body);
}

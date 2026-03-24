/**
 * API request/response envelope types for VoltLedger public API
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    requestId: string;
    processingMs: number;
    modelVersion?: string;
    certificateHash?: string;   // Polygon L2 notarization hash
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}

// --- Residual Value API ---
export interface ResidualValueRequest {
  vin: string;
  telemetrySnapshot?: {
    stateOfHealth: number;
    cycleCount: number;
    odometer?: number;
    recordedAt: string;
  };
  vehiclePurchasePriceUsd?: number;
  marketRegion?: 'US' | 'CA';
}

// --- LTV Recommendation API ---
export interface LtvRequest {
  vin: string;
  requestedLoanAmountUsd: number;
  vehiclePurchasePriceUsd: number;
  loanTermMonths: 24 | 36 | 48 | 60 | 72 | 84;
  borrowerCreditScore?: number;
}

// --- Second Life Viability API ---
export interface SecondLifeRequest {
  vin: string;
  intendedUseCase?: string;
  requiredRemainingLifeYears?: number;
}

// --- Battery Ingestion ---
export interface TelemetryIngestRequest {
  vin: string;
  source: string;
  recordedAt: string;
  readings: {
    stateOfHealth?: number;
    stateOfCharge?: number;
    fullChargeCapacityKwh?: number;
    cycleCount?: number;
    cellTempMin?: number;
    cellTempMax?: number;
    odometer?: number;
    [key: string]: unknown;
  };
}

export interface WebhookEvent {
  eventType: WebhookEventType;
  lenderId: string;
  batteryId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  signature: string;  // HMAC-SHA256
}

export type WebhookEventType =
  | 'risk.grade_changed'
  | 'risk.flagged'
  | 'soh.threshold_crossed'
  | 'valuation.updated'
  | 'second_life.eligible';

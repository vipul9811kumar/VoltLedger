const API_URL       = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN ?? '';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'x-service-token': SERVICE_TOKEN },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface SoHBucket {
  label: string;
  count: number;
  ready: boolean;
}

export interface FleetOpsStats {
  total:          number;
  shiftReady:     number;
  limitedRange:   number;
  grounded:       number;
  shiftReadyPct:  number;
  avgSoH:         number;
  alerts: {
    thermal:             number;
    dcfc:                number;
    abnormalDegradation: number;
    total:               number;
  };
  replacementQueue: {
    days30:           number;
    days60:           number;
    days90:           number;
    estimatedCostUsd: number;
  };
  sohBuckets: SoHBucket[];
}

export async function getFleetOpsStats(): Promise<FleetOpsStats> {
  return apiFetch<FleetOpsStats>('/v1/fleet/ops/stats');
}

// ── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertBattery {
  batteryId:       string;
  serialNumber:    string;
  manufacturer:    string;
  modelName:       string;
  chemistry:       string;
  lastTelemetryAt: string | null;
  scoredAt:        string;
  compositeScore:  number;
  flags: {
    thermal:     boolean;
    dcfc:        boolean;
    degradation: boolean;
  };
}

export interface FleetOpsAlerts {
  counts: {
    thermal:     number;
    dcfc:        number;
    degradation: number;
    total:       number;
  };
  alerts: AlertBattery[];
}

export async function getFleetOpsAlerts(type?: string): Promise<FleetOpsAlerts> {
  const qs = type ? `?type=${type}` : '';
  return apiFetch<FleetOpsAlerts>(`/v1/fleet/ops/alerts${qs}`);
}

// ── Replacement queue ─────────────────────────────────────────────────────────

export interface ReplacementBattery {
  batteryId:          string;
  serialNumber:       string;
  manufacturer:       string;
  modelName:          string;
  chemistry:          string;
  currentSoH:         number;
  projectedDate80Pct: string;
  daysUntil:          number;
  confidenceLevel:    string;
  estimatedCostUsd:   number;
}

export interface FleetOpsReplace {
  summary: {
    immediate:        number;
    days30:           number;
    days60:           number;
    days90:           number;
    totalForecast:    number;
    estimatedCostUsd: number;
  };
  upcoming: ReplacementBattery[];
}

export async function getFleetOpsReplace(): Promise<FleetOpsReplace> {
  return apiFetch<FleetOpsReplace>('/v1/fleet/ops/replace');
}

// ── Second life ───────────────────────────────────────────────────────────────

export interface SecondLifeBattery {
  batteryId:                   string;
  serialNumber:                string;
  manufacturer:                string;
  modelName:                   string;
  chemistry:                   string;
  currentSoH:                  number;
  viabilityScore:              number;
  recommendedUseCase:          string | null;
  estimatedRemainingLifeYears: number | null;
  estimatedSecondLifeValueUsd: number;
  recyclerValueUsd:            number;
}

export interface FleetOpsSecondLife {
  summary: {
    viable:           number;
    nonViable:        number;
    totalEstValueUsd: number;
    recyclerValueUsd: number;
    useCaseBreakdown: Record<string, number>;
  };
  candidates: SecondLifeBattery[];
}

export async function getFleetOpsSecondLife(): Promise<FleetOpsSecondLife> {
  return apiFetch<FleetOpsSecondLife>('/v1/fleet/ops/second-life');
}

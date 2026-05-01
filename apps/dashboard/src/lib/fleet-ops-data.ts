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

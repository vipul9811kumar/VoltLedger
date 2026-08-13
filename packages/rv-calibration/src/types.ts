export interface ManheimIndexPoint {
  period: string;                    // e.g. "2026-05", "2026-06-mid"
  releaseLabel: string;
  evIndexPctYoY: number | null;
  evIndexPctMoM: number | null;
  nonEvIndexPctYoY?: number | null;
  nonEvIndexPctMoM?: number | null;
  overallMuvviLevel?: number | null;
  overallMuvviPctMoM?: number | null;
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt: string;
  notes?: string | null;
}

export interface AutovistaRetentionPoint {
  market: string;
  ageYears: number;
  mileageKm: number;
  pctRetention: number;
  sourceUrl: string;
  sourceTitle: string;
  observedPeriod: string;
  retrievedAt: string;
}

export interface ImpliedRetentionRow {
  chemistry: string;
  expectedSoHAt3yr: number;
  sohFactor3yr: number;
  marketDepreciationRate: number;
  marketFactor3yr: number;
  impliedBatteryRetentionPct3yr: number;
}

export interface CalibrationResult {
  impliedRetention: ImpliedRetentionRow[];
  autovistaBandLowPct: number;
  autovistaBandHighPct: number;
  autovistaPoints: AutovistaRetentionPoint[];
}

export interface BacktestMonthRow {
  period: string;
  releaseLabel: string;
  modeledIndexLevel: number;
  modeledPctChangeFromPrev: number | null;
  realEvIndexPctYoY: number | null;
  realEvIndexPctMoM: number | null;
  directionAgreement: 'AGREE' | 'DISAGREE' | 'N/A';
}

export interface BacktestResult {
  rows: BacktestMonthRow[];
  manheimPoints: ManheimIndexPoint[];
}

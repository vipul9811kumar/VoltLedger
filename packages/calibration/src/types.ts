export interface CapacityFadePoint {
  cellId: string;
  ambientTempC: number;
  cycleIndex: number;
  elapsedDays: number;
  dischargeCurrentA: number;
  capacityAhr: number;
  initialCapacityAhr: number;
  sohPct: number;
}

export interface CellMeta {
  cellId: string;
  ambientTempC: number;
  nDischargeCycles: number;
  nDroppedCycles: number;
  initialCapacityAhr: number;
  finalCapacityAhr: number;
  finalSohPct: number;
  totalElapsedDays: number;
  batchNote: string;
}

export interface CapacityFadeDataset {
  source: string;
  sourceUrl: string;
  citation: string;
  chemistry: string;
  cells: CellMeta[];
  points: CapacityFadePoint[];
}

export interface DatasetSplit {
  trainCellIds: string[];
  holdoutCellIds: string[];
}

/** Per-cell degradation rate derived from a linear fit of SoH% vs. cycle index. */
export interface CellFadeRate {
  cellId: string;
  ambientTempC: number;
  lossPctPer100Cycles: number;
  nPoints: number;
  rSquared: number;
}

export interface ThermalSensitivityFit {
  /** Loss %/100 cycles at the fit's reference temperature (24C — NASA's room-temp batches). */
  referenceLossPctPer100Cycles: number;
  referenceTempC: number;
  /** Slope: additional loss %/100 cycles per degree C away from 24C. */
  thermalSlopePctPer100CyclesPerDegC: number;
  rSquared: number;
  nCellsUsed: number;
}

export interface HoldoutValidation {
  nHoldoutCells: number;
  nHoldoutCellsExcludedLowRSquared: number;
  maeLossPctPer100Cycles: number;
  rmseLossPctPer100Cycles: number;
}

/**
 * Output of fitting against NASA PCoE cycling data. Deliberately NOT shaped
 * like `ChemistryParams` from tools/synthetic-generator — this dataset only
 * supports two of that interface's parameters (cycle-loss rate and thermal
 * sensitivity), both expressed per-100-cycles, not per-year. See the data
 * card for what this can and cannot calibrate, and why.
 */
export interface NasaPcoeCalibration {
  modelVersion: string;
  generatedAt: string;
  fit: ThermalSensitivityFit;
  holdoutValidation: HoldoutValidation;
  perCellFadeRates: CellFadeRate[];
}

// ── CALCE (second, independent cross-check source — see convert_calce_xlsx.py) ──

export interface CalcePoint {
  cellId: string;
  family: 'CS2' | 'CX2';
  protocol: string;
  cycleIndex: number;
  elapsedDays: number;
  capacityAhr: number;
  initialCapacityAhr: number;
  sohPct: number;
}

export interface CalceCellMeta {
  cellId: string;
  family: 'CS2' | 'CX2';
  protocol: string;
  ratedCapacityAh: number;
  nCycles: number;
  nDroppedCycles: number;
  nSourceFiles: number;
  initialCapacityAhr: number;
  finalCapacityAhr: number;
  finalSohPct: number;
  totalElapsedDays: number;
}

export interface CalceDataset {
  source: string;
  sourceUrl: string;
  citation: string;
  chemistry: string;
  ambientTempNote: string;
  cells: CalceCellMeta[];
  points: CalcePoint[];
}

/** Cross-check of the NASA-derived room-temp reference rate against CALCE's independent cells. */
export interface CrossCheckResult {
  generatedAt: string;
  nasaReferenceLossPctPer100Cycles: number;
  nasaReferenceTempC: number;
  calceCellRates: CellFadeRate[]; // ambientTempC is a NaN sentinel here — CALCE temp is undocumented
  calceMedianLossPctPer100Cycles: number;
  calceMeanLossPctPer100Cycles: number;
  nCalceCellsUsed: number;
  ratioCalceToNasa: number;
}

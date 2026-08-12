import type {
  CapacityFadeDataset,
  CellFadeRate,
  DatasetSplit,
  HoldoutValidation,
  NasaPcoeCalibration,
  ThermalSensitivityFit,
} from './types';

const REFERENCE_TEMP_C = 24; // NASA's "room temperature" batches

/** Closed-form OLS: y = a + b*x. Returns slope, intercept, R^2. */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, rSquared };
}

/** Per-cell SoH-vs-cycle slope, converted to a positive loss-per-100-cycles rate. */
function fitCellFadeRates(dataset: CapacityFadeDataset, cellIds: string[]): CellFadeRate[] {
  const byCell = new Map<string, { cycle: number; soh: number }[]>();
  for (const p of dataset.points) {
    if (!cellIds.includes(p.cellId)) continue;
    if (!byCell.has(p.cellId)) byCell.set(p.cellId, []);
    byCell.get(p.cellId)!.push({ cycle: p.cycleIndex, soh: p.sohPct });
  }

  const rates: CellFadeRate[] = [];
  for (const [cellId, pts] of byCell) {
    if (pts.length < 3) continue; // too few points for a meaningful slope
    const { slope, rSquared } = linearRegression(pts.map((p) => p.cycle), pts.map((p) => p.soh));
    const cell = dataset.cells.find((c) => c.cellId === cellId)!;
    rates.push({
      cellId,
      ambientTempC: cell.ambientTempC,
      lossPctPer100Cycles: Math.max(0, -slope * 100),
      nPoints: pts.length,
      rSquared,
    });
  }
  return rates;
}

// Objective, uniformly-applied quality gate for the GROUP fit only (the
// per-cell table always reports every cell, gated or not — nothing is
// hidden). R^2 < 0.5 means the per-cell linear slope itself isn't reliably
// estimated (over half the cycle-to-cycle variance is unexplained); feeding
// an unreliable slope into the group regression would corrupt it. This
// concentrates in NASA's own flagged batches (41-56, "capacity was very low
// ... not fully analyzed" / "control software crashed") — that's the gate
// corroborating NASA's caveat, not a threshold picked to fit a narrative.
const MIN_CELL_FIT_R_SQUARED = 0.5;

function fitThermalSensitivity(cellRates: CellFadeRate[]): ThermalSensitivityFit {
  const reliable = cellRates.filter((r) => r.rSquared >= MIN_CELL_FIT_R_SQUARED);
  const { slope, intercept, rSquared } = linearRegression(
    reliable.map((r) => r.ambientTempC),
    reliable.map((r) => r.lossPctPer100Cycles),
  );
  return {
    referenceLossPctPer100Cycles: intercept + slope * REFERENCE_TEMP_C,
    referenceTempC: REFERENCE_TEMP_C,
    thermalSlopePctPer100CyclesPerDegC: slope,
    rSquared,
    nCellsUsed: reliable.length,
  };
}

function validateAgainstHoldout(fit: ThermalSensitivityFit, holdoutRates: CellFadeRate[]): HoldoutValidation {
  // Same objective reliability gate as training (R^2 >= 0.5), applied
  // uniformly — comparing predictions against an unreliably-estimated
  // ground-truth slope wouldn't tell you anything about the model either.
  const reliable = holdoutRates.filter((r) => r.rSquared >= MIN_CELL_FIT_R_SQUARED);
  const errors = reliable.map((r) => {
    const predicted =
      fit.referenceLossPctPer100Cycles +
      fit.thermalSlopePctPer100CyclesPerDegC * (r.ambientTempC - fit.referenceTempC);
    return predicted - r.lossPctPer100Cycles;
  });
  const mae = errors.reduce((a, b) => a + Math.abs(b), 0) / (errors.length || 1);
  const rmse = Math.sqrt(errors.reduce((a, b) => a + b ** 2, 0) / (errors.length || 1));
  return {
    nHoldoutCells: reliable.length,
    nHoldoutCellsExcludedLowRSquared: holdoutRates.length - reliable.length,
    maeLossPctPer100Cycles: mae,
    rmseLossPctPer100Cycles: rmse,
  };
}

export function fitNasaPcoeCalibration(
  dataset: CapacityFadeDataset,
  split: DatasetSplit,
): NasaPcoeCalibration {
  const trainRates = fitCellFadeRates(dataset, split.trainCellIds);
  const holdoutRates = fitCellFadeRates(dataset, split.holdoutCellIds);

  const fit = fitThermalSensitivity(trainRates);
  const holdoutValidation = validateAgainstHoldout(fit, holdoutRates);

  return {
    modelVersion: '0.1.0-nasa-pcoe',
    generatedAt: new Date().toISOString(),
    fit,
    holdoutValidation,
    perCellFadeRates: [...trainRates, ...holdoutRates].sort((a, b) => a.cellId.localeCompare(b.cellId)),
  };
}

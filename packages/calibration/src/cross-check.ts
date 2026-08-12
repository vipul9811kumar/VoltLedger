import type { CalceDataset, CellFadeRate, CrossCheckResult } from './types';
import { linearRegression, MIN_CELL_FIT_R_SQUARED } from './fit';

/**
 * Independent cross-check: does CALCE's CS2/CX2 (LCO, room temp, different
 * lab / cell design / years) show a similar room-temperature cycle-loss
 * rate to NASA PCoE's (also LCO)? Same chemistry, same physical quantity,
 * two unrelated sources — agreement is a real (if modest) integrity signal;
 * disagreement would be a real problem to flag, not paper over. This is
 * NOT a fit against CALCE data and does not change chemistry-params.
 * calibrated.json — see DATA_CARD.md's cross-check section.
 */
export function crossCheckAgainstNasa(
  calce: CalceDataset,
  nasaReferenceLossPctPer100Cycles: number,
  nasaReferenceTempC: number,
): CrossCheckResult {
  const byCell = new Map<string, { cycle: number; soh: number }[]>();
  for (const p of calce.points) {
    if (!byCell.has(p.cellId)) byCell.set(p.cellId, []);
    byCell.get(p.cellId)!.push({ cycle: p.cycleIndex, soh: p.sohPct });
  }

  const rates: CellFadeRate[] = [];
  for (const [cellId, pts] of byCell) {
    if (pts.length < 3) continue;
    const { slope, rSquared } = linearRegression(pts.map((p) => p.cycle), pts.map((p) => p.soh));
    rates.push({
      cellId,
      ambientTempC: NaN, // CALCE doesn't document a controlled ambient for these cells
      lossPctPer100Cycles: Math.max(0, -slope * 100),
      nPoints: pts.length,
      rSquared,
    });
  }

  const reliable = rates.filter((r) => r.rSquared >= MIN_CELL_FIT_R_SQUARED);
  const values = reliable.map((r) => r.lossPctPer100Cycles).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : NaN;
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

  return {
    generatedAt: new Date().toISOString(),
    nasaReferenceLossPctPer100Cycles,
    nasaReferenceTempC,
    calceCellRates: rates.sort((a, b) => a.cellId.localeCompare(b.cellId)),
    calceMedianLossPctPer100Cycles: median,
    calceMeanLossPctPer100Cycles: mean,
    nCalceCellsUsed: reliable.length,
    ratioCalceToNasa: mean / nasaReferenceLossPctPer100Cycles,
  };
}

import {
  loadNasaPcoeDataset,
  loadCalceDataset,
  splitDataset,
  fitNasaPcoeCalibration,
  crossCheckAgainstNasa,
  MIN_CELL_FIT_R_SQUARED,
  type CellFadeRate,
} from '@voltledger/calibration';
import { CHEMISTRY_PARAMS, type Chemistry } from '@voltledger/synthetic-generator';

const CHEMISTRIES: Chemistry[] = ['LFP', 'NMC', 'NCA'];

// 80% SoH is the standard EV-industry end-of-life threshold. No RUL estimator
// exists anywhere in packages/scoring — this is a derived proxy, computed
// identically for the real cells and for the model, not pulled from
// production code.
const EOL_SOH_THRESHOLD_PCT = 80;

function cyclesToEol(lossPctPer100Cycles: number): number {
  if (lossPctPer100Cycles <= 0) return Infinity;
  return ((100 - EOL_SOH_THRESHOLD_PCT) / lossPctPer100Cycles) * 100;
}

export interface CellComparisonRow {
  source: 'NASA' | 'CALCE';
  cellId: string;
  ambientTempC: number | null; // null where undocumented (CALCE)
  realLossPctPer100Cycles: number;
  realRSquared: number;
  realRulCycles: number;
  perChemistry: Record<
    Chemistry,
    {
      modelLossPctPer100Cycles: number;
      modelRulCycles: number;
      errorLossPctPer100Cycles: number; // model - real
      errorRulCycles: number; // model - real
    }
  >;
}

export interface ErrorStats {
  n: number;
  maeLossPctPer100Cycles: number;
  rmseLossPctPer100Cycles: number;
  maeRulCycles: number;
  rmseRulCycles: number;
}

export interface ValidationResult {
  generatedAt: string;
  rows: CellComparisonRow[];
  overallByChemistry: Record<Chemistry, ErrorStats>;
  byTempBandByChemistry: Record<string, Record<Chemistry, ErrorStats>>; // NASA only (CALCE temp undocumented)
  bySourceByChemistry: Record<'NASA' | 'CALCE', Record<Chemistry, ErrorStats>>;
}

function computeStats(rows: CellComparisonRow[], chem: Chemistry): ErrorStats {
  const lossErrors = rows.map((r) => r.perChemistry[chem].errorLossPctPer100Cycles);
  const rulErrors = rows.map((r) => r.perChemistry[chem].errorRulCycles).filter((e) => Number.isFinite(e));

  const mae = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length : NaN);
  const rmse = (xs: number[]) => (xs.length ? Math.sqrt(xs.reduce((a, b) => a + b ** 2, 0) / xs.length) : NaN);

  return {
    n: rows.length,
    maeLossPctPer100Cycles: mae(lossErrors),
    rmseLossPctPer100Cycles: rmse(lossErrors),
    maeRulCycles: mae(rulErrors),
    rmseRulCycles: rmse(rulErrors),
  };
}

function groupStats(rows: CellComparisonRow[]): Record<Chemistry, ErrorStats> {
  return Object.fromEntries(CHEMISTRIES.map((c) => [c, computeStats(rows, c)])) as Record<Chemistry, ErrorStats>;
}

export function runValidation(): ValidationResult {
  // ── NASA: reuse WS-A's fit, apply the same reliability gate uniformly ──
  const nasaDataset = loadNasaPcoeDataset();
  const nasaSplit = splitDataset(nasaDataset);
  const nasaCalibration = fitNasaPcoeCalibration(nasaDataset, nasaSplit);
  const nasaRates: CellFadeRate[] = nasaCalibration.perCellFadeRates.filter(
    (r) => r.rSquared >= MIN_CELL_FIT_R_SQUARED,
  );

  // ── CALCE: reuse WS-A's cross-check, apply the same gate ──
  const calceDataset = loadCalceDataset();
  const calceCrossCheck = crossCheckAgainstNasa(
    calceDataset,
    nasaCalibration.fit.referenceLossPctPer100Cycles,
    nasaCalibration.fit.referenceTempC,
  );
  const calceRates: CellFadeRate[] = calceCrossCheck.calceCellRates.filter(
    (r) => r.rSquared >= MIN_CELL_FIT_R_SQUARED,
  );

  function toRow(source: 'NASA' | 'CALCE', r: CellFadeRate): CellComparisonRow {
    const realRul = cyclesToEol(r.lossPctPer100Cycles);
    const perChemistry = Object.fromEntries(
      CHEMISTRIES.map((chem) => {
        const modelLoss = CHEMISTRY_PARAMS[chem].cycleLossPctPer100Cycles;
        const modelRul = cyclesToEol(modelLoss);
        return [
          chem,
          {
            modelLossPctPer100Cycles: modelLoss,
            modelRulCycles: modelRul,
            errorLossPctPer100Cycles: modelLoss - r.lossPctPer100Cycles,
            errorRulCycles: Number.isFinite(modelRul) && Number.isFinite(realRul) ? modelRul - realRul : NaN,
          },
        ];
      }),
    ) as CellComparisonRow['perChemistry'];

    return {
      source,
      cellId: r.cellId,
      ambientTempC: source === 'NASA' ? r.ambientTempC : null,
      realLossPctPer100Cycles: r.lossPctPer100Cycles,
      realRSquared: r.rSquared,
      realRulCycles: realRul,
      perChemistry,
    };
  }

  const rows: CellComparisonRow[] = [
    ...nasaRates.map((r) => toRow('NASA', r)),
    ...calceRates.map((r) => toRow('CALCE', r)),
  ];

  const overallByChemistry = groupStats(rows);

  const tempBands = [...new Set(rows.filter((r) => r.ambientTempC !== null).map((r) => r.ambientTempC))].sort(
    (a, b) => (a as number) - (b as number),
  );
  const byTempBandByChemistry: Record<string, Record<Chemistry, ErrorStats>> = {};
  for (const t of tempBands) {
    byTempBandByChemistry[`${t}C`] = groupStats(rows.filter((r) => r.ambientTempC === t));
  }

  const bySourceByChemistry = {
    NASA: groupStats(rows.filter((r) => r.source === 'NASA')),
    CALCE: groupStats(rows.filter((r) => r.source === 'CALCE')),
  };

  return {
    generatedAt: new Date().toISOString(),
    rows,
    overallByChemistry,
    byTempBandByChemistry,
    bySourceByChemistry,
  };
}
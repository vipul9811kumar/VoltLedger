import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNasaPcoeDataset } from './ingest';
import { splitDataset } from './split';
import { fitNasaPcoeCalibration } from './fit';
import { renderDataCard } from './data-card';
import { loadCalceDataset } from './calce-ingest';
import { crossCheckAgainstNasa } from './cross-check';
import { renderCrossCheckReport } from './cross-check-report';

function main() {
  const dataset = loadNasaPcoeDataset();
  const split = splitDataset(dataset);
  const calibration = fitNasaPcoeCalibration(dataset, split);

  const nasaOutDir = join(__dirname, '..', 'data', 'nasa-pcoe');
  writeFileSync(
    join(nasaOutDir, 'chemistry-params.calibrated.json'),
    JSON.stringify(calibration, null, 2),
  );
  writeFileSync(join(nasaOutDir, 'holdout-cell-ids.json'), JSON.stringify(split, null, 2));
  writeFileSync(join(nasaOutDir, 'DATA_CARD.md'), renderDataCard(dataset, split, calibration));

  console.log(`NASA: ingested ${dataset.cells.length} cells, ${dataset.points.length} points.`);
  console.log(`  Train: ${split.trainCellIds.length} cells, holdout: ${split.holdoutCellIds.length} cells.`);
  console.log(
    `  Reference loss rate @ ${calibration.fit.referenceTempC}C: ` +
      `${calibration.fit.referenceLossPctPer100Cycles.toFixed(3)}%/100cyc, ` +
      `thermal slope ${calibration.fit.thermalSlopePctPer100CyclesPerDegC.toFixed(4)}%/100cyc/°C`,
  );
  console.log(
    `  Holdout MAE: ${calibration.holdoutValidation.maeLossPctPer100Cycles.toFixed(3)}%/100cyc ` +
      `(${calibration.holdoutValidation.nHoldoutCells} cells)`,
  );
  console.log(`  Wrote chemistry-params.calibrated.json, holdout-cell-ids.json, DATA_CARD.md -> ${nasaOutDir}`);

  const calce = loadCalceDataset();
  const crossCheck = crossCheckAgainstNasa(calce, calibration.fit.referenceLossPctPer100Cycles, calibration.fit.referenceTempC);
  const calceOutDir = join(__dirname, '..', 'data', 'calce');
  writeFileSync(join(calceOutDir, 'CROSS_CHECK.md'), renderCrossCheckReport(calce, crossCheck));

  console.log(
    `\nCALCE cross-check: ${crossCheck.nCalceCellsUsed} cells, ` +
      `mean ${crossCheck.calceMeanLossPctPer100Cycles.toFixed(3)}%/100cyc vs. NASA ` +
      `${crossCheck.nasaReferenceLossPctPer100Cycles.toFixed(3)}%/100cyc ` +
      `(ratio ${crossCheck.ratioCalceToNasa.toFixed(2)}x)`,
  );
  console.log(`  Wrote CROSS_CHECK.md -> ${calceOutDir}`);
}

main();

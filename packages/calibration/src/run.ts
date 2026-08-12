import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNasaPcoeDataset } from './ingest';
import { splitDataset } from './split';
import { fitNasaPcoeCalibration } from './fit';
import { renderDataCard } from './data-card';

function main() {
  const dataset = loadNasaPcoeDataset();
  const split = splitDataset(dataset);
  const calibration = fitNasaPcoeCalibration(dataset, split);

  const outDir = join(__dirname, '..', 'data', 'nasa-pcoe');
  writeFileSync(
    join(outDir, 'chemistry-params.calibrated.json'),
    JSON.stringify(calibration, null, 2),
  );
  writeFileSync(join(outDir, 'holdout-cell-ids.json'), JSON.stringify(split, null, 2));
  writeFileSync(join(outDir, 'DATA_CARD.md'), renderDataCard(dataset, split, calibration));

  console.log(`Ingested ${dataset.cells.length} cells, ${dataset.points.length} points.`);
  console.log(`Train: ${split.trainCellIds.length} cells, holdout: ${split.holdoutCellIds.length} cells.`);
  console.log(
    `Reference loss rate @ ${calibration.fit.referenceTempC}C: ` +
      `${calibration.fit.referenceLossPctPer100Cycles.toFixed(3)}%/100cyc, ` +
      `thermal slope ${calibration.fit.thermalSlopePctPer100CyclesPerDegC.toFixed(4)}%/100cyc/°C`,
  );
  console.log(
    `Holdout MAE: ${calibration.holdoutValidation.maeLossPctPer100Cycles.toFixed(3)}%/100cyc ` +
      `(${calibration.holdoutValidation.nHoldoutCells} cells)`,
  );
  console.log(`Wrote chemistry-params.calibrated.json, holdout-cell-ids.json, DATA_CARD.md -> ${outDir}`);
}

main();

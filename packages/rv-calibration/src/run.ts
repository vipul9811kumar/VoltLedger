import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCalibration } from './calibrate';
import { runBacktest } from './backtest';
import { renderCalibrationNote } from './calibration-note';
import { renderBacktestReport } from './backtest-report';

function main() {
  const calibration = runCalibration();
  const backtest = runBacktest();

  const packageDir = join(__dirname, '..');
  writeFileSync(join(packageDir, 'CALIBRATION_NOTE.md'), renderCalibrationNote(calibration));

  const docsDir = join(__dirname, '..', '..', '..', 'docs', 'validation');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'RV_MARKET_BACKTEST.md'), renderBacktestReport(backtest));

  console.log('Implied 3yr battery retention vs. Autovista whole-vehicle %RV band:');
  for (const r of calibration.impliedRetention) {
    const inBand =
      r.impliedBatteryRetentionPct3yr >= calibration.autovistaBandLowPct &&
      r.impliedBatteryRetentionPct3yr <= calibration.autovistaBandHighPct;
    console.log(
      `  ${r.chemistry}: ${r.impliedBatteryRetentionPct3yr}% (band ${calibration.autovistaBandLowPct}-${calibration.autovistaBandHighPct}%, ${inBand ? 'inside' : 'OUTSIDE — see CALIBRATION_NOTE.md'})`,
    );
  }
  console.log('No constants changed (report-only calibration, see CALIBRATION_NOTE.md).\n');

  const comparable = backtest.rows.filter((r) => r.directionAgreement !== 'N/A');
  const agree = comparable.filter((r) => r.directionAgreement === 'AGREE').length;
  console.log(`Manheim directional back-test: ${agree}/${comparable.length} comparable months agree on direction.`);

  console.log(`\nWrote packages/rv-calibration/CALIBRATION_NOTE.md`);
  console.log(`Wrote docs/validation/RV_MARKET_BACKTEST.md`);
}

main();

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { runValidation } from './compare';
import { renderValidationReport } from './report';
import { renderModelCard } from './model-card';

function main() {
  const result = runValidation();

  const docsDir = join(__dirname, '..', '..', '..', 'docs', 'validation');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'SOH_RUL_VALIDATION.md'), renderValidationReport(result));

  const scoringDir = join(__dirname, '..', '..', 'scoring');
  writeFileSync(join(scoringDir, 'MODEL_CARD.md'), renderModelCard(result));

  console.log(`Validated against ${result.rows.length} real cells (NASA + CALCE, R² >= 0.5 gate).`);
  for (const [chem, stats] of Object.entries(result.overallByChemistry)) {
    console.log(
      `  ${chem}: MAE ${stats.maeLossPctPer100Cycles.toFixed(2)}%/100cyc, ` +
        `RMSE ${stats.rmseLossPctPer100Cycles.toFixed(2)}%/100cyc, ` +
        `MAE RUL ${stats.maeRulCycles.toFixed(0)} cycles`,
    );
  }
  console.log(`\nWrote docs/validation/SOH_RUL_VALIDATION.md`);
  console.log(`Wrote packages/scoring/MODEL_CARD.md`);
}

main();

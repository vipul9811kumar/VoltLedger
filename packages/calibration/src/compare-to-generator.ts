import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHEMISTRY_PARAMS } from '@voltledger/synthetic-generator';
import type { NasaPcoeCalibration } from './types';

/**
 * Read-only comparison of tools/synthetic-generator's hand-set CHEMISTRY_PARAMS
 * against the NASA PCoE calibration — does NOT modify generator behavior.
 *
 * Why not swap the values in directly: NASA PCoE cells are 18650 LCO/graphite,
 * not chemistry-matched to any of LFP/NMC/NCA (see DATA_CARD.md). Silently
 * overwriting e.g. NMC's cycleLossPctPer100Cycles with an LCO-derived number
 * would be exactly the kind of unearned precision the build spec's §1.1
 * warns against. This prints what the generator currently assumes next to
 * what one real (if chemistry-mismatched) dataset shows, as a sanity check —
 * not a calibration.
 */
function main() {
  const raw = readFileSync(
    join(__dirname, '..', 'data', 'nasa-pcoe', 'chemistry-params.calibrated.json'),
    'utf-8',
  );
  const calibration: NasaPcoeCalibration = JSON.parse(raw);

  const nasaAt24 = calibration.fit.referenceLossPctPer100Cycles;

  const lines: string[] = [];
  lines.push('# Generator assumptions vs. NASA PCoE reference (sanity check, not a calibration)');
  lines.push('');
  lines.push(
    `NASA-derived reference (LCO cells, 24C, R²=${calibration.fit.rSquared.toFixed(2)}, ` +
      `n=${calibration.fit.nCellsUsed} cells): **${nasaAt24.toFixed(2)}% loss / 100 cycles**`,
  );
  lines.push('');
  lines.push('| Chemistry | Generator: cycleLossPctPer100Cycles | vs. NASA LCO reference |');
  lines.push('|---|---|---|');
  for (const [chem, params] of Object.entries(CHEMISTRY_PARAMS)) {
    const genValue = params.cycleLossPctPer100Cycles;
    const ratio = genValue / nasaAt24;
    lines.push(
      `| ${chem} | ${genValue.toFixed(2)} | ${ratio.toFixed(2)}x ${ratio < 1 ? '(lower than LCO ref)' : '(higher than LCO ref)'} |`,
    );
  }
  lines.push('');
  lines.push(
    'Read this as: does the generator\'s assumed cycle-fade rate sit in a plausible range next ' +
      'to one real dataset\'s rate — not as agreement or disagreement with a chemistry-matched ' +
      'ground truth, which this dataset cannot provide. See DATA_CARD.md.',
  );
  lines.push('');
  lines.push(
    '**Caveat on the ~20-50x gap above:** NASA cycled these cells back-to-back to full depth ' +
      '(80-100% DoD) with no rest, as an accelerated-aging test protocol — that is far harsher ' +
      'than a real EV\'s typical daily partial-depth cycling, which is what the generator\'s ' +
      '`cycleLossPctPer100Cycles` is meant to represent. Some of this gap is genuine signal ' +
      '(the generator may be too optimistic); some of it is comparing accelerated-test cycles ' +
      'to real-world-equivalent cycles, which are not the same unit. WS-B / a depth-of-discharge-' +
      'aware re-analysis is needed before treating this as an action item on the generator itself.',
  );

  const out = lines.join('\n') + '\n';
  const outPath = join(__dirname, '..', 'data', 'nasa-pcoe', 'GENERATOR_COMPARISON.md');
  writeFileSync(outPath, out);
  console.log(out);
  console.log(`Wrote ${outPath}`);
}

main();

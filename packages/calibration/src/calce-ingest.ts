import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CalceCellMeta, CalceDataset, CalcePoint } from './types';

const DATA_DIR = join(__dirname, '..', 'data', 'calce');

function parseCsv(text: string): CalcePoint[] {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    return {
      cellId: row.cell_id,
      family: row.family as 'CS2' | 'CX2',
      protocol: row.protocol,
      cycleIndex: Number(row.cycle_index),
      elapsedDays: Number(row.elapsed_days),
      capacityAhr: Number(row.capacity_ahr),
      initialCapacityAhr: Number(row.initial_capacity_ahr),
      sohPct: Number(row.soh_pct),
    };
  });
}

/**
 * Loads the CALCE CS2/CX2 capacity-fade dataset produced by
 * `scripts/convert_calce_xlsx.py` — a second, independent real-cell source
 * used to cross-check the NASA-derived cycle-loss rate (see cross-check.ts).
 * Raw .xlsx files (~880MB) are not committed; see the script for source and
 * how to regenerate.
 */
export function loadCalceDataset(): CalceDataset {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, 'cells.json'), 'utf-8'));
  const csvText = readFileSync(join(DATA_DIR, 'capacity_fade.csv'), 'utf-8');

  const cells: CalceCellMeta[] = raw.cells
    .filter((c: any) => !c.excluded)
    .map((c: any) => ({
      cellId: c.cell_id,
      family: c.family,
      protocol: c.protocol,
      ratedCapacityAh: c.rated_capacity_ah,
      nCycles: c.n_cycles,
      nDroppedCycles: c.n_dropped_cycles,
      nSourceFiles: c.n_source_files,
      initialCapacityAhr: c.initial_capacity_ahr,
      finalCapacityAhr: c.final_capacity_ahr,
      finalSohPct: c.final_soh_pct,
      totalElapsedDays: c.total_elapsed_days,
    }));

  return {
    source: raw.source,
    sourceUrl: raw.source_url,
    citation: raw.citation,
    chemistry: raw.chemistry,
    ambientTempNote: raw.ambient_temp_note,
    cells,
    points: parseCsv(csvText),
  };
}

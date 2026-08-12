import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CapacityFadeDataset, CapacityFadePoint, CellMeta } from './types';

const DATA_DIR = join(__dirname, '..', 'data', 'nasa-pcoe');

function parseCsv(text: string): CapacityFadePoint[] {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i]));
    return {
      cellId: row.cell_id,
      ambientTempC: Number(row.ambient_temp_c),
      cycleIndex: Number(row.cycle_index),
      elapsedDays: Number(row.elapsed_days),
      dischargeCurrentA: Number(row.discharge_current_a),
      capacityAhr: Number(row.capacity_ahr),
      initialCapacityAhr: Number(row.initial_capacity_ahr),
      sohPct: Number(row.soh_pct),
    };
  });
}

/**
 * Loads the NASA PCoE capacity-fade dataset produced by
 * `scripts/convert_nasa_mat.py` (checked-in CSV/JSON — the raw ~190MB of
 * .mat files are not committed; see scripts/convert_nasa_mat.py for the
 * source and how to regenerate).
 */
export function loadNasaPcoeDataset(): CapacityFadeDataset {
  const cellsRaw = JSON.parse(readFileSync(join(DATA_DIR, 'cells.json'), 'utf-8'));
  const csvText = readFileSync(join(DATA_DIR, 'capacity_fade.csv'), 'utf-8');

  const cells: CellMeta[] = cellsRaw.cells
    .filter((c: any) => !c.excluded)
    .map((c: any) => ({
      cellId: c.cell_id,
      ambientTempC: c.ambient_temp_c,
      nDischargeCycles: c.n_discharge_cycles,
      nDroppedCycles: c.n_dropped_cycles,
      initialCapacityAhr: c.initial_capacity_ahr,
      finalCapacityAhr: c.final_capacity_ahr,
      finalSohPct: c.final_soh_pct,
      totalElapsedDays: c.total_elapsed_days,
      batchNote: c.batch_note,
    }));

  return {
    source: cellsRaw.source,
    sourceUrl: cellsRaw.source_url,
    citation: cellsRaw.citation,
    chemistry: cellsRaw.chemistry,
    cells,
    points: parseCsv(csvText),
  };
}

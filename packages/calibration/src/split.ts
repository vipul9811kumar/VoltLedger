import type { CapacityFadeDataset, DatasetSplit } from './types';

/**
 * Deterministic train/holdout split, by CELL (not by point) — splitting
 * individual cycle rows would leak a cell's own curve into both sets. ~25%
 * of cells, evenly spread by taking every 4th cell from an id-sorted list,
 * held out.
 */
export function splitDataset(dataset: CapacityFadeDataset): DatasetSplit {
  const ids = [...dataset.cells.map((c) => c.cellId)].sort();
  const holdoutCellIds: string[] = [];
  const trainCellIds: string[] = [];
  ids.forEach((id, i) => {
    if (i % 4 === 0) holdoutCellIds.push(id);
    else trainCellIds.push(id);
  });
  return { trainCellIds, holdoutCellIds };
}

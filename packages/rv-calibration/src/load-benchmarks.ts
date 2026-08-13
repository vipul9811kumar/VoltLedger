import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ManheimIndexPoint, AutovistaRetentionPoint } from './types';

const DATA_DIR = join(__dirname, '..', 'data');

export function loadManheimIndexPoints(): ManheimIndexPoint[] {
  const raw = readFileSync(join(DATA_DIR, 'manheim', 'muvvi_ev_index.json'), 'utf-8');
  return JSON.parse(raw) as ManheimIndexPoint[];
}

export function loadAutovistaRetentionPoints(): AutovistaRetentionPoint[] {
  const raw = readFileSync(join(DATA_DIR, 'autovista', 'eu_bev_retention_points.json'), 'utf-8');
  return JSON.parse(raw) as AutovistaRetentionPoint[];
}

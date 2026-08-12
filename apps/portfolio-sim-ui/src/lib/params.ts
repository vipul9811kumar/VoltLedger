import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface MethodologyParams {
  _note?: string;
  baselineAnnualDefaultProbability: number;
  ltvBandMultipliers: { under60: number; '60to75': number; '75to85': number; over85: number };
  gradeMultipliers: { A: number; B: number; C: number; D: number; F: number };
  withoutPolicyFlatLtvPct: number;
  withoutPolicyFlatRateBps: number;
  repossessionLiquidationDiscountPct: number;
  loanTermMonths: number;
}

// tools/portfolio-sim lives three levels up from this app's src/lib.
const PARAMS_PATH = join(process.cwd(), '..', '..', 'tools', 'portfolio-sim', 'data', 'methodology-params.json');

export function readParams(): MethodologyParams {
  return JSON.parse(readFileSync(PARAMS_PATH, 'utf-8'));
}

export function writeParams(params: MethodologyParams): void {
  writeFileSync(PARAMS_PATH, JSON.stringify(params, null, 2) + '\n');
}

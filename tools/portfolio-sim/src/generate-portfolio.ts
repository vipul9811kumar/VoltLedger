import { BATTERY_MODELS, USAGE_PROFILES, CHEMISTRY_PARAMS } from '@voltledger/synthetic-generator';
import { generateDegradationTrajectory } from '@voltledger/synthetic-generator/src/degradation';
import type { MethodologyParams, SimulatedLoan } from './types';

/** Simple seedable PRNG (mulberry32) so a run is reproducible from its seed. */
export function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomFrom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generatePortfolio(n: number, seed: number, params: MethodologyParams): SimulatedLoan[] {
  const rng = makeRng(seed);
  const loanTermWeeks = Math.round((params.loanTermMonths * 52) / 12);

  const loans: SimulatedLoan[] = [];
  for (let i = 0; i < n; i++) {
    const model = randomFrom(rng, BATTERY_MODELS);
    const profile = randomFrom(rng, USAGE_PROFILES);
    const chemistry = model.chemistry as 'LFP' | 'NMC' | 'NCA';

    // 0-3yr old used EV at origination (new-lease through lightly-used).
    const ageAtOriginationWeeks = Math.floor(rng() * 156);
    const totalWeeks = ageAtOriginationWeeks + loanTermWeeks;

    const trajectory = generateDegradationTrajectory(
      CHEMISTRY_PARAMS[chemistry],
      profile,
      model.capacityKwh,
      model.nominalVoltageV,
      totalWeeks,
    ).map((p) => ({
      week: p.week,
      soh: p.soh,
      cellTempMax: p.thermal.cellTempMax,
      dcFastChargeRatio: p.usage.dcFastChargeRatio,
      stateOfCharge: p.usage.stateOfCharge,
    }));

    const vehicleValueUsd = Math.round(25_000 + rng() * 30_000);
    const requestedLoanAmountUsd = Math.round(vehicleValueUsd * (0.6 + rng() * 0.3));

    loans.push({
      index: i,
      chemistry,
      segment: profile.name,
      manufacturer: model.manufacturer,
      modelName: model.modelName,
      capacityKwh: model.capacityKwh,
      nominalVoltageV: model.nominalVoltageV,
      ageAtOriginationWeeks,
      vehicleValueUsd,
      requestedLoanAmountUsd,
      trajectory,
    });
  }

  return loans;
}

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RiskGrade } from './voltledger-client';

const POLICY_PATH = join(process.cwd(), 'data', 'policy.json');

export type UnderwritingDecision = 'ACCEPT' | 'REFER' | 'DECLINE';

export interface PolicyBand {
  ltvCapPct: number;
  ratePremiumBps: number;
  decision: UnderwritingDecision;
}

export interface PolicyTable {
  bands: Record<RiskGrade, PolicyBand>;
}

export function readPolicy(): PolicyTable {
  return JSON.parse(readFileSync(POLICY_PATH, 'utf-8'));
}

export function writePolicy(policy: PolicyTable): void {
  writeFileSync(POLICY_PATH, JSON.stringify(policy, null, 2) + '\n');
}

export interface UnderwritingResult {
  band: PolicyBand;
  finalLtvPct: number;
  finalDecision: UnderwritingDecision;
  downgradedFromAccept: boolean;
  reason: string;
}

/**
 * Applies the lender's policy table to VoltLedger's own recommendation, plus
 * one real underwriting check: even a policy-ACCEPT grade gets downgraded to
 * REFER if the *requested* loan amount would exceed the computed LTV cap.
 * Keeps this "credible" rather than a pass-through echo of the policy table.
 */
export function applyPolicy(params: {
  grade: RiskGrade;
  voltledgerMaxLtvPct: number;
  requestedLoanAmountUsd: number;
  vehicleValueUsd: number;
  policy: PolicyTable;
}): UnderwritingResult {
  const { grade, voltledgerMaxLtvPct, requestedLoanAmountUsd, vehicleValueUsd, policy } = params;
  const band = policy.bands[grade];
  const finalLtvPct = Math.min(voltledgerMaxLtvPct, band.ltvCapPct);

  const requestedLtvPct = vehicleValueUsd > 0 ? (requestedLoanAmountUsd / vehicleValueUsd) * 100 : 0;

  if (band.decision === 'ACCEPT' && requestedLtvPct > finalLtvPct) {
    return {
      band,
      finalLtvPct,
      finalDecision: 'REFER',
      downgradedFromAccept: true,
      reason: `Policy band ${grade} allows ACCEPT up to ${finalLtvPct.toFixed(1)}% LTV, but the requested ` +
        `$${requestedLoanAmountUsd.toLocaleString()} on a $${vehicleValueUsd.toLocaleString()} vehicle implies ` +
        `${requestedLtvPct.toFixed(1)}% LTV — referred for manual review.`,
    };
  }

  return {
    band,
    finalLtvPct,
    finalDecision: band.decision,
    downgradedFromAccept: false,
    reason: `Policy band ${grade}: ${band.decision} up to ${finalLtvPct.toFixed(1)}% LTV, ` +
      `+${band.ratePremiumBps}bps premium.`,
  };
}

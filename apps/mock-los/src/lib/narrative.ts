import type { LtvResponse, ResidualValueResponse, RiskResponse } from './voltledger-client';
import type { UnderwritingResult } from './policy';

/**
 * A decision narrative for REFER/DECLINE outcomes — every decision should
 * explain itself, not just approvals. This is a locally-generated summary,
 * NOT an origination attestation: it never calls /v1/origination/attest
 * (that endpoint freezes evidence for a loan actually being originated,
 * which REFER/DECLINE explicitly are not) and carries no audit ID. For
 * ACCEPT, the real attestationText from that endpoint is used instead —
 * see route.ts.
 */
export function generateDecisionNarrative(params: {
  applicantName: string;
  batterySerial: string;
  requestedLoanAmountUsd: number;
  vehicleValueUsd: number;
  risk: RiskResponse;
  ltv: LtvResponse;
  residualValue: ResidualValueResponse;
  underwriting: UnderwritingResult;
}): string {
  const { applicantName, batterySerial, requestedLoanAmountUsd, vehicleValueUsd, risk, ltv, residualValue, underwriting } = params;
  const requestedLtvPct = vehicleValueUsd > 0 ? (requestedLoanAmountUsd / vehicleValueUsd) * 100 : 0;

  const lines = [
    `VoltLedger Underwriting Narrative (${underwriting.finalDecision} — not an origination attestation)`,
    `Applicant: ${applicantName}`,
    `Battery: ${batterySerial} | grade ${risk.grade} | composite score ${risk.compositeScore}/1000 | confidence ${Math.round(risk.confidenceLevel * 100)}%`,
    `Requested: $${requestedLoanAmountUsd.toLocaleString()} on a $${vehicleValueUsd.toLocaleString()} vehicle (${requestedLtvPct.toFixed(1)}% implied LTV).`,
    `VoltLedger recommendation: ${ltv.recommendation.recommendedLtvPct.toFixed(1)}% LTV, up to ${ltv.recommendation.maxLtvPct}% max. ${ltv.recommendation.rationale}`,
    `Residual value: $${residualValue.current.batteryResidualValueUsd.toFixed(0)} (${residualValue.current.batteryValuePctOfVehicle.toFixed(1)}% of vehicle value).`,
    `Decision: ${underwriting.finalDecision}. ${underwriting.reason}`,
  ];

  if (underwriting.finalDecision === 'REFER') {
    lines.push('This application requires manual underwriting review before a final decision can be made.');
  } else if (underwriting.finalDecision === 'DECLINE') {
    lines.push('This risk grade falls outside the lender policy\'s acceptable range for financing at this time.');
  }

  if (risk.provenance === 'SIMULATED_CALIBRATED') {
    lines.push('Data provenance: SIMULATED_CALIBRATED. This is demonstration data; no design-partner performance claim is being made.');
  } else {
    lines.push(`Data provenance: ${risk.provenance}.`);
  }

  if (risk.flags.abnormalDegradation || risk.flags.thermalAnomalyDetected || risk.flags.highDcfcUsage || risk.flags.deepDischargeHistory) {
    const activeFlags = Object.entries(risk.flags)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    lines.push(`Risk flags on record: ${activeFlags}.`);
  }

  lines.push(`Generated: ${new Date().toISOString()}`);
  return lines.join('\n');
}

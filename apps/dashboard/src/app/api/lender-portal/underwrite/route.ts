import { NextRequest, NextResponse } from 'next/server';
import { attestOrigination, getLtv, getResidualValue, getRisk, getSecondLife } from '@/lib/lender-portal/voltledger-client';
import { applyPolicy, readPolicy } from '@/lib/lender-portal/policy';
import { appendDecision } from '@/lib/lender-portal/decisions-log';
import { generateDecisionNarrative } from '@/lib/lender-portal/narrative';

interface UnderwriteRequestBody {
  applicantName: string;
  batterySerial: string;
  requestedLoanAmountUsd: number;
  vehicleValueUsd: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as UnderwriteRequestBody;
  const { applicantName, batterySerial, requestedLoanAmountUsd, vehicleValueUsd } = body;

  if (!applicantName || !batterySerial || !requestedLoanAmountUsd || !vehicleValueUsd) {
    return NextResponse.json(
      { error: 'applicantName, batterySerial, requestedLoanAmountUsd, vehicleValueUsd are all required' },
      { status: 400 },
    );
  }

  // Mid-underwriting enrichment calls — the whole point of this app. Second-life
  // is informational (end-of-loan collateral outlook), not decision-critical, so
  // it doesn't gate the 424 check below the way risk/ltv/residualValue do.
  const [risk, ltv, residualValue, secondLife] = await Promise.all([
    getRisk(batterySerial),
    getLtv(batterySerial),
    getResidualValue(batterySerial),
    getSecondLife(batterySerial),
  ]);

  if (!risk.ok || !ltv.ok || !residualValue.ok) {
    return NextResponse.json(
      {
        error: `VoltLedger enrichment failed for battery "${batterySerial}" — check the serial exists and has been scored.`,
        traces: { risk, ltv, residualValue, secondLife },
      },
      { status: 424 }, // Failed Dependency — accurately describes "our upstream check failed"
    );
  }

  const policy = readPolicy();
  const underwriting = applyPolicy({
    grade: risk.response.body.grade,
    voltledgerMaxLtvPct: ltv.response.body.recommendation.maxLtvPct,
    requestedLoanAmountUsd,
    vehicleValueUsd,
    policy,
  });

  const attest =
    underwriting.finalDecision === 'ACCEPT'
      ? await attestOrigination({ batterySerial, vehicleValueUsd })
      : undefined;

  // Every decision gets an explanation, not just approvals. ACCEPT uses the
  // real, evidence-locked attestationText (when the attest call succeeded);
  // REFER/DECLINE — and ACCEPT if attest unexpectedly failed — get a
  // locally-generated narrative instead (never a fabricated audit record).
  const narrativeText =
    attest?.ok
      ? attest.response.body.attestationText
      : generateDecisionNarrative({
          applicantName,
          batterySerial,
          requestedLoanAmountUsd,
          vehicleValueUsd,
          risk: risk.response.body,
          ltv: ltv.response.body,
          residualValue: residualValue.response.body,
          underwriting,
        });

  const record = appendDecision({
    applicant: { name: applicantName },
    batterySerial,
    requestedLoanAmountUsd,
    vehicleValueUsd,
    traces: { risk, ltv, residualValue, secondLife, attest },
    underwriting,
    narrativeText,
  });

  return NextResponse.json(record, { status: 200 });
}

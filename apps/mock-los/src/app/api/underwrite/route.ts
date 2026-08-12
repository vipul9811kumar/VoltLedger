import { NextRequest, NextResponse } from 'next/server';
import { attestOrigination, getLtv, getResidualValue, getRisk } from '@/lib/voltledger-client';
import { applyPolicy, readPolicy } from '@/lib/policy';
import { appendDecision } from '@/lib/decisions-log';

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

  // Mid-underwriting enrichment calls — the whole point of this app.
  const [risk, ltv, residualValue] = await Promise.all([
    getRisk(batterySerial),
    getLtv(batterySerial),
    getResidualValue(batterySerial),
  ]);

  if (!risk.ok || !ltv.ok || !residualValue.ok) {
    return NextResponse.json(
      {
        error: `VoltLedger enrichment failed for battery "${batterySerial}" — check the serial exists and has been scored.`,
        traces: { risk, ltv, residualValue },
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

  const record = appendDecision({
    applicant: { name: applicantName },
    batterySerial,
    requestedLoanAmountUsd,
    vehicleValueUsd,
    traces: { risk, ltv, residualValue, attest },
    underwriting,
  });

  return NextResponse.json(record, { status: 200 });
}

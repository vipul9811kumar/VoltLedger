import { NextRequest, NextResponse } from 'next/server';
import { getOriginationHistory, lookupBattery } from '@/lib/lender-portal/voltledger-client';

export async function GET(req: NextRequest) {
  const vin = req.nextUrl.searchParams.get('vin') ?? undefined;
  const serial = req.nextUrl.searchParams.get('serial') ?? undefined;

  if (!vin && !serial) {
    return NextResponse.json({ error: 'Provide ?vin= or ?serial=' }, { status: 400 });
  }

  const battery = await lookupBattery({ vin, serial });
  // Prior-financing check — informational only, doesn't gate the lookup response
  // status. Only runs when we have a serial (the audit-history endpoint is
  // serial-keyed, not VIN-keyed).
  const originationHistory = serial ? await getOriginationHistory(serial) : undefined;

  return NextResponse.json({ battery, originationHistory }, { status: battery.ok ? 200 : battery.response.status });
}

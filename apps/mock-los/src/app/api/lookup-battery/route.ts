import { NextRequest, NextResponse } from 'next/server';
import { lookupBattery } from '@/lib/voltledger-client';

export async function GET(req: NextRequest) {
  const vin = req.nextUrl.searchParams.get('vin') ?? undefined;
  const serial = req.nextUrl.searchParams.get('serial') ?? undefined;

  if (!vin && !serial) {
    return NextResponse.json({ error: 'Provide ?vin= or ?serial=' }, { status: 400 });
  }

  const trace = await lookupBattery({ vin, serial });
  return NextResponse.json(trace, { status: trace.ok ? 200 : trace.response.status });
}

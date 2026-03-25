import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const vin = searchParams.get('vin');
  const id  = searchParams.get('id');

  if (!vin && !id) {
    return NextResponse.json({ error: 'Provide ?vin= or ?id=' }, { status: 400 });
  }

  const API_URL = process.env.INTERNAL_API_URL!;
  const param   = vin ? `vin=${encodeURIComponent(vin)}` : `id=${encodeURIComponent(id!)}`;
  const res     = await fetch(`${API_URL}/v1/batteries/lookup?${param}`, {
    headers: { 'x-service-token': process.env.SERVICE_TOKEN! },
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
import { NextRequest, NextResponse } from 'next/server';
import { readPolicy, writePolicy, type PolicyTable } from '@/lib/policy';

export async function GET() {
  return NextResponse.json(readPolicy());
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as PolicyTable;
  if (!body?.bands) {
    return NextResponse.json({ error: 'Body must be { bands: {...} }' }, { status: 400 });
  }
  writePolicy(body);
  return NextResponse.json(body);
}

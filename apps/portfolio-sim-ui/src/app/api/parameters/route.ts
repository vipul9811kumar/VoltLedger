import { NextRequest, NextResponse } from 'next/server';
import { readParams, writeParams, type MethodologyParams } from '@/lib/params';

export async function GET() {
  return NextResponse.json(readParams());
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as MethodologyParams;
  if (typeof body?.baselineAnnualDefaultProbability !== 'number') {
    return NextResponse.json({ error: 'Invalid parameters body' }, { status: 400 });
  }
  writeParams(body);
  return NextResponse.json(body);
}

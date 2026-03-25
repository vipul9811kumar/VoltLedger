import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const API_URL = process.env.INTERNAL_API_URL!;
  const res = await fetch(`${API_URL}/v1/admin/early-access/${params.id}/approve`, {
    method:  'POST',
    headers: { 'x-service-token': process.env.SERVICE_TOKEN!, 'content-type': 'application/json' },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
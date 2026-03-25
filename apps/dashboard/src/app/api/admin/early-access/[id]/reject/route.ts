import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.text();
  const API_URL = process.env.INTERNAL_API_URL!;
  const res = await fetch(`${API_URL}/v1/admin/early-access/${params.id}/reject`, {
    method:  'POST',
    headers: { 'x-service-token': process.env.SERVICE_TOKEN!, 'content-type': 'application/json' },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
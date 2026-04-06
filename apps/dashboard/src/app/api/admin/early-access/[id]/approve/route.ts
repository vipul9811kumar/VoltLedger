import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, sessionClaims } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const meta       = sessionClaims?.publicMetadata as any;
  const adminId    = process.env.ADMIN_CLERK_USER_ID;
  const isAdmin    = (adminId && userId === adminId) || meta?.isAdmin === true;
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const API_URL = process.env.INTERNAL_API_URL!;
  const res = await fetch(`${API_URL}/v1/admin/early-access/${params.id}/approve`, {
    method:  'POST',
    headers: { 'x-service-token': process.env.SERVICE_TOKEN!, 'content-type': 'application/json' },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

/**
 * POST /api/early-access
 * Public endpoint — no Clerk auth required.
 * Writes directly to the DB for instant response, then fires notification
 * emails via the API in the background (non-blocking).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@voltledger/db';

// Allow cross-origin POST from the marketing site
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { firstName, lastName, email, company, role } = body as Record<string, string>;

  if (!firstName || !lastName || !email || !company || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Write to DB immediately — no API cold-start wait
  const record = await prisma.earlyAccessRequest.upsert({
    where:  { email },
    update: { firstName, lastName, company, role, status: 'PENDING' },
    create: { firstName, lastName, email, company, role },
  });

  // Fire-and-forget: ask the API to send notification emails
  // If the API is cold or down, the record is already saved — nothing is lost
  const apiUrl = process.env.INTERNAL_API_URL;
  if (apiUrl) {
    fetch(`${apiUrl}/v1/early-access`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ firstName, lastName, email, company, role }),
    }).catch(err => console.warn('[early-access] background email failed:', err));
  }

  return NextResponse.json(
    { id: record.id, message: "Request received. We'll be in touch within 48 hours." },
    {
      status: 201,
      headers: { 'Access-Control-Allow-Origin': '*' },
    }
  );
}

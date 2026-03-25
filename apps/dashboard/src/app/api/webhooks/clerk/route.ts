import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Verify Svix signature
  const headerPayload = headers();
  const svixId        = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh   = new Webhook(secret);
  let event: { type: string; data: Record<string, any> };

  try {
    event = wh.verify(body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'user.created') {
    return NextResponse.json({ received: true });
  }

  const { id: clerkUserId, email_addresses, first_name, last_name } = event.data;
  const primaryEmail = email_addresses?.find((e: any) => e.id === event.data.primary_email_address_id)?.email_address
    ?? email_addresses?.[0]?.email_address;

  if (!primaryEmail || !clerkUserId) {
    return NextResponse.json({ received: true });
  }

  // Call the API provision endpoint
  const API_URL = process.env.INTERNAL_API_URL!;
  const res = await fetch(`${API_URL}/v1/provision`, {
    method:  'POST',
    headers: {
      'content-type':    'application/json',
      'x-service-token': process.env.SERVICE_TOKEN!,
    },
    body: JSON.stringify({
      clerkUserId,
      email:     primaryEmail,
      firstName: first_name ?? '',
      lastName:  last_name  ?? '',
    }),
  });

  if (!res.ok) {
    console.error('[clerk-webhook] provision call failed', await res.text());
    return NextResponse.json({ received: true });
  }

  const result = await res.json();

  // Stamp the Clerk user's public metadata with their lenderId
  // so middleware can gate access without a DB call
  if (result.provisioned && result.lenderId) {
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { lenderId: result.lenderId },
      });
    } catch (err) {
      console.error('[clerk-webhook] failed to set publicMetadata:', err);
    }
  }

  return NextResponse.json({ received: true });
}

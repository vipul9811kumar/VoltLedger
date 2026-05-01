import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await clerkClient();
  const user   = await client.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
    ?? user.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) return NextResponse.json({ provisioned: false });

  const API_URL = process.env.INTERNAL_API_URL!;
  const res = await fetch(`${API_URL}/v1/provision`, {
    method:  'POST',
    headers: {
      'content-type':    'application/json',
      'x-service-token': process.env.SERVICE_TOKEN!,
    },
    body: JSON.stringify({
      clerkUserId: userId,
      email:       primaryEmail,
      firstName:   user.firstName ?? '',
      lastName:    user.lastName  ?? '',
    }),
  });

  if (!res.ok) {
    console.error('[provision/retry]', res.status, await res.text());
    return NextResponse.json({ provisioned: false });
  }

  const result = await res.json();

  if (result.provisioned && result.lenderId) {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { lenderId: result.lenderId },
    });
    return NextResponse.json({ provisioned: true });
  }

  return NextResponse.json({ provisioned: false });
}

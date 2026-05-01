import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user email from Clerk
    let primaryEmail: string | undefined;
    try {
      const client = await clerkClient();
      const user   = await client.users.getUser(userId);
      primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
        ?? user.emailAddresses[0]?.emailAddress;
    } catch (err) {
      console.error('[provision/retry] clerkClient error:', err);
      return NextResponse.json({ error: 'clerk_error', provisioned: false });
    }

    if (!primaryEmail) {
      return NextResponse.json({ error: 'no_email', provisioned: false });
    }

    const API_URL      = process.env.INTERNAL_API_URL;
    const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

    if (!API_URL) {
      console.error('[provision/retry] INTERNAL_API_URL not set');
      return NextResponse.json({ error: 'api_url_not_set', provisioned: false });
    }

    // Call the provision API
    let apiRes: Response;
    try {
      apiRes = await fetch(`${API_URL}/v1/provision`, {
        method:  'POST',
        headers: {
          'content-type':    'application/json',
          'x-service-token': SERVICE_TOKEN ?? '',
        },
        body: JSON.stringify({
          clerkUserId: userId,
          email:       primaryEmail,
          firstName:   '',
          lastName:    '',
        }),
      });
    } catch (err) {
      console.error('[provision/retry] fetch error:', err);
      return NextResponse.json({ error: 'api_unreachable', provisioned: false });
    }

    const body = await apiRes.text();

    if (!apiRes.ok) {
      console.error('[provision/retry] API returned', apiRes.status, body);
      return NextResponse.json({ error: `api_${apiRes.status}`, detail: body, provisioned: false });
    }

    let result: any;
    try {
      result = JSON.parse(body);
    } catch {
      console.error('[provision/retry] invalid JSON from API:', body);
      return NextResponse.json({ error: 'invalid_json', provisioned: false });
    }

    if (result.provisioned && result.lenderId) {
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
          publicMetadata: { lenderId: result.lenderId },
        });
      } catch (err) {
        console.error('[provision/retry] updateUserMetadata error:', err);
        // Still provisioned in DB — user can sign out/in to pick up metadata later
      }
      return NextResponse.json({ provisioned: true });
    }

    return NextResponse.json({ provisioned: false });

  } catch (err) {
    console.error('[provision/retry] unhandled error:', err);
    return NextResponse.json({ error: 'internal', provisioned: false });
  }
}

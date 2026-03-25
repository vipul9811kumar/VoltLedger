import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Tier config — map Stripe price IDs → lender tier + quotas
const PRICE_TIER_MAP: Record<string, {
  tier: string;
  monthlyBatteryQuota: number;
  monthlyVinLookupQuota: number | null;
}> = {
  [process.env.STRIPE_PRICE_STARTER!]: {
    tier: 'STARTER',
    monthlyBatteryQuota: 100,
    monthlyVinLookupQuota: 25,
  },
  [process.env.STRIPE_PRICE_PROFESSIONAL!]: {
    tier: 'PROFESSIONAL',
    monthlyBatteryQuota: 500,
    monthlyVinLookupQuota: null,   // unlimited within battery quota
  },
};

async function updateLender(lenderId: string, data: Record<string, unknown>) {
  const API_URL = process.env.INTERNAL_API_URL!;
  await fetch(`${API_URL}/v1/account/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-token': process.env.SERVICE_TOKEN!,
    },
    body: JSON.stringify({ lenderId, ...data }),
  });
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;
      const lenderId  = session.metadata?.lenderId;
      const priceId   = (session as any).line_items?.data?.[0]?.price?.id
                     ?? process.env.STRIPE_PRICE_PROFESSIONAL!;
      const tierConfig = PRICE_TIER_MAP[priceId] ?? PRICE_TIER_MAP[process.env.STRIPE_PRICE_PROFESSIONAL!];
      if (lenderId) {
        await updateLender(lenderId, {
          stripeCustomerId:    session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          stripePriceId:       priceId,
          subscriptionStatus:  'ACTIVE',
          ...tierConfig,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id;
      const tierConfig = priceId ? PRICE_TIER_MAP[priceId] : undefined;
      const status = sub.status === 'active' ? 'ACTIVE'
        : sub.status === 'trialing'   ? 'TRIALING'
        : sub.status === 'past_due'   ? 'PAST_DUE'
        : sub.status === 'canceled'   ? 'CANCELLED'
        : 'INCOMPLETE';

      // Look up lender by stripeSubscriptionId
      const API_URL = process.env.INTERNAL_API_URL!;
      const res = await fetch(`${API_URL}/v1/account/by-subscription/${sub.id}`, {
        headers: { 'x-service-token': process.env.SERVICE_TOKEN! },
      });
      if (res.ok) {
        const lender = await res.json();
        await updateLender(lender.id, {
          subscriptionStatus: status,
          stripePriceId:      priceId,
          currentPeriodEnd:   new Date((sub as any).current_period_end * 1000).toISOString(),
          ...(tierConfig ?? {}),
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const API_URL = process.env.INTERNAL_API_URL!;
      const res = await fetch(`${API_URL}/v1/account/by-subscription/${sub.id}`, {
        headers: { 'x-service-token': process.env.SERVICE_TOKEN! },
      });
      if (res.ok) {
        const lender = await res.json();
        await updateLender(lender.id, {
          subscriptionStatus:  'CANCELLED',
          stripeSubscriptionId: null,
          // Downgrade to Starter quotas on cancellation
          tier:                    'STARTER',
          monthlyBatteryQuota:     100,
          monthlyVinLookupQuota:   25,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as any).subscription as string;
      const API_URL = process.env.INTERNAL_API_URL!;
      const res = await fetch(`${API_URL}/v1/account/by-subscription/${subId}`, {
        headers: { 'x-service-token': process.env.SERVICE_TOKEN! },
      });
      if (res.ok) {
        const lender = await res.json();
        await updateLender(lender.id, { subscriptionStatus: 'PAST_DUE' });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
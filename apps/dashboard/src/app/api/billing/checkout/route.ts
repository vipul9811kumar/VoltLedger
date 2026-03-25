import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });

export async function POST() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get lender account from API
  const API_URL = process.env.INTERNAL_API_URL!;
  const lenderRes = await fetch(`${API_URL}/v1/account`, {
    headers: { 'x-service-token': process.env.SERVICE_TOKEN! },
  });
  const lender = lenderRes.ok ? await lenderRes.json() : null;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_PROFESSIONAL!,  // Professional plan price ID
        quantity: 1,
      },
    ],
    // Pass lender ID so webhook can link subscription → lender
    metadata: { clerkUserId: userId, lenderId: lender?.id ?? '' },
    customer: lender?.stripeCustomerId ?? undefined,
    customer_email: lender?.stripeCustomerId ? undefined : lender?.contactEmail,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
  });

  return NextResponse.json({ url: session.url });
}
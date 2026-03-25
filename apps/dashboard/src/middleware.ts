import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pending(.*)',
  '/api/webhooks/stripe(.*)',
  '/api/webhooks/clerk(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isPublic(req)) return;

  // Require login for all other routes
  auth().protect();

  // After login: if no lenderId in session metadata → not yet provisioned
  const lenderId = (auth().sessionClaims?.publicMetadata as any)?.lenderId;
  if (!lenderId) {
    const pendingUrl = new URL('/pending', req.url);
    return NextResponse.redirect(pendingUrl);
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};

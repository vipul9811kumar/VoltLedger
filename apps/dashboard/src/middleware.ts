import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pending(.*)',
  '/api/early-access(.*)',
  '/api/webhooks/stripe(.*)',
  '/api/webhooks/clerk(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isPublic(req)) return;

  // Require login for all other routes
  auth().protect();

  const meta = auth().sessionClaims?.publicMetadata as any;

  // Admins bypass the lenderId gate entirely
  if (meta?.isAdmin === true) return;

  // Regular users: must have a provisioned lender account
  if (!meta?.lenderId) {
    const pendingUrl = new URL('/pending', req.url);
    return NextResponse.redirect(pendingUrl);
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};

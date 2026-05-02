import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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
  // Require login for all other routes.
  // Provisioning/lenderId check is handled in the (lender) and fleet-ops layouts
  // via a direct DB lookup, which is more reliable than reading JWT claims.
  auth().protect();
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};

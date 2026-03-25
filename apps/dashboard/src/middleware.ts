import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Public routes — no auth required
  publicRoutes: ['/login', '/sign-in', '/api/webhooks/stripe'],
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
-- Add clerkUserId to early_access_requests to track provisioned sign-ups
ALTER TABLE "early_access_requests" ADD COLUMN "clerkUserId" TEXT;
CREATE UNIQUE INDEX "early_access_requests_clerkUserId_key" ON "early_access_requests"("clerkUserId");

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "LenderUserRole" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- AlterTable: add Stripe + subscription fields to lenders
ALTER TABLE "lenders"
  ADD COLUMN "stripeCustomerId"     TEXT UNIQUE,
  ADD COLUMN "stripeSubscriptionId" TEXT UNIQUE,
  ADD COLUMN "stripePriceId"        TEXT,
  ADD COLUMN "subscriptionStatus"   "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  ADD COLUMN "currentPeriodEnd"     TIMESTAMP(3);

-- CreateTable: lender_users
CREATE TABLE "lender_users" (
  "id"        TEXT NOT NULL,
  "clerkId"   TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "name"      TEXT,
  "role"      "LenderUserRole" NOT NULL DEFAULT 'MEMBER',
  "lenderId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lender_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lender_users_clerkId_key" ON "lender_users"("clerkId");

ALTER TABLE "lender_users"
  ADD CONSTRAINT "lender_users_lenderId_fkey"
  FOREIGN KEY ("lenderId") REFERENCES "lenders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
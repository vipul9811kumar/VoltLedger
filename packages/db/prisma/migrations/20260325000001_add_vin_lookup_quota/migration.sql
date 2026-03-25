-- AlterTable: add VIN lookup quota tracking to lenders
ALTER TABLE "lenders"
  ADD COLUMN "monthlyVinLookupQuota"   INTEGER,
  ADD COLUMN "vinLookupsUsedThisMonth" INTEGER NOT NULL DEFAULT 0;
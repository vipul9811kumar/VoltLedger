-- WS-F: distinguishes "no restricted data" from "data exists, access not yet granted"
-- (build spec v2 §8 transparency guardrail), and links a reissued/repurposed-battery
-- passport to the one it supersedes (build spec v2 §7 item 7). Additive only.
ALTER TABLE "battery_passports"
  ADD COLUMN "restrictedAccessStatus" TEXT DEFAULT 'GRANTED',
  ADD COLUMN "priorPassportId" TEXT;

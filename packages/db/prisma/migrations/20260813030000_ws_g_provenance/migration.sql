-- WS-G: build spec v2 §1.3 transparency guardrail — everything the Evidence Layer surfaces
-- states whether it's real or simulated. Additive only.
CREATE TYPE "Provenance" AS ENUM ('REAL_ANCHORED', 'SIMULATED_CALIBRATED', 'ILLUSTRATIVE');

ALTER TABLE "origination_audits"
  ADD COLUMN "provenance" "Provenance" NOT NULL DEFAULT 'SIMULATED_CALIBRATED';

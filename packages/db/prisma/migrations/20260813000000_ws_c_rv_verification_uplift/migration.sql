-- WS-C: real SoH used (vs. the legacy capacityRetentionScore proxy) + the
-- resulting verification-uplift ("value of verified vs. data-less" line item)
-- on ResidualValueEstimate. Additive only.
ALTER TABLE "residual_value_estimates"
  ADD COLUMN "sohUsedPct" DOUBLE PRECISION,
  ADD COLUMN "sohSourceUsed" TEXT NOT NULL DEFAULT 'PROXY',
  ADD COLUMN "dataLessBatteryResidualValueUsd" DOUBLE PRECISION,
  ADD COLUMN "verificationUpliftUsd" DOUBLE PRECISION;

-- CreateEnum
CREATE TYPE "Chemistry" AS ENUM ('LFP', 'NMC', 'NCA', 'LTO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BatteryStatus" AS ENUM ('ACTIVE', 'FLAGGED', 'DECOMMISSIONED', 'SECOND_LIFE');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('OEM_API', 'MQTT_TELEMATICS', 'MANUAL_UPLOAD', 'AUCTION_SCAN', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "LenderTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "LenderType" AS ENUM ('BANK', 'CREDIT_UNION', 'CAPTIVE_FINANCE', 'AUTO_FINTECH', 'AUCTION_HOUSE', 'INSURANCE', 'REMARKETING');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');

-- CreateEnum
CREATE TYPE "SecondLifeUseCase" AS ENUM ('STATIONARY_STORAGE_GRID', 'STATIONARY_STORAGE_COMMERCIAL', 'STATIONARY_STORAGE_RESIDENTIAL', 'EV_FLEET_LOWER_DEMAND', 'REFURBISHMENT_RESALE', 'RECYCLING_ONLY');

-- CreateEnum
CREATE TYPE "LifecycleEventType" AS ENUM ('MANUFACTURED', 'SOLD', 'REGISTERED', 'SERVICE', 'SWAP', 'DAMAGE', 'REPAIR', 'CERTIFICATION', 'DECOMMISSIONED', 'SECOND_LIFE_ENTRY', 'RECYCLED');

-- CreateTable
CREATE TABLE "battery_models" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "chemistry" "Chemistry" NOT NULL,
    "capacityKwh" DOUBLE PRECISION NOT NULL,
    "nominalVoltageV" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "ratedCycleLife" INTEGER NOT NULL,
    "calendarLifeYears" INTEGER,
    "warrantyYears" INTEGER,
    "disassemblyManualUrl" TEXT,
    "hazardousSubstances" TEXT[],
    "extinguishingAgents" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battery_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batteries" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "vin" TEXT,
    "batteryModelId" TEXT NOT NULL,
    "chemistry" "Chemistry" NOT NULL,
    "nominalCapacityKwh" DOUBLE PRECISION NOT NULL,
    "status" "BatteryStatus" NOT NULL DEFAULT 'ACTIVE',
    "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "manufacturedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTelemetryAt" TIMESTAMP(3),
    "oemWarrantyExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_telemetry_points" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "stateOfHealth" DOUBLE PRECISION NOT NULL,
    "stateOfCharge" DOUBLE PRECISION NOT NULL,
    "fullChargeCapacityKwh" DOUBLE PRECISION NOT NULL,
    "cycleCount" INTEGER NOT NULL,
    "cellTempMin" DOUBLE PRECISION NOT NULL,
    "cellTempMax" DOUBLE PRECISION NOT NULL,
    "cellTempAvg" DOUBLE PRECISION NOT NULL,
    "voltageMin" DOUBLE PRECISION NOT NULL,
    "voltageMax" DOUBLE PRECISION NOT NULL,
    "internalResistanceAvg" DOUBLE PRECISION,
    "chargingEvents24h" INTEGER,
    "dcFastChargeRatio" DOUBLE PRECISION,
    "odometer" DOUBLE PRECISION,
    "source" "DataSource" NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battery_telemetry_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_events" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "eventType" "LifecycleEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_ownership_history" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "ownerOrganizationId" TEXT,
    "ownerName" TEXT,
    "ownershipStartDate" TIMESTAMP(3) NOT NULL,
    "ownershipEndDate" TIMESTAMP(3),
    "transferReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battery_ownership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "certificationType" TEXT NOT NULL,
    "issuingBody" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_chains" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "rawMaterialOrigin" TEXT,
    "manufacturingFacility" TEXT,
    "assemblyLocation" TEXT,
    "cathodeSupplier" TEXT,
    "anodeSupplier" TEXT,
    "recycledContentPct" DOUBLE PRECISION,
    "co2FootprintKgCo2e" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compositeScore" INTEGER NOT NULL,
    "grade" "RiskGrade" NOT NULL,
    "degradationScore" INTEGER NOT NULL,
    "thermalScore" INTEGER NOT NULL,
    "usagePatternScore" INTEGER NOT NULL,
    "capacityRetentionScore" INTEGER NOT NULL,
    "ageAdjustedScore" INTEGER NOT NULL,
    "abnormalDegradation" BOOLEAN NOT NULL DEFAULT false,
    "thermalAnomalyDetected" BOOLEAN NOT NULL DEFAULT false,
    "highDcfcUsage" BOOLEAN NOT NULL DEFAULT false,
    "deepDischargeHistory" BOOLEAN NOT NULL DEFAULT false,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residual_value_estimates" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "estimatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleMarketValueUsd" DOUBLE PRECISION NOT NULL,
    "batteryResidualValueUsd" DOUBLE PRECISION NOT NULL,
    "batteryValuePctOfVehicle" DOUBLE PRECISION NOT NULL,
    "residualAt12MonthsUsd" DOUBLE PRECISION NOT NULL,
    "residualAt24MonthsUsd" DOUBLE PRECISION NOT NULL,
    "residualAt36MonthsUsd" DOUBLE PRECISION NOT NULL,
    "residualAt60MonthsUsd" DOUBLE PRECISION NOT NULL,
    "confidenceLowUsd" DOUBLE PRECISION NOT NULL,
    "confidenceHighUsd" DOUBLE PRECISION NOT NULL,
    "baseMarketDataSource" TEXT NOT NULL DEFAULT 'synthetic_model',
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "residual_value_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degradation_forecasts" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "forecastedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentSoH" DOUBLE PRECISION NOT NULL,
    "sohAt6Months" DOUBLE PRECISION NOT NULL,
    "sohAt12Months" DOUBLE PRECISION NOT NULL,
    "sohAt24Months" DOUBLE PRECISION NOT NULL,
    "sohAt36Months" DOUBLE PRECISION NOT NULL,
    "sohAt60Months" DOUBLE PRECISION NOT NULL,
    "projectedDate80Pct" TIMESTAMP(3),
    "projectedDate70Pct" TIMESTAMP(3),
    "projectedDate60Pct" TIMESTAMP(3),
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "degradation_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ltv_recommendations" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "lenderId" TEXT,
    "recommendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recommendedLtvPct" DOUBLE PRECISION NOT NULL,
    "maxLtvPct" DOUBLE PRECISION NOT NULL,
    "adjustedResidualUsd" DOUBLE PRECISION NOT NULL,
    "riskPremiumBps" INTEGER NOT NULL,
    "grade" "RiskGrade" NOT NULL,
    "rationale" TEXT NOT NULL,
    "requestedLoanAmountUsd" DOUBLE PRECISION NOT NULL,
    "vehiclePurchasePriceUsd" DOUBLE PRECISION NOT NULL,
    "loanTermMonths" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "ltv_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "second_life_assessments" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentSoH" DOUBLE PRECISION NOT NULL,
    "isViable" BOOLEAN NOT NULL,
    "viabilityScore" INTEGER NOT NULL,
    "recommendedUseCase" "SecondLifeUseCase",
    "estimatedRemainingLifeYears" DOUBLE PRECISION NOT NULL,
    "estimatedSecondLifeValueUsd" DOUBLE PRECISION NOT NULL,
    "recyclerValueUsd" DOUBLE PRECISION NOT NULL,
    "disqualifiers" TEXT[],
    "modelVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "second_life_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" "LenderTier" NOT NULL,
    "lenderType" "LenderType" NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBatteryQuota" INTEGER,
    "batteriesUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "acvUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingCycleResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_records" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "batteryId" TEXT,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "billedUnits" INTEGER NOT NULL DEFAULT 1,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "interestRatePct" DOUBLE PRECISION,
    "ltvAtOrigination" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "early_access_requests" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "early_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "batteries_serialNumber_key" ON "batteries"("serialNumber");

-- CreateIndex
CREATE INDEX "batteries_vin_idx" ON "batteries"("vin");

-- CreateIndex
CREATE INDEX "batteries_status_idx" ON "batteries"("status");

-- CreateIndex
CREATE INDEX "batteries_chemistry_idx" ON "batteries"("chemistry");

-- CreateIndex
CREATE INDEX "battery_telemetry_points_batteryId_recordedAt_idx" ON "battery_telemetry_points"("batteryId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "battery_telemetry_points_recordedAt_idx" ON "battery_telemetry_points"("recordedAt" DESC);

-- CreateIndex
CREATE INDEX "lifecycle_events_batteryId_eventDate_idx" ON "lifecycle_events"("batteryId", "eventDate" DESC);

-- CreateIndex
CREATE INDEX "battery_ownership_history_batteryId_idx" ON "battery_ownership_history"("batteryId");

-- CreateIndex
CREATE INDEX "certifications_batteryId_idx" ON "certifications"("batteryId");

-- CreateIndex
CREATE UNIQUE INDEX "supply_chains_batteryId_key" ON "supply_chains"("batteryId");

-- CreateIndex
CREATE INDEX "risk_scores_batteryId_scoredAt_idx" ON "risk_scores"("batteryId", "scoredAt" DESC);

-- CreateIndex
CREATE INDEX "residual_value_estimates_batteryId_estimatedAt_idx" ON "residual_value_estimates"("batteryId", "estimatedAt" DESC);

-- CreateIndex
CREATE INDEX "degradation_forecasts_batteryId_forecastedAt_idx" ON "degradation_forecasts"("batteryId", "forecastedAt" DESC);

-- CreateIndex
CREATE INDEX "ltv_recommendations_batteryId_idx" ON "ltv_recommendations"("batteryId");

-- CreateIndex
CREATE INDEX "ltv_recommendations_lenderId_idx" ON "ltv_recommendations"("lenderId");

-- CreateIndex
CREATE INDEX "second_life_assessments_batteryId_idx" ON "second_life_assessments"("batteryId");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_organizationId_key" ON "lenders"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyPrefix_key" ON "api_keys"("keyPrefix");

-- CreateIndex
CREATE INDEX "api_keys_lenderId_idx" ON "api_keys"("lenderId");

-- CreateIndex
CREATE INDEX "api_usage_records_lenderId_recordedAt_idx" ON "api_usage_records"("lenderId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "api_usage_records_recordedAt_idx" ON "api_usage_records"("recordedAt" DESC);

-- CreateIndex
CREATE INDEX "webhook_deliveries_subscriptionId_idx" ON "webhook_deliveries"("subscriptionId");

-- CreateIndex
CREATE INDEX "loans_batteryId_idx" ON "loans"("batteryId");

-- CreateIndex
CREATE UNIQUE INDEX "early_access_requests_email_key" ON "early_access_requests"("email");

-- CreateIndex
CREATE INDEX "early_access_requests_email_idx" ON "early_access_requests"("email");

-- CreateIndex
CREATE INDEX "early_access_requests_status_idx" ON "early_access_requests"("status");

-- AddForeignKey
ALTER TABLE "batteries" ADD CONSTRAINT "batteries_batteryModelId_fkey" FOREIGN KEY ("batteryModelId") REFERENCES "battery_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_telemetry_points" ADD CONSTRAINT "battery_telemetry_points_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_ownership_history" ADD CONSTRAINT "battery_ownership_history_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_ownership_history" ADD CONSTRAINT "battery_ownership_history_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_chains" ADD CONSTRAINT "supply_chains_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residual_value_estimates" ADD CONSTRAINT "residual_value_estimates_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degradation_forecasts" ADD CONSTRAINT "degradation_forecasts_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ltv_recommendations" ADD CONSTRAINT "ltv_recommendations_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ltv_recommendations" ADD CONSTRAINT "ltv_recommendations_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "second_life_assessments" ADD CONSTRAINT "second_life_assessments_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lenders" ADD CONSTRAINT "lenders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


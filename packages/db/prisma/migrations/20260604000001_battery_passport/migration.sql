-- EU Battery Passport — Migration
-- Adds: PassportTier enum, DataExchangeFramework enum,
--       battery_passports, passport_verifications, origination_audits tables.
-- Extends: risk_scores (passport fields), batteries (relation), lenders (relation), loans (relation)

-- ── New enums ────────────────────────────────────────────────────────────────

CREATE TYPE "PassportTier" AS ENUM ('PUBLIC', 'RESTRICTED', 'CONFIDENTIAL');
CREATE TYPE "DataExchangeFramework" AS ENUM ('CATENA_X', 'GS1', 'DIRECT_OEM', 'THIRD_PARTY_AGGREGATOR', 'MOCK');

-- EU_PASSPORT value into existing DataSource enum
ALTER TYPE "DataSource" ADD VALUE IF NOT EXISTS 'EU_PASSPORT';

-- ── Extend risk_scores ───────────────────────────────────────────────────────

ALTER TABLE "risk_scores"
  ADD COLUMN IF NOT EXISTS "passportVerified"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sohSource"           TEXT    NOT NULL DEFAULT 'TELEMETRY',
  ADD COLUMN IF NOT EXISTS "passportSohDeltaPct" DOUBLE PRECISION;

-- ── battery_passports ────────────────────────────────────────────────────────

CREATE TABLE "battery_passports" (
  "id"                     TEXT NOT NULL,
  "batteryId"              TEXT NOT NULL,
  "passportUniqueId"       TEXT NOT NULL,
  "passportQrUrl"          TEXT,
  "dataExchangeFramework"  "DataExchangeFramework" NOT NULL DEFAULT 'MOCK',
  "tierAccess"             "PassportTier"          NOT NULL DEFAULT 'PUBLIC',

  -- Public tier
  "batteryCategory"        TEXT,
  "manufacturerName"       TEXT,
  "manufacturingDate"      TIMESTAMP(3),
  "manufacturingLocation"  TEXT,
  "carbonFootprintKgCo2e"  DOUBLE PRECISION,
  "carbonIntensityClass"   TEXT,
  "recycledContentPct"     DOUBLE PRECISION,
  "cobaltPct"              DOUBLE PRECISION,
  "lithiumPct"             DOUBLE PRECISION,
  "nickelPct"              DOUBLE PRECISION,
  "manganesePct"           DOUBLE PRECISION,
  "ratedCapacityAh"        DOUBLE PRECISION,
  "energyDensityWhKg"      DOUBLE PRECISION,
  "powerDensityWKg"        DOUBLE PRECISION,
  "expectedLifetimeCycles" INTEGER,
  "temperatureRangeMin"    DOUBLE PRECISION,
  "temperatureRangeMax"    DOUBLE PRECISION,
  "recycledCobaltPct"      DOUBLE PRECISION,
  "recycledLithiumPct"     DOUBLE PRECISION,
  "recycledNickelPct"      DOUBLE PRECISION,
  "eolGuidanceText"        TEXT,

  -- Restricted tier (null when not authorized)
  "unitSoH"                DOUBLE PRECISION,
  "unitSoC"                DOUBLE PRECISION,
  "chargeCycleCount"       INTEGER,
  "fullChargeCapacityAh"   DOUBLE PRECISION,
  "remainingCapacityAh"    DOUBLE PRECISION,
  "tempHistoryMin"         DOUBLE PRECISION,
  "tempHistoryMax"         DOUBLE PRECISION,
  "tempHistoryAvg"         DOUBLE PRECISION,
  "batteryStatusCode"      TEXT,
  "negativeEvents"         JSONB,

  -- Sync metadata
  "issuedAt"               TIMESTAMP(3),
  "expiresAt"              TIMESTAMP(3),
  "lastSyncedAt"           TIMESTAMP(3),
  "syncSucceeded"          BOOLEAN NOT NULL DEFAULT false,
  "syncErrorMessage"       TEXT,
  "isVerified"             BOOLEAN NOT NULL DEFAULT false,
  "rawPassportJson"        JSONB,

  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "battery_passports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "battery_passports_batteryId_key"       ON "battery_passports"("batteryId");
CREATE UNIQUE INDEX "battery_passports_passportUniqueId_key" ON "battery_passports"("passportUniqueId");
CREATE INDEX        "battery_passports_batteryId_idx"        ON "battery_passports"("batteryId");
CREATE INDEX        "battery_passports_passportUniqueId_idx" ON "battery_passports"("passportUniqueId");

ALTER TABLE "battery_passports"
  ADD CONSTRAINT "battery_passports_batteryId_fkey"
  FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── passport_verifications ───────────────────────────────────────────────────

CREATE TABLE "passport_verifications" (
  "id"                    TEXT NOT NULL,
  "passportId"            TEXT NOT NULL,
  "batteryId"             TEXT NOT NULL,
  "verifiedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verificationMethod"    TEXT NOT NULL,
  "passportMatchesSerial" BOOLEAN NOT NULL,
  "passportMatchesVin"    BOOLEAN NOT NULL,
  "passportMatchesModel"  BOOLEAN NOT NULL,
  "cellPackChainValid"    BOOLEAN NOT NULL DEFAULT false,
  "packVehicleChainValid" BOOLEAN NOT NULL DEFAULT false,
  "identityChainValid"    BOOLEAN NOT NULL,
  "confidenceScore"       DOUBLE PRECISION NOT NULL,
  "discrepancies"         TEXT[] NOT NULL DEFAULT '{}',
  "verificationNotes"     TEXT,
  "verifiedByLenderId"    TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "passport_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passport_verifications_passportId_key" ON "passport_verifications"("passportId");
CREATE INDEX        "passport_verifications_batteryId_idx"  ON "passport_verifications"("batteryId");

ALTER TABLE "passport_verifications"
  ADD CONSTRAINT "passport_verifications_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "battery_passports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── origination_audits ───────────────────────────────────────────────────────

CREATE TABLE "origination_audits" (
  "id"                          TEXT NOT NULL,
  "loanId"                      TEXT,
  "batteryId"                   TEXT NOT NULL,
  "passportId"                  TEXT,
  "lenderId"                    TEXT,
  "checkedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "passportTierAccessed"        TEXT,
  "passportVerifiedAtCheck"     BOOLEAN NOT NULL DEFAULT false,
  "sohSource"                   TEXT NOT NULL,
  "sohUsedPct"                  DOUBLE PRECISION,
  "compositeScoreAtOrigination" INTEGER,
  "riskGradeAtOrigination"      TEXT,
  "evidenceSnapshot"            JSONB NOT NULL,
  "attestationText"             TEXT NOT NULL,
  "attestationVersion"          TEXT NOT NULL DEFAULT '1.0',
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "origination_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "origination_audits_batteryId_idx" ON "origination_audits"("batteryId");
CREATE INDEX "origination_audits_lenderId_idx"  ON "origination_audits"("lenderId");

ALTER TABLE "origination_audits"
  ADD CONSTRAINT "origination_audits_batteryId_fkey"
  FOREIGN KEY ("batteryId") REFERENCES "batteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "origination_audits"
  ADD CONSTRAINT "origination_audits_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "battery_passports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "origination_audits"
  ADD CONSTRAINT "origination_audits_loanId_fkey"
  FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "origination_audits"
  ADD CONSTRAINT "origination_audits_lenderId_fkey"
  FOREIGN KEY ("lenderId") REFERENCES "lenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

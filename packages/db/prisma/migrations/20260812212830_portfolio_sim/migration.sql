-- CreateTable
CREATE TABLE "portfolio_sim_runs" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "methodologyVersion" TEXT NOT NULL,
    "nLoans" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "provenance" TEXT NOT NULL DEFAULT 'SIMULATED_CALIBRATED',
    "withNetLossUsd" DOUBLE PRECISION NOT NULL,
    "withoutNetLossUsd" DOUBLE PRECISION NOT NULL,
    "lossDeltaUsd" DOUBLE PRECISION NOT NULL,
    "withLgdPct" DOUBLE PRECISION NOT NULL,
    "withoutLgdPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "portfolio_sim_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_loan_outcomes" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "loanId" TEXT,
    "chemistry" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "arm" TEXT NOT NULL,
    "originatedLtvPct" DOUBLE PRECISION NOT NULL,
    "loanAmountUsd" DOUBLE PRECISION NOT NULL,
    "defaulted" BOOLEAN NOT NULL,
    "defaultMonth" INTEGER,
    "realizedRecoveryUsd" DOUBLE PRECISION,
    "netLossUsd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sim_loan_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sim_loan_outcomes_runId_idx" ON "sim_loan_outcomes"("runId");

-- AddForeignKey
ALTER TABLE "sim_loan_outcomes" ADD CONSTRAINT "sim_loan_outcomes_runId_fkey" FOREIGN KEY ("runId") REFERENCES "portfolio_sim_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_loan_outcomes" ADD CONSTRAINT "sim_loan_outcomes_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;


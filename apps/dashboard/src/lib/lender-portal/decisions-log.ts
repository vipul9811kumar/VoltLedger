import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ApiTrace, AttestResponse, LtvResponse, ResidualValueResponse, RiskResponse, SecondLifeResponse } from '@/lib/lender-portal/voltledger-client';
import type { UnderwritingResult } from '@/lib/lender-portal/policy';

const LOG_PATH = join(process.cwd(), 'data', 'decisions.json');

export interface DecisionRecord {
  id: string;
  createdAt: string;
  applicant: { name: string };
  batterySerial: string;
  requestedLoanAmountUsd: number;
  vehicleValueUsd: number;
  traces: {
    risk: ApiTrace<RiskResponse>;
    ltv: ApiTrace<LtvResponse>;
    residualValue: ApiTrace<ResidualValueResponse>;
    secondLife: ApiTrace<SecondLifeResponse>;
    attest?: ApiTrace<AttestResponse>;
  };
  underwriting: UnderwritingResult;
  /** Always present — the real attestationText for ACCEPT, a generated narrative otherwise. See lib/narrative.ts. */
  narrativeText: string;
}

function ensureLogFile(): void {
  if (!existsSync(LOG_PATH)) {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    writeFileSync(LOG_PATH, '[]\n');
  }
}

export function readDecisions(): DecisionRecord[] {
  ensureLogFile();
  return JSON.parse(readFileSync(LOG_PATH, 'utf-8'));
}

export function appendDecision(record: Omit<DecisionRecord, 'id' | 'createdAt'>): DecisionRecord {
  const full: DecisionRecord = { id: randomUUID(), createdAt: new Date().toISOString(), ...record };
  const existing = readDecisions();
  existing.unshift(full);
  writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2) + '\n');
  return full;
}

/**
 * Lender / tenant types for VoltLedger
 */

export type LenderTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface Lender {
  id: string;
  name: string;
  type: LenderType;
  tier: LenderTier;
  contactEmail: string;
  contactName: string;
  website?: string;
  createdAt: string;
  isActive: boolean;

  // Billing
  monthlyBatteryQuota?: number;     // null = unlimited (enterprise)
  batteriesUsedThisMonth: number;
  acvUsd: number;
}

export type LenderType =
  | 'BANK'
  | 'CREDIT_UNION'
  | 'CAPTIVE_FINANCE'
  | 'AUTO_FINTECH'
  | 'AUCTION_HOUSE'
  | 'INSURANCE'
  | 'REMARKETING';

export interface ApiKey {
  id: string;
  lenderId: string;
  keyPrefix: string;         // e.g. "vl_live_abc123..." — first 12 chars shown
  keyHash: string;           // bcrypt hash of full key
  label: string;
  status: ApiKeyStatus;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  permissions: ApiPermission[];
}

export type ApiPermission =
  | 'battery:read'
  | 'battery:write'
  | 'risk:read'
  | 'residual-value:read'
  | 'ltv:read'
  | 'second-life:read'
  | 'portfolio:read'
  | 'webhooks:manage';

export interface ApiUsageRecord {
  id: string;
  lenderId: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  batteryId?: string;
  statusCode: number;
  latencyMs: number;
  billedUnits: number;       // 1 per battery valuation call
  recordedAt: string;
}

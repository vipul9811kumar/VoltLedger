/**
 * API key validation and issuance.
 *
 * Key format:  vl_live_<32 hex chars>   (40 chars total)
 *              vl_test_<32 hex chars>   (40 chars total)
 *
 * DB stores:
 *   keyPrefix  — first 16 chars (e.g. "vl_live_a1b2c3d4")  used for fast lookup
 *   keyHash    — bcrypt hash of the full 40-char key         used for verification
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@voltledger/db';

const PREFIX_LEN = 16;       // chars used for DB lookup
const BCRYPT_ROUNDS = 10;

/** Generate a new API key string (NOT persisted here). */
export function generateKeyString(env: 'live' | 'test' = 'live'): string {
  return `vl_${env}_${crypto.randomBytes(16).toString('hex')}`;
}

/** Hash a raw key for DB storage. */
export async function hashKey(rawKey: string): Promise<string> {
  return bcrypt.hash(rawKey, BCRYPT_ROUNDS);
}

/**
 * Validate an incoming X-Api-Key header value.
 * Returns true if the key exists, is ACTIVE, not expired, and hash matches.
 */
export async function validateApiKey(rawKey: string): Promise<boolean> {
  if (!rawKey || rawKey.length < PREFIX_LEN) return false;

  try {
    const prefix = rawKey.slice(0, PREFIX_LEN);

    const record = await prisma.apiKey.findUnique({
      where: { keyPrefix: prefix },
      select: { keyHash: true, status: true, expiresAt: true, lastUsedAt: true },
    });

    if (!record) return false;
    if (record.status !== 'ACTIVE') return false;
    if (record.expiresAt && record.expiresAt < new Date()) return false;

    // Verify the full key against the stored hash
    const valid = await bcrypt.compare(rawKey, record.keyHash);
    if (!valid) return false;

    // Fire-and-forget: update lastUsedAt
    prisma.apiKey.update({
      where:  { keyPrefix: prefix },
      data:   { lastUsedAt: new Date() },
    }).catch(() => {/* non-critical */});

    return true;
  } catch {
    // If DB is unreachable in dev, fail open; in production always fail closed
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
}

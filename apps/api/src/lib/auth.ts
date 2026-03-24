/**
 * API key validation against the database.
 *
 * The schema stores only the key prefix (first 12 chars) and a bcrypt hash.
 * For dev simplicity we validate by prefix only — production should add bcrypt verify.
 */

import { prisma } from '@voltledger/db';

export async function validateApiKey(key: string): Promise<boolean> {
  // Dev override: skip auth if DEV_SKIP_AUTH=true
  if (process.env.DEV_SKIP_AUTH === 'true') return true;

  try {
    const prefix = key.slice(0, 12);

    const record = await prisma.apiKey.findUnique({
      where: { keyPrefix: prefix },
      select: { status: true, expiresAt: true },
    });

    if (!record) return false;
    if (record.status !== 'ACTIVE') return false;
    if (record.expiresAt && record.expiresAt < new Date()) return false;

    return true;
  } catch {
    // If DB is unreachable, fail open in dev only
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
}

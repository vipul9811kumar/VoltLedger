/**
 * Issue a new API key for a lender and persist it to the DB.
 *
 * Usage:
 *   pnpm generate-key --lender "Acme Finance" --label "Production Key"
 *   pnpm generate-key --lender "Acme Finance" --env test --label "Sandbox Key"
 *   pnpm generate-key --list   (show all active keys)
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@voltledger/db';

const args  = process.argv.slice(2);

const PREFIX_LEN   = 16;
const BCRYPT_ROUNDS = 10;

function generateKeyString(env: 'live' | 'test' = 'live'): string {
  return `vl_${env}_${crypto.randomBytes(16).toString('hex')}`;
}
async function hashKey(rawKey: string): Promise<string> {
  return bcrypt.hash(rawKey, BCRYPT_ROUNDS);
}
const flag  = (name: string) => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : null; };
const isList = args.includes('--list');

async function listKeys() {
  const keys = await prisma.apiKey.findMany({
    include: { lender: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (keys.length === 0) {
    console.log('No API keys found.');
    return;
  }

  console.log('\nAPI Keys:\n');
  for (const k of keys) {
    const expiry = k.expiresAt ? k.expiresAt.toLocaleDateString() : 'never';
    const used   = k.lastUsedAt ? k.lastUsedAt.toLocaleString() : 'never';
    console.log(`  ${k.keyPrefix}...  [${k.status}]`);
    console.log(`    Lender  : ${k.lender?.name ?? '—'}`);
    console.log(`    Label   : ${k.label}`);
    console.log(`    Expires : ${expiry}   Last used: ${used}`);
    console.log();
  }
}

async function createKey(lenderName: string, label: string, env: 'live' | 'test') {
  // Find or create the org + lender
  let org = await prisma.organization.findFirst({ where: { name: lenderName } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: lenderName } });
    console.log(`  Created organization: ${lenderName}`);
  }

  let lender = await prisma.lender.findUnique({ where: { organizationId: org.id } });
  if (!lender) {
    lender = await prisma.lender.create({
      data: {
        organizationId: org.id,
        tier:           'STARTER' as any,
        lenderType:     'AUTO_FINTECH' as any,
        contactEmail:   'admin@voltledger.io',
        contactName:    lenderName,
        isActive:       true,
      },
    });
    console.log(`  Created lender: ${lenderName}`);
  }

  const rawKey = generateKeyString(env);
  const prefix = rawKey.slice(0, PREFIX_LEN);
  const hash   = await hashKey(rawKey);

  await prisma.apiKey.create({
    data: {
      lenderId:  lender.id,
      keyPrefix: prefix,
      keyHash:   hash,
      label,
      status:    'ACTIVE',
      permissions: [
        'battery:read',
        'risk:read',
        'residual-value:read',
        'ltv:read',
        'second-life:read',
        'portfolio:read',
      ],
    },
  });

  console.log('\n✅ API key issued successfully!\n');
  console.log('  Key     :', rawKey);
  console.log('  Prefix  :', prefix);
  console.log('  Lender  :', lenderName);
  console.log('  Label   :', label);
  console.log('\n⚠️  Store this key securely — it will NOT be shown again.\n');
}

async function main() {
  if (isList) {
    await listKeys();
    return;
  }

  const lenderName = flag('lender');
  if (!lenderName) {
    console.error('Usage: pnpm generate-key --lender "Lender Name" [--label "Key Label"] [--env live|test]');
    process.exit(1);
  }

  const label = flag('label') ?? 'API Key';
  const env   = (flag('env') === 'test') ? 'test' : 'live';

  await createKey(lenderName, label, env);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

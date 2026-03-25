/**
 * POST /v1/provision — service-token only.
 * Called by the Clerk webhook handler (dashboard) when a new user signs up.
 *
 * 1. Finds an APPROVED EarlyAccessRequest matching the email.
 * 2. Creates Organization → Lender → LenderUser → ApiKey.
 * 3. Marks the EarlyAccessRequest with the Clerk user ID.
 * 4. Sends a welcome email with the plaintext API key (shown once).
 * Returns { provisioned: true, lenderId } or { provisioned: false }.
 */
import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@voltledger/db';
import { getResend, from } from './early-access';

const PREFIX_LEN    = 16;
const BCRYPT_ROUNDS = 10;

function roleToLenderType(role: string): string {
  const r = role.toLowerCase();
  if (r.includes('bank') || r.includes('lender'))      return 'BANK';
  if (r.includes('dealer') || r.includes('finance arm')) return 'CAPTIVE_FINANCE';
  if (r.includes('insurance') || r.includes('warranty')) return 'INSURANCE';
  if (r.includes('fleet'))                              return 'AUTO_FINTECH';
  if (r.includes('marketplace') || r.includes('auction')) return 'AUCTION_HOUSE';
  return 'AUTO_FINTECH';
}

async function sendWelcomeEmail(data: {
  firstName: string;
  email: string;
  company: string;
  rawApiKey: string;
  dashboardUrl: string;
}) {
  const resend = await getResend();
  if (!resend) return;

  await resend.emails.send({
    from: from(),
    to:   data.email,
    subject: 'Your VoltLedger account is ready',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <h1 style="font-size:22px;margin-bottom:8px">You're all set, ${data.firstName}!</h1>
        <p style="color:#475569;line-height:1.6">
          Your <strong>${data.company}</strong> account on VoltLedger is provisioned and ready to use.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0">
          <p style="font-size:12px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Your API Key</p>
          <p style="font-family:monospace;font-size:14px;color:#1e293b;word-break:break-all;margin:0">${data.rawApiKey}</p>
          <p style="font-size:11px;color:#94a3b8;margin:10px 0 0">
            Store this securely — it won't be shown again. Pass it as the <code>X-Api-Key</code> header on every request.
          </p>
        </div>

        <div style="margin:28px 0">
          <a href="${data.dashboardUrl}"
             style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
            Open Dashboard →
          </a>
        </div>

        <p style="color:#475569;line-height:1.6;font-size:14px">
          You're on the <strong>Starter plan</strong> — 100 battery assessments and 25 VIN lookups per month.
          Upgrade to Professional anytime from your account page.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8">⚡ VoltLedger — Financial-grade battery intelligence for lenders</p>
      </div>
    `,
  }).catch(err => console.error('[provision] welcome email failed:', err));
}

export const provisionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    const token = req.headers['x-service-token'];
    if (!token || token !== process.env.SERVICE_TOKEN) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  });

  app.post<{
    Body: { clerkUserId: string; email: string; firstName: string; lastName: string };
  }>('/', async (req, reply) => {
    const { clerkUserId, email, firstName, lastName } = req.body;

    // Already provisioned?
    const existing = await prisma.lenderUser.findUnique({ where: { clerkId: clerkUserId } });
    if (existing) {
      return reply.send({ provisioned: true, lenderId: existing.lenderId });
    }

    // Find an approved request for this email that hasn't been claimed yet
    const request = await prisma.earlyAccessRequest.findFirst({
      where: { email, status: 'APPROVED', clerkUserId: null },
    });

    if (!request) {
      return reply.send({ provisioned: false });
    }

    const dashboardUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://voltledger.io').trim();

    // Create Org → Lender → LenderUser → ApiKey in a transaction
    const rawKey = `vl_live_${crypto.randomBytes(16).toString('hex')}`;
    const prefix = rawKey.slice(0, PREFIX_LEN);
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

    const lender = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: request.company },
      });

      const newLender = await tx.lender.create({
        data: {
          organizationId:       org.id,
          tier:                 'STARTER' as any,
          lenderType:           roleToLenderType(request.role) as any,
          contactEmail:         email,
          contactName:          `${firstName} ${lastName}`,
          isActive:             true,
          monthlyBatteryQuota:  100,
          monthlyVinLookupQuota: 25,
        },
      });

      await tx.lenderUser.create({
        data: {
          clerkId:  clerkUserId,
          email,
          name:     `${firstName} ${lastName}`,
          role:     'OWNER',
          lenderId: newLender.id,
        },
      });

      await tx.apiKey.create({
        data: {
          lenderId:    newLender.id,
          keyPrefix:   prefix,
          keyHash,
          label:       'Default Key',
          status:      'ACTIVE',
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

      await tx.earlyAccessRequest.update({
        where: { id: request.id },
        data:  { clerkUserId },
      });

      return newLender;
    });

    sendWelcomeEmail({ firstName, email, company: request.company, rawApiKey: rawKey, dashboardUrl })
      .catch(err => console.error('[provision] email error:', err));

    return reply.status(201).send({ provisioned: true, lenderId: lender.id });
  });
};

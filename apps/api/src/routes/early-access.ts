import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voltledger/db';

const bodySchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName:  z.string().min(1).max(80),
  email:     z.string().email(),
  company:   z.string().min(1).max(120),
  role:      z.string().min(1).max(80),
});

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email');
    return null;
  }
  const { Resend } = await import('resend');
  return new Resend(apiKey);
}

function from() {
  return (process.env.EMAIL_FROM ?? 'VoltLedger <onboarding@resend.dev>').trim();
}

export async function sendRequestReceivedEmail(data: {
  firstName: string; lastName: string; email: string; company: string; role: string;
}) {
  const resend = await getResend();
  if (!resend) return;
  const notifyAddress = (process.env.EMAIL_NOTIFY ?? 'hello@voltledger.io').trim();
  const dashboardUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://voltledger.io').trim();

  // 1. Notify admin
  await resend.emails.send({
    from: from(),
    to:   notifyAddress,
    subject: `New early access request — ${data.company} (${data.role})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e293b">New Early Access Request</h2>
        <table style="border-collapse:collapse;font-size:14px;width:100%">
          <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b;width:100px">Name</td>   <td style="padding:8px 12px"><strong>${data.firstName} ${data.lastName}</strong></td></tr>
          <tr>                           <td style="padding:8px 12px;color:#64748b">Email</td>  <td style="padding:8px 12px"><a href="mailto:${data.email}">${data.email}</a></td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b">Company</td><td style="padding:8px 12px">${data.company}</td></tr>
          <tr>                           <td style="padding:8px 12px;color:#64748b">Role</td>   <td style="padding:8px 12px">${data.role}</td></tr>
        </table>
        <div style="margin-top:20px">
          <a href="${dashboardUrl}/admin/requests"
             style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600">
            Review in Admin →
          </a>
        </div>
        <p style="margin-top:16px;font-size:12px;color:#94a3b8">Submitted at ${new Date().toISOString()}</p>
      </div>
    `,
  }).catch(err => console.error('[email] admin notify failed:', err));

  // 2. Confirm to requestor
  await resend.emails.send({
    from: from(),
    to:   data.email,
    subject: `You're on the VoltLedger early access list`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1e293b">
        <h1 style="font-size:22px;margin-bottom:8px">Thanks, ${data.firstName}!</h1>
        <p style="color:#475569;line-height:1.6">
          We've received your request for early access to VoltLedger. Our team will review
          it and reach out within <strong>48 hours</strong>.
        </p>
        <p style="color:#475569;line-height:1.6;margin-top:12px">
          Once approved, you'll receive a separate email with your dashboard access link.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8">⚡ VoltLedger — Financial-grade battery intelligence for lenders</p>
      </div>
    `,
  }).catch(err => console.error('[email] requestor confirm failed:', err));
}

export async function sendApprovalEmail(data: {
  firstName: string; email: string; company: string;
}) {
  const resend = await getResend();
  if (!resend) return;
  const dashboardUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://voltledger.io').trim();
  const signUpUrl    = `${dashboardUrl}/sign-up`;

  await resend.emails.send({
    from: from(),
    to:   data.email,
    subject: `You're approved — Welcome to VoltLedger`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1e293b">
        <h1 style="font-size:22px;margin-bottom:8px">Welcome aboard, ${data.firstName}! 🎉</h1>
        <p style="color:#475569;line-height:1.6">
          Your early access request for <strong>${data.company}</strong> has been approved.
          You can now sign up and start using the VoltLedger lender dashboard.
        </p>
        <div style="margin:28px 0">
          <a href="${signUpUrl}"
             style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
            Create Your Account →
          </a>
        </div>
        <p style="color:#475569;line-height:1.6;font-size:14px">
          You'll start on the <strong>Starter plan</strong> — 100 battery assessments and 25 VIN lookups per month.
          You can upgrade to Professional anytime from your account page.
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-top:20px;font-size:13px;color:#64748b">
          <strong>What's included in Starter:</strong>
          <ul style="margin:8px 0;padding-left:20px;line-height:1.8">
            <li>100 battery risk assessments / month</li>
            <li>25 VIN lookups / month</li>
            <li>SoH trending &amp; telemetry history</li>
            <li>REST API access</li>
          </ul>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8">⚡ VoltLedger — Financial-grade battery intelligence for lenders</p>
      </div>
    `,
  }).catch(err => console.error('[email] approval email failed:', err));
}

export async function sendRejectionEmail(data: {
  firstName: string; email: string; notes?: string | null;
}) {
  const resend = await getResend();
  if (!resend) return;

  await resend.emails.send({
    from: from(),
    to:   data.email,
    subject: `Your VoltLedger access request`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1e293b">
        <h1 style="font-size:22px;margin-bottom:8px">Hi ${data.firstName},</h1>
        <p style="color:#475569;line-height:1.6">
          Thank you for your interest in VoltLedger. After reviewing your request, we're
          not able to offer access at this time.
        </p>
        ${data.notes ? `<p style="color:#475569;line-height:1.6">${data.notes}</p>` : ''}
        <p style="color:#475569;line-height:1.6;margin-top:12px">
          Feel free to reach out to <a href="mailto:hello@voltledger.io" style="color:#3b82f6">hello@voltledger.io</a> if you have questions.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8">⚡ VoltLedger — Financial-grade battery intelligence for lenders</p>
      </div>
    `,
  }).catch(err => console.error('[email] rejection email failed:', err));
}

export const earlyAccessRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, _reply) => {
    (req as any)._skipAuth = true;
  });

  app.post<{ Body: unknown }>('/', async (req, reply) => {
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error.flatten() });
    }

    const { firstName, lastName, email, company, role } = result.data;

    const record = await prisma.earlyAccessRequest.upsert({
      where:  { email },
      update: { firstName, lastName, company, role, status: 'PENDING' },
      create: { firstName, lastName, email, company, role },
    });

    sendRequestReceivedEmail(result.data).catch(err =>
      console.error('[early-access] email error:', err)
    );

    return reply.status(201).send({
      id:      record.id,
      message: "Request received. We'll be in touch within 48 hours.",
    });
  });
};
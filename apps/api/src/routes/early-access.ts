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

async function sendEmails(data: z.infer<typeof bodySchema>) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[early-access] RESEND_API_KEY not set — skipping email send');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const fromAddress = process.env.EMAIL_FROM ?? 'VoltLedger <noreply@voltledger.io>';
  const notifyAddress = process.env.EMAIL_NOTIFY ?? 'hello@voltledger.io';

  // 1. Notify the team
  await resend.emails.send({
    from: fromAddress,
    to:   notifyAddress,
    subject: `New early access request — ${data.company} (${data.role})`,
    html: `
      <h2>New Early Access Request</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="padding:6px 12px;color:#6b7280">Name</td>   <td style="padding:6px 12px"><strong>${data.firstName} ${data.lastName}</strong></td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280">Email</td>  <td style="padding:6px 12px"><a href="mailto:${data.email}">${data.email}</a></td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280">Company</td><td style="padding:6px 12px">${data.company}</td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280">Role</td>   <td style="padding:6px 12px">${data.role}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:13px;color:#6b7280">
        Submitted at ${new Date().toISOString()}
      </p>
    `,
  });

  // 2. Confirm to the requester
  await resend.emails.send({
    from: fromAddress,
    to:   data.email,
    subject: `You're on the VoltLedger early access list`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#1e293b">
        <h1 style="font-size:22px;margin-bottom:8px">Thanks, ${data.firstName}!</h1>
        <p style="color:#475569;line-height:1.6">
          We've received your request for early API access. Our team will review it and
          reach out within <strong>48 hours</strong> to schedule a 20-minute onboarding call.
        </p>
        <p style="color:#475569;line-height:1.6;margin-top:12px">
          In the meantime, feel free to explore our
          <a href="https://vipul9811kumar.github.io/VoltLedger/" style="color:#3b82f6">landing page</a>
          to see what the API covers.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8">
          ⚡ VoltLedger — Financial-grade battery intelligence for lenders
        </p>
      </div>
    `,
  });
}

export const earlyAccessRoutes: FastifyPluginAsync = async (app) => {
  // Skip auth for this public endpoint
  app.addHook('onRequest', async (req, reply) => {
    (req as any)._skipAuth = true;
  });

  app.post<{ Body: unknown }>('/', async (req, reply) => {
    const result = bodySchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request', details: result.error.flatten() });
    }

    const { firstName, lastName, email, company, role } = result.data;

    // Upsert: if same email re-submits, update their info
    const record = await prisma.earlyAccessRequest.upsert({
      where:  { email },
      update: { firstName, lastName, company, role },
      create: { firstName, lastName, email, company, role },
    });

    // Fire emails async — don't block the response
    sendEmails(result.data).catch(err =>
      console.error('[early-access] email send error:', err)
    );

    return reply.status(201).send({
      id:      record.id,
      message: 'Request received. We\'ll be in touch within 48 hours.',
    });
  });
};

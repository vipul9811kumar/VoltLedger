export const dynamic = 'force-dynamic';

import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UpgradeButton } from './UpgradeButton';
import { BillingPortalButton } from './BillingPortalButton';

async function getLenderAccount(clerkUserId: string) {
  const API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${API_URL}/v1/account`, {
    headers: {
      'x-service-token':  process.env.SERVICE_TOKEN ?? '',
      'x-clerk-user-id':  clerkUserId,
    },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

const PLAN_LABELS: Record<string, string> = {
  STARTER:      'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE:   'Enterprise',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'text-emerald-400',
  TRIALING:   'text-blue-400',
  PAST_DUE:   'text-amber-400',
  CANCELLED:  'text-red-400',
  INCOMPLETE: 'text-slate-400',
};

function UsageBar({ used, quota, label }: { used: number; quota: number | null; label: string }) {
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-mono">
          {used.toLocaleString()} / {quota === null ? '∞' : quota.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        {quota !== null && (
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}

export default async function AccountPage() {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const user = await currentUser();
  const account = await getLenderAccount(userId);

  const tier = account?.tier ?? 'STARTER';
  const status = account?.subscriptionStatus ?? 'TRIALING';
  const isEnterprise = tier === 'ENTERPRISE';
  const canUpgrade = tier === 'STARTER';
  const hasStripe = !!account?.stripeSubscriptionId;

  const periodEnd = account?.currentPeriodEnd
    ? new Date(account.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Account</h1>
        <p className="text-slate-500 text-sm mt-1">{user?.emailAddresses[0]?.emailAddress}</p>
      </div>

      {/* Plan card */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Current Plan</p>
            <p className="text-xl font-bold text-white mt-1">{PLAN_LABELS[tier]}</p>
          </div>
          <span className={`text-xs font-semibold ${STATUS_COLORS[status] ?? 'text-slate-400'}`}>
            {status.replace('_', ' ')}
          </span>
        </div>

        {periodEnd && (
          <p className="text-xs text-slate-500">Billing period ends {periodEnd}</p>
        )}

        <div className="flex gap-3 pt-2">
          {canUpgrade && (
            <UpgradeButton />
          )}
          {hasStripe && (
            <BillingPortalButton />
          )}
          {isEnterprise && (
            <a href="mailto:hello@voltledger.io" className="px-4 py-2 text-sm text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors">
              Contact Account Manager
            </a>
          )}
        </div>
      </div>

      {/* Usage card */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-6 space-y-5">
        <p className="text-sm font-semibold text-white">Usage This Month</p>
        <UsageBar
          label="Batteries scored"
          used={account?.batteriesUsedThisMonth ?? 0}
          quota={account?.monthlyBatteryQuota ?? null}
        />
        <UsageBar
          label="VIN lookups"
          used={account?.vinLookupsUsedThisMonth ?? 0}
          quota={account?.monthlyVinLookupQuota ?? null}
        />
        {canUpgrade && (account?.batteriesUsedThisMonth ?? 0) >= (account?.monthlyBatteryQuota ?? 100) * 0.8 && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            You&apos;re approaching your monthly limit. Upgrade to Professional for 5× more capacity.
          </p>
        )}
      </div>

      {/* Plan comparison hint */}
      {canUpgrade && (
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-6 space-y-3">
          <p className="text-sm font-semibold text-white">Unlock with Professional — $799/mo</p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            {[
              '500 batteries / month (5× more)',
              'Unlimited VIN lookups within quota',
              'Residual value estimates',
              'LTV recommendations',
              'Second-life assessments',
              'Portfolio analytics + webhooks',
            ].map(f => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-emerald-400 text-xs">✓</span> {f}
              </li>
            ))}
          </ul>
          <UpgradeButton label="Upgrade to Professional →" />
        </div>
      )}
    </div>
  );
}
export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ApproveButton, RejectButton } from './Actions';

async function getRequests(): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const API_URL = process.env.INTERNAL_API_URL!;
    const res = await fetch(`${API_URL}/v1/admin/early-access`, {
      headers: { 'x-service-token': process.env.SERVICE_TOKEN! },
      cache: 'no-store',
    });
    if (!res.ok) return { data: null, error: `API returned ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (err: any) {
    return { data: null, error: err?.message ?? 'Could not reach API' };
  }
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:  'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  APPROVED: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20',
  REJECTED: 'bg-red-400/10 text-red-400 border border-red-400/20',
};

export default async function AdminRequestsPage() {
  const { userId, sessionClaims } = auth();
  if (!userId) redirect('/sign-in');

  const meta      = sessionClaims?.publicMetadata as any;
  const isAdmin   = meta?.isAdmin === true;
  const adminId   = process.env.ADMIN_CLERK_USER_ID;
  const isAllowed = isAdmin || (adminId && userId === adminId);
  if (!isAllowed) redirect('/');

  const { data: requests, error } = await getRequests();
  const pending  = requests?.filter(r => r.status === 'PENDING') ?? [];
  const resolved = requests?.filter(r => r.status !== 'PENDING') ?? [];

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Early Access Requests</h1>
        <p className="text-slate-500 text-sm mt-1">{pending.length} pending · {resolved.length} resolved</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 font-semibold text-sm">Could not load requests</p>
          <p className="text-red-300/70 text-xs font-mono mt-1">{error}</p>
          <p className="text-slate-500 text-xs mt-2">Check INTERNAL_API_URL and SERVICE_TOKEN in Railway.</p>
        </div>
      )}

      {!error && requests?.length === 0 && (
        <p className="text-slate-500 text-sm">No requests yet.</p>
      )}

      {!error && [
        { label: 'Pending', items: pending },
        { label: 'Resolved', items: resolved },
      ].map(({ label, items }) => items.length > 0 && (
        <div key={label} className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          {items.map((r: any) => (
            <div key={r.id} className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">{r.firstName} {r.lastName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{r.email}</p>
                  <p className="text-sm text-slate-500">{r.company} · {r.role}</p>
                  {r.notes && <p className="text-xs text-slate-500 italic mt-1">{r.notes}</p>}
                  <p className="text-xs text-slate-600 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                {r.status === 'PENDING' && (
                  <div className="flex gap-2 shrink-0">
                    <ApproveButton id={r.id} />
                    <RejectButton  id={r.id} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
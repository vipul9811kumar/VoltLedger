'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApproveButton({ id }: { id: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const router = useRouter();

  async function handle() {
    if (!confirm('Approve this request and send the access email?')) return;
    setState('loading');
    try {
      const res = await fetch(`/api/admin/early-access/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Status ${res.status}`);
      setState('done');
      setTimeout(() => { router.refresh(); setState('idle'); }, 1200);
    } catch (err: any) {
      alert(`Approval failed: ${err?.message ?? 'Unknown error'}`);
      setState('idle');
    }
  }

  return (
    <button
      onClick={handle}
      disabled={state === 'loading' || state === 'done'}
      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
    >
      {state === 'loading' ? '…' : state === 'done' ? '✓ Approved' : 'Approve'}
    </button>
  );
}

export function RejectButton({ id }: { id: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const router = useRouter();

  async function handle() {
    const notes = prompt('Optional note to include in rejection email:');
    if (notes === null) return; // cancelled
    setState('loading');
    try {
      const res = await fetch(`/api/admin/early-access/${id}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Status ${res.status}`);
      setState('done');
      setTimeout(() => { router.refresh(); setState('idle'); }, 1200);
    } catch (err: any) {
      alert(`Rejection failed: ${err?.message ?? 'Unknown error'}`);
      setState('idle');
    }
  }

  return (
    <button
      onClick={handle}
      disabled={state === 'loading' || state === 'done'}
      className="px-3 py-1.5 bg-red-600/80 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
    >
      {state === 'loading' ? '…' : state === 'done' ? '✓ Rejected' : 'Reject'}
    </button>
  );
}

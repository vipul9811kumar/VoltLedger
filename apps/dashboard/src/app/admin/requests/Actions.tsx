'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApproveButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!confirm('Approve this request and send access email?')) return;
    setLoading(true);
    await fetch(`/api/admin/early-access/${id}/approve`, { method: 'POST' });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
    >
      {loading ? '…' : 'Approve'}
    </button>
  );
}

export function RejectButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    const notes = prompt('Optional note to include in rejection email:') ?? undefined;
    if (notes === null) return; // cancelled
    setLoading(true);
    await fetch(`/api/admin/early-access/${id}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="px-3 py-1.5 bg-red-600/80 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
    >
      {loading ? '…' : 'Reject'}
    </button>
  );
}
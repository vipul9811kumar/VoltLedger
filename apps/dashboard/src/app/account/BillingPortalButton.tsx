'use client';

import { useState } from 'react';

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 text-sm text-slate-300 border border-[#1e2d40] rounded-lg hover:border-slate-500 transition-colors disabled:opacity-50"
    >
      {loading ? '…' : 'Manage Billing'}
    </button>
  );
}
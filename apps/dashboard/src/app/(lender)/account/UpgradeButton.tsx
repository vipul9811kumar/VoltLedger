'use client';

import { useState } from 'react';

export function UpgradeButton({ label = 'Upgrade Plan' }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
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
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      {loading ? 'Redirecting…' : label}
    </button>
  );
}
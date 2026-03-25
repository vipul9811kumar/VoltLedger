'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function BatterySearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError('');

    try {
      const param = q.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/i.test(q)
        ? `vin=${encodeURIComponent(q)}`
        : `id=${encodeURIComponent(q)}`;
      const res = await fetch(`/api/battery/lookup?${param}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Not found (${res.status})`);
        return;
      }

      const battery = await res.json();
      router.push(`/battery/${battery.serialNumber}`);
    } catch {
      setError('Search failed — check connection');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setError(''); }}
          placeholder="Search by VIN or Battery ID…"
          className="w-72 bg-[#0d1526] border border-[#1e2d40] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {error && (
          <p className="absolute top-full mt-1 left-0 text-xs text-red-400 whitespace-nowrap">{error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        {loading ? '…' : 'Lookup'}
      </button>
    </form>
  );
}
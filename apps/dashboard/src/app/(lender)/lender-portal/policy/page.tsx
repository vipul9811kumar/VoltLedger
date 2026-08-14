'use client';

import { useEffect, useState } from 'react';
import type { PolicyTable, UnderwritingDecision } from '@/lib/lender-portal/policy';

const GRADES = ['A', 'B', 'C', 'D', 'F'] as const;
const DECISIONS: UnderwritingDecision[] = ['ACCEPT', 'REFER', 'DECLINE'];

export default function PolicyPage() {
  const [policy, setPolicy] = useState<PolicyTable | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/lender-portal/policy')
      .then((r) => r.json())
      .then(setPolicy);
  }, []);

  function updateBand(grade: (typeof GRADES)[number], field: string, value: string | number) {
    if (!policy) return;
    setSaved(false);
    setPolicy({
      ...policy,
      bands: {
        ...policy.bands,
        [grade]: { ...policy.bands[grade], [field]: value },
      },
    });
  }

  async function handleSave() {
    if (!policy) return;
    setSaving(true);
    await fetch('/api/lender-portal/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!policy) return <p className="text-slate-400">Loading policy…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Lender policy table</h2>
        <p className="text-sm text-slate-400 mt-1">
          Maps VoltLedger&apos;s risk grade to your LTV cap, rate premium, and decision. Edited
          here, applied live to the next application submitted — nothing hardcoded.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left label border-b border-border">
              <th className="py-2 pr-4">Grade</th>
              <th className="py-2 pr-4">LTV cap %</th>
              <th className="py-2 pr-4">Rate premium (bps)</th>
              <th className="py-2 pr-4">Decision</th>
            </tr>
          </thead>
          <tbody>
            {GRADES.map((grade) => {
              const band = policy.bands[grade];
              return (
                <tr key={grade} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <span className={`grade-${grade} px-2 py-0.5 rounded font-mono text-xs`}>{grade}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      className="input w-24"
                      type="number"
                      value={band.ltvCapPct}
                      onChange={(e) => updateBand(grade, 'ltvCapPct', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      className="input w-28"
                      type="number"
                      value={band.ratePremiumBps}
                      onChange={(e) => updateBand(grade, 'ratePremiumBps', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      className="input w-32"
                      value={band.decision}
                      onChange={(e) => updateBand(grade, 'decision', e.target.value)}
                    >
                      {DECISIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded bg-accent hover:bg-accent-hover text-white font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save policy'}
        </button>
        {saved ? <span className="text-sm text-emerald-400">Saved.</span> : null}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { DecisionRecord } from '@/lib/lender-portal/decisions-log';
import { DecisionResult } from '@/components/lender-portal/DecisionResult';

export function DecisionsListClient({ decisions }: { decisions: DecisionRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (decisions.length === 0) {
    return <p className="text-slate-400">No applications submitted yet.</p>;
  }

  return (
    <div className="space-y-3">
      {decisions.map((d) => (
        <div key={d.id} className="card">
          <button
            onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-100">{d.applicant.name}</span>
              <span className="text-sm font-mono text-slate-400">{d.batterySerial}</span>
              <span className="text-sm text-slate-500">${d.requestedLoanAmountUsd.toLocaleString()}</span>
              <span className="text-xs text-slate-600">{new Date(d.createdAt).toLocaleString()}</span>
            </div>
            <span className={`decision-${d.underwriting.finalDecision} text-xs px-2 py-1 rounded font-medium`}>
              {d.underwriting.finalDecision}
            </span>
          </button>
          {expandedId === d.id ? (
            <div className="mt-4 pt-4 border-t border-border">
              <DecisionResult record={d} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

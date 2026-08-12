'use client';

import { useState } from 'react';
import type { DecisionRecord } from '@/lib/decisions-log';
import { DecisionResult } from '@/components/DecisionResult';

interface LookupPreview {
  serialNumber: string;
  vin?: string | null;
  chemistry: string;
  nominalCapacityKwh: number;
  status: string;
  batteryModel?: { manufacturer: string; modelName: string };
  riskScores?: Array<{ compositeScore: number; grade: string }>;
}

export default function NewApplicationPage() {
  const [applicantName, setApplicantName] = useState('');
  const [batterySerial, setBatterySerial] = useState('');
  const [requestedLoanAmountUsd, setRequestedLoanAmountUsd] = useState('25000');
  const [vehicleValueUsd, setVehicleValueUsd] = useState('35000');

  const [lookupPreview, setLookupPreview] = useState<LookupPreview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<DecisionRecord | null>(null);

  async function handleLookup() {
    if (!batterySerial) return;
    setLooking(true);
    setLookupError(null);
    setLookupPreview(null);
    try {
      const res = await fetch(`/api/lookup-battery?serial=${encodeURIComponent(batterySerial)}`);
      const trace = await res.json();
      if (!trace.ok) {
        setLookupError(trace.response?.body?.error ?? `Lookup failed (${trace.response?.status})`);
      } else {
        setLookupPreview(trace.response.body);
      }
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLooking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const res = await fetch('/api/underwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          batterySerial,
          requestedLoanAmountUsd: Number(requestedLoanAmountUsd),
          vehicleValueUsd: Number(vehicleValueUsd),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body.error ?? `Underwriting failed (${res.status})`);
        return;
      }
      setResult(body as DecisionRecord);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Underwriting failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">New loan application</h1>
        <p className="text-sm text-slate-400 mt-1">
          Enters the same collateral-risk enrichment step a real LOS runs mid-underwriting —
          calls VoltLedger&apos;s live <code>/v1/risk</code>, <code>/v1/ltv</code>, and{' '}
          <code>/v1/residual-value</code> endpoints, applies your lender policy, and decides.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4 max-w-2xl">
        <div>
          <label className="label block mb-1">Applicant name</label>
          <input className="input" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required />
        </div>

        <div>
          <label className="label block mb-1">Battery serial</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={batterySerial}
              onChange={(e) => setBatterySerial(e.target.value)}
              placeholder="e.g. CATL-US-23-00001"
              required
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={looking || !batterySerial}
              className="px-4 py-2 rounded bg-navy border border-border text-sm text-slate-200 hover:border-accent disabled:opacity-50"
            >
              {looking ? 'Looking up…' : 'Look up'}
            </button>
          </div>
          {lookupError ? <p className="text-xs text-red-400 mt-1">{lookupError}</p> : null}
          {lookupPreview ? (
            <div className="mt-2 text-sm bg-navy border border-border rounded p-3">
              <span className="text-slate-100">
                {lookupPreview.batteryModel?.manufacturer} {lookupPreview.batteryModel?.modelName}
              </span>
              <span className="text-slate-500"> · {lookupPreview.chemistry} · {lookupPreview.nominalCapacityKwh}kWh</span>
              {lookupPreview.riskScores?.[0] ? (
                <span className={`grade-${lookupPreview.riskScores[0].grade} ml-2 px-2 py-0.5 rounded text-xs font-mono`}>
                  Grade {lookupPreview.riskScores[0].grade}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1">Requested loan amount (USD)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={requestedLoanAmountUsd}
              onChange={(e) => setRequestedLoanAmountUsd(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label block mb-1">Vehicle purchase price (USD)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={vehicleValueUsd}
              onChange={(e) => setVehicleValueUsd(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded bg-accent hover:bg-accent-hover text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'Underwriting…' : 'Submit application'}
        </button>
        {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}
      </form>

      {result ? (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-3">Decision</h2>
          <DecisionResult record={result} />
        </div>
      ) : null}
    </div>
  );
}

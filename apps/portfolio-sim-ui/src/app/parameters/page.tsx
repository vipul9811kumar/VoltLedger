'use client';

import { useEffect, useState } from 'react';
import type { SimLoanOutcome } from '@voltledger/db';
import type { MethodologyParams } from '@/lib/params';
import { summarizeArm, cohortBreakdown } from '@/lib/aggregate';
import { RunSummary } from '@/components/RunSummary';
import { CohortTable } from '@/components/CohortTable';

type RunResult = {
  id: string;
  nLoans: number;
  seed: number;
  runAt: string;
  provenance: string;
  outcomes: SimLoanOutcome[];
};

export default function ParametersPage() {
  const [params, setParams] = useState<MethodologyParams | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [n, setN] = useState('300');
  const [seed, setSeed] = useState('42');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    fetch('/api/parameters').then((r) => r.json()).then(setParams);
  }, []);

  function update<K extends keyof MethodologyParams>(key: K, value: MethodologyParams[K]) {
    if (!params) return;
    setSaved(false);
    setParams({ ...params, [key]: value });
  }

  function updateNested<K extends 'ltvBandMultipliers' | 'gradeMultipliers'>(
    key: K,
    field: string,
    value: number,
  ) {
    if (!params) return;
    setSaved(false);
    setParams({ ...params, [key]: { ...params[key], [field]: value } });
  }

  async function handleSave() {
    if (!params) return;
    setSaving(true);
    await fetch('/api/parameters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    setSaving(false);
    setSaved(true);
  }

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch('/api/run-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: Number(n), seed: Number(seed) }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRunError(body.error ?? `Run failed (${res.status})`);
        return;
      }
      setResult(body as RunResult);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  if (!params) return <p className="text-slate-400">Loading parameters…</p>;

  const withSummary = result ? summarizeArm(result.outcomes.filter((o) => o.arm === 'WITH')) : null;
  const withoutSummary = result ? summarizeArm(result.outcomes.filter((o) => o.arm === 'WITHOUT')) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Methodology parameters</h1>
        <p className="text-sm text-slate-400 mt-1">
          Illustrative, hand-set assumptions (Gate D sign-off) — nothing here is fitted to real
          default/recovery data. Edit freely; every run stays labeled SIMULATED_CALIBRATED
          regardless of these values. See{' '}
          <code>tools/portfolio-sim/METHODOLOGY.md</code> for the full spec.
        </p>
      </div>

      <div className="card space-y-4 max-w-2xl">
        <div>
          <label className="label block mb-1">Baseline annual default probability</label>
          <input
            className="input"
            type="number"
            step="0.001"
            value={params.baselineAnnualDefaultProbability}
            onChange={(e) => update('baselineAnnualDefaultProbability', Number(e.target.value))}
          />
        </div>

        <div>
          <label className="label block mb-2">LTV-band multipliers</label>
          <div className="grid grid-cols-4 gap-2">
            {(['under60', '60to75', '75to85', 'over85'] as const).map((band) => (
              <div key={band}>
                <label className="text-xs text-slate-500 block mb-1">{band}</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={params.ltvBandMultipliers[band]}
                  onChange={(e) => updateNested('ltvBandMultipliers', band, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label block mb-2">Grade multipliers</label>
          <div className="grid grid-cols-5 gap-2">
            {(['A', 'B', 'C', 'D', 'F'] as const).map((grade) => (
              <div key={grade}>
                <label className="text-xs text-slate-500 block mb-1">{grade}</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  value={params.gradeMultipliers[grade]}
                  onChange={(e) => updateNested('gradeMultipliers', grade, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1">WITHOUT-arm flat LTV cap (%)</label>
            <input
              className="input"
              type="number"
              value={params.withoutPolicyFlatLtvPct}
              onChange={(e) => update('withoutPolicyFlatLtvPct', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label block mb-1">WITHOUT-arm flat rate (bps)</label>
            <input
              className="input"
              type="number"
              value={params.withoutPolicyFlatRateBps}
              onChange={(e) => update('withoutPolicyFlatRateBps', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label block mb-1">Repossession/liquidation discount (%)</label>
            <input
              className="input"
              type="number"
              value={params.repossessionLiquidationDiscountPct}
              onChange={(e) => update('repossessionLiquidationDiscountPct', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label block mb-1">Loan term (months)</label>
            <input
              className="input"
              type="number"
              value={params.loanTermMonths}
              onChange={(e) => update('loanTermMonths', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded bg-navy border border-border text-sm text-slate-200 hover:border-accent disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save parameters'}
          </button>
          {saved ? <span className="text-sm text-emerald-400">Saved.</span> : null}
        </div>
      </div>

      <div className="card space-y-4 max-w-2xl">
        <h2 className="font-medium text-slate-100">Run simulation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1">Number of loans</label>
            <input className="input" type="number" min="1" max="2000" value={n} onChange={(e) => setN(e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1">Seed</label>
            <input className="input" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="px-5 py-2.5 rounded bg-accent hover:bg-accent-hover text-white font-medium disabled:opacity-50"
        >
          {running ? 'Running simulation…' : 'Run simulation'}
        </button>
        {runError ? <p className="text-sm text-red-400">{runError}</p> : null}
      </div>

      {result && withSummary && withoutSummary ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">New run result</h2>
          <RunSummary
            nLoans={result.nLoans}
            seed={result.seed}
            runAt={result.runAt}
            provenance={result.provenance}
            withSummary={withSummary}
            withoutSummary={withoutSummary}
          />
          <CohortTable title="By chemistry" rows={cohortBreakdown(result.outcomes, (o) => o.chemistry)} />
          <CohortTable title="By segment" rows={cohortBreakdown(result.outcomes, (o) => o.segment)} />
        </div>
      ) : null}
    </div>
  );
}

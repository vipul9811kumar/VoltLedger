import type { DecisionRecord } from '@/lib/decisions-log';
import { TraceCard } from './TraceCard';

export function DecisionResult({ record }: { record: DecisionRecord }) {
  const { underwriting, traces } = record;
  const grade = traces.risk.ok ? traces.risk.response.body.grade : null;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="label">Applicant</div>
            <div className="text-slate-100">{record.applicant.name}</div>
          </div>
          <div>
            <div className="label">Battery</div>
            <div className="text-slate-100 font-mono">{record.batterySerial}</div>
          </div>
          <div>
            <div className="label">Requested</div>
            <div className="text-slate-100">${record.requestedLoanAmountUsd.toLocaleString()}</div>
          </div>
          <div>
            <div className="label">Vehicle value</div>
            <div className="text-slate-100">${record.vehicleValueUsd.toLocaleString()}</div>
          </div>
          {grade ? (
            <span className={`grade-${grade} text-sm font-mono px-2 py-1 rounded`}>Grade {grade}</span>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <TraceCard title="GET /v1/batteries/:serial/risk" trace={traces.risk} />
        <TraceCard title="GET /v1/batteries/:serial/ltv" trace={traces.ltv} />
        <TraceCard title="GET /v1/batteries/:serial/residual-value" trace={traces.residualValue} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-slate-100">Lender policy applied</h3>
          <span className={`decision-${underwriting.finalDecision} text-sm px-3 py-1 rounded font-medium`}>
            {underwriting.finalDecision}
          </span>
        </div>
        <p className="text-sm text-slate-400 mb-2">{underwriting.reason}</p>
        {underwriting.downgradedFromAccept ? (
          <p className="text-xs text-yellow-400">
            Downgraded from the policy table's default ACCEPT for this grade — requested amount exceeds the computed LTV cap.
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
          <div>
            <div className="label">Final LTV cap</div>
            <div className="text-slate-100">{underwriting.finalLtvPct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="label">Rate premium</div>
            <div className="text-slate-100">+{underwriting.band.ratePremiumBps}bps</div>
          </div>
          <div>
            <div className="label">Policy band</div>
            <div className="text-slate-100">{grade ?? '—'}</div>
          </div>
        </div>
      </div>

      {traces.attest ? (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-slate-100">Origination attestation</h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400">
              POST → {traces.attest.response.status}
            </span>
          </div>
          {traces.attest.ok ? (
            <>
              <p className="label mb-1">Audit ID</p>
              <p className="font-mono text-sm text-slate-100 mb-3">{traces.attest.response.body.auditId}</p>
              <pre className="text-sm bg-navy border border-border rounded p-3 whitespace-pre-wrap">
                {traces.attest.response.body.attestationText}
              </pre>
            </>
          ) : (
            <pre className="text-xs bg-navy border border-border rounded p-3 overflow-x-auto">
              {JSON.stringify(traces.attest.response.body, null, 2)}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}

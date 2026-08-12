import type { ApiTrace } from '@/lib/voltledger-client';

export function TraceCard<T>({ title, trace }: { title: string; trace: ApiTrace<T> }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-slate-100">{title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded font-mono ${
            trace.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {trace.request.method} → {trace.response.status}
        </span>
      </div>
      <p className="label mb-2">{trace.request.url.replace(/^https?:\/\/[^/]+/, '')}</p>
      <details>
        <summary className="text-xs text-accent cursor-pointer select-none">
          Inspect raw request / response
        </summary>
        <div className="mt-2 space-y-2">
          {trace.request.body ? (
            <div>
              <div className="label">Request body</div>
              <pre className="text-xs bg-navy border border-border rounded p-3 overflow-x-auto">
                {JSON.stringify(trace.request.body, null, 2)}
              </pre>
            </div>
          ) : null}
          <div>
            <div className="label">Response body</div>
            <pre className="text-xs bg-navy border border-border rounded p-3 overflow-x-auto">
              {JSON.stringify(trace.response.body, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

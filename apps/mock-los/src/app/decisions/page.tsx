import { readDecisions } from '@/lib/decisions-log';
import { DecisionsListClient } from './DecisionsListClient';

export const dynamic = 'force-dynamic';

export default function DecisionsPage() {
  const decisions = readDecisions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Decision log</h1>
        <p className="text-sm text-slate-400 mt-1">
          Every application run through this harness, with the full VoltLedger API trace preserved.
        </p>
      </div>
      <DecisionsListClient decisions={decisions} />
    </div>
  );
}

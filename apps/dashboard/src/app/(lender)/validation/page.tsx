import {
  getValidationDocuments,
  getValidationDocumentContent,
  getPortfolioSimLatest,
  getSohRulChart,
  getRvBacktestChart,
} from '@/lib/data';
import { StatCard } from '@/components/StatCard';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { SohAccuracyChart } from '@/components/SohAccuracyChart';
import { RvBacktestChart } from '@/components/RvBacktestChart';
import { EvidenceDocumentList } from '@/components/EvidenceDocumentList';

export const revalidate = 60;

function usd(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

export default async function ValidationPage() {
  const [{ documents }, portfolioSim, sohChart, rvChart] = await Promise.all([
    getValidationDocuments(),
    getPortfolioSimLatest(),
    getSohRulChart(),
    getRvBacktestChart(),
  ]);

  const contentEntries = await Promise.all(
    documents.map(async (doc) => [doc.id, (await getValidationDocumentContent(doc.id))?.content ?? null] as const),
  );
  const contentById = Object.fromEntries(contentEntries);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Validation</h1>
        <p className="text-slate-500 text-sm mt-1">
          The evidence behind VoltLedger's scoring, residual-value, and loss-reduction claims —
          real-data anchors, back-tests, and the counterfactual methodology, in one place.
        </p>
      </div>

      {/* Portfolio loss delta */}
      {portfolioSim ? (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="WITH VoltLedger — net loss" value={usd(portfolioSim.withNetLossUsd)} />
          <StatCard label="WITHOUT VoltLedger — net loss" value={usd(portfolioSim.withoutNetLossUsd)} />
          <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Loss delta</p>
            <p className="text-3xl font-bold text-emerald-400">{usd(portfolioSim.lossDeltaUsd)}</p>
            <div className="flex items-center justify-between mt-2">
              <ProvenanceBadge provenance={portfolioSim.provenance} size="sm" />
              <a
                href={`${portfolioSim.portfolioSimUiUrl}/runs/${portfolioSim.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline"
              >
                View full run →
              </a>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No portfolio simulation run yet — run <code>pnpm portfolio-sim</code>.</p>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Scoring accuracy by chemistry (WS-B)</h2>
          <p className="text-xs text-slate-500 mb-3">Mean absolute error vs. real held-out NASA/CALCE cells.</p>
          {sohChart ? (
            <SohAccuracyChart overallByChemistry={sohChart.overallByChemistry} />
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">Not generated yet — run <code>pnpm validate</code>.</p>
          )}
        </div>
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">RV model vs. real market (WS-C)</h2>
          <p className="text-xs text-slate-500 mb-3">Modeled portfolio trend vs. the real Manheim EV Index, month over month.</p>
          {rvChart && rvChart.rows.length > 0 ? (
            <RvBacktestChart rows={rvChart.rows} />
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">Not generated yet — run <code>pnpm rv-calibrate</code>.</p>
          )}
        </div>
      </div>

      {/* Evidence documents */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Evidence documents</h2>
        <EvidenceDocumentList documents={documents} contentById={contentById} />
      </div>
    </div>
  );
}

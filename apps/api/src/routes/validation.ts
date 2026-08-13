/**
 * Validation routes (WS-G) — surfaces the evidence/validation artifacts WS-A through WS-F
 * already produce, so they're reachable from the lender portal instead of only readable by
 * opening the repo.
 *
 * GET /v1/validation/documents          — manifest of evidence/data/model-card documents
 * GET /v1/validation/documents/:id      — one document's raw markdown content
 * GET /v1/validation/portfolio-sim-latest — latest WS-D portfolio-sim run summary
 * GET /v1/validation/charts/soh-rul     — WS-B accuracy-by-chemistry chart data
 * GET /v1/validation/charts/rv-backtest — WS-C modeled-vs-real back-test chart data
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@voltledger/db';
import { notFound } from '../lib/errors';

// apps/api/src/routes -> apps/api/src -> apps/api -> apps -> repo root
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

interface DocumentManifestEntry {
  id: string;
  title: string;
  workstream: string;
  summary: string;
  path: string;
}

/**
 * Hand-written manifest — summaries are NOT parsed from the underlying markdown (that would
 * be fragile: numbers embedded in prose, format could drift as docs regenerate). This is an
 * accepted, stated limitation: if a doc regenerates with materially different numbers, this
 * summary can go stale until someone updates it by hand. IDs are hand-chosen slugs, never
 * derived from the filename — three different files are literally named DATA_CARD.md.
 */
const DOCUMENTS: DocumentManifestEntry[] = [
  {
    id: 'nasa-pcoe-data-card',
    title: 'NASA PCoE Data Card',
    workstream: 'WS-A',
    summary: 'Real degradation-cycle data (34 cells, 3 ambient temperatures) used as the first real anchor for the synthetic generator and scoring model.',
    path: 'packages/calibration/data/nasa-pcoe/DATA_CARD.md',
  },
  {
    id: 'nasa-pcoe-generator-comparison',
    title: 'Generator vs. NASA Cross-Check',
    workstream: 'WS-A',
    summary: "Read-only sanity check of the synthetic generator's hand-set degradation params against the real NASA cycle-loss rate.",
    path: 'packages/calibration/data/nasa-pcoe/GENERATOR_COMPARISON.md',
  },
  {
    id: 'calce-cross-check',
    title: 'CALCE Cross-Check',
    workstream: 'WS-A',
    summary: 'A second, independently-sourced real dataset (CALCE CS2/CX2) cross-checked against NASA — the two disagree by ~5.4x on cycle-loss rate, an honest finding, not a hidden discrepancy.',
    path: 'packages/calibration/data/calce/CROSS_CHECK.md',
  },
  {
    id: 'soh-rul-validation',
    title: 'SoH/RUL Validation Report',
    workstream: 'WS-B',
    summary: "The scoring model's SoH/remaining-useful-life error, by chemistry and by data source, measured against real held-out cells.",
    path: 'docs/validation/SOH_RUL_VALIDATION.md',
  },
  {
    id: 'scoring-model-card',
    title: 'Scoring Model Card',
    workstream: 'WS-B',
    summary: 'What the risk-scoring model does, its inputs/weights/grade thresholds, and what is validated vs. a rule.',
    path: 'packages/scoring/MODEL_CARD.md',
  },
  {
    id: 'rv-calibration-note',
    title: 'RV Calibration Note',
    workstream: 'WS-C',
    summary: "Why the residual-value model's implied battery retention isn't force-fit to whole-vehicle %RV benchmarks, and what would be needed to responsibly calibrate it.",
    path: 'packages/rv-calibration/CALIBRATION_NOTE.md',
  },
  {
    id: 'rv-market-backtest',
    title: 'RV Market Back-Test',
    workstream: 'WS-C',
    summary: "A directional back-test of the RV model's trend against the real Manheim EV Index, plus a secondary Autovista %RV sanity check.",
    path: 'docs/validation/RV_MARKET_BACKTEST.md',
  },
  {
    id: 'rv-manheim-data-card',
    title: 'Manheim EV Index Data Card',
    workstream: 'WS-C',
    summary: 'What the public Manheim Used Vehicle Value Index is (and is not) as a calibration source, and how the 3 hand-curated observation points were sourced.',
    path: 'packages/rv-calibration/data/manheim/DATA_CARD.md',
  },
  {
    id: 'rv-autovista-data-card',
    title: 'Autovista %RV Data Card',
    workstream: 'WS-C',
    summary: 'What the Autovista/JD Power EU BEV %RV anchor points are (and are not) — small-n, EU-market, secondary/illustrative.',
    path: 'packages/rv-calibration/data/autovista/DATA_CARD.md',
  },
  {
    id: 'portfolio-loss-simulation',
    title: 'Portfolio Loss Simulation Report',
    workstream: 'WS-D',
    summary: 'The latest with/without VoltLedger counterfactual loss-delta run, with cohort breakdowns by chemistry and segment.',
    path: 'docs/validation/PORTFOLIO_LOSS_SIMULATION.md',
  },
  {
    id: 'portfolio-sim-methodology',
    title: 'Portfolio Simulator Methodology',
    workstream: 'WS-D',
    summary: 'The counterfactual design signed off at Gate D: default-hazard spec, recovery model, and what is held constant between the WITH/WITHOUT arms.',
    path: 'tools/portfolio-sim/METHODOLOGY.md',
  },
  {
    id: 'coverage-matrix',
    title: 'Coverage Matrix',
    workstream: 'WS-F',
    summary: 'Proves every data-completeness scenario in the build spec’s matrix (no passport, conflicting data, tampered identity, access-pending vs. granted, and more) produces a coherent run.',
    path: 'docs/validation/COVERAGE_MATRIX.md',
  },
];

export async function validationRoutes(app: FastifyInstance) {
  app.get('/documents', async () => {
    return { documents: DOCUMENTS.map(({ id, title, workstream, summary }) => ({ id, title, workstream, summary })) };
  });

  app.get<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
    const entry = DOCUMENTS.find((d) => d.id === req.params.id);
    if (!entry) return notFound(reply, `No such document: ${req.params.id}`);

    try {
      const content = readFileSync(join(REPO_ROOT, entry.path), 'utf-8');
      return { id: entry.id, title: entry.title, workstream: entry.workstream, content };
    } catch {
      return reply.status(404).send({ error: `Document file not found on disk: ${entry.path}. Has it been generated yet?` });
    }
  });

  app.get('/portfolio-sim-latest', async (req, reply) => {
    const run = await prisma.portfolioSimRun.findFirst({ orderBy: { runAt: 'desc' } });
    if (!run) {
      return reply.status(404).send({ error: 'No portfolio-sim runs yet. Run `pnpm portfolio-sim` first.' });
    }
    return {
      ...run,
      portfolioSimUiUrl: process.env.PORTFOLIO_SIM_UI_URL ?? 'http://localhost:3004',
    };
  });

  app.get('/charts/soh-rul', async (req, reply) => {
    try {
      const content = readFileSync(join(REPO_ROOT, 'docs', 'validation', 'SOH_RUL_VALIDATION.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return reply.status(404).send({ error: 'Chart data not found. Run `pnpm validate` first.' });
    }
  });

  app.get('/charts/rv-backtest', async (req, reply) => {
    try {
      const content = readFileSync(join(REPO_ROOT, 'docs', 'validation', 'RV_MARKET_BACKTEST.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return reply.status(404).send({ error: 'Chart data not found. Run `pnpm rv-calibrate` first.' });
    }
  });
}

# @voltledger/calibration

Slice 0 of `docs/VoltLedger - Build Spec v2.md` — WS-A (real degradation anchor + DGP
calibration). Fixes the circularity landmine described in the spec's §1.1: the synthetic
generator's degradation physics and the risk scorer's expectations were two independently
hand-set tables that were never checked against a real cell. This package is the first real
anchor.

## Status vs. spec Gate A (which datasets are in-scope for v1)

Spec's own recommendation: NASA + CALCE + Sandia + Oxford.

| Dataset | Status |
|---|---|
| **NASA PCoE** | **Done.** Official S3 mirror linked from NASA's own PCoE data-set repository page (see `scripts/convert_nasa_mat.py` header for the exact URL and citation). 34 cells, 3 ambient temperatures, ingested and fit — see `data/nasa-pcoe/DATA_CARD.md`. |
| **CALCE** | **Blocked.** Historically gated behind a manual data-request form on calce.umd.edu — not a scriptable download. Needs someone to submit the request and hand off the resulting files. |
| **Sandia (SNL)** | **Blocked.** Lives inside batteryarchive.org's interactive JS data explorer (backed by an API, not static files) — not a plain scriptable download from this environment. |
| **Oxford** | **Blocked.** Hosted on Oxford's ORA repository (ora.ox.ac.uk), which returned a 403 to a non-browser fetch — likely blocks automated access; probably needs a manual browser download. |

**Why this matters beyond coverage:** NASA PCoE cells are 18650 LCO/graphite — not one of
VoltLedger's four modeled chemistries (LFP/NMC/NCA/LTO). NASA alone proves the ingest → fit →
holdout → wire-in *pipeline* works against real, verifiable, physically-messy data, and gives
a first thermal-sensitivity result — but it cannot chemistry-calibrate LFP/NMC/NCA. CALCE,
Sandia, and Oxford all include the EV-relevant chemistries; closing Gate A for real needs at
least one of them.

**To unblock:** whoever has access should download the raw files manually and drop them
somewhere this pipeline can read (following the pattern in `scripts/convert_nasa_mat.py` —
a documented, reproducible one-time conversion script per source, output checked into
`data/<source>/`, raw files never committed).

## What's in here

- `scripts/convert_nasa_mat.py` — one-time conversion of NASA's raw `.mat` files (not
  committed, ~190MB) into the checked-in `data/nasa-pcoe/capacity_fade.csv` + `cells.json`.
  Includes real data-cleaning decisions (a physical-plausibility filter, 2 excluded cells) —
  documented in the script itself and in `DATA_CARD.md`.
- `src/ingest.ts`, `src/split.ts`, `src/fit.ts`, `src/data-card.ts` — the TS pipeline:
  load the normalized CSV → deterministic per-cell train/holdout split → least-squares fit
  of cycle-loss-rate + thermal sensitivity → render `DATA_CARD.md`.
- `src/holdout-guard.test.ts` — enforces that `packages/scoring` (the model-under-test)
  never imports this package, which is what keeps the holdout cells out of the scorer per
  spec §1.1. Verified to actually fail when scoring is made to import this package (not just
  written and assumed to work).
- `src/compare-to-generator.ts` — a read-only sanity check of
  `tools/synthetic-generator`'s hand-set `CHEMISTRY_PARAMS` against the NASA reference rate.
  **Does not modify generator behavior** — see the script's own header for why a silent
  swap-in would be inappropriate given the chemistry mismatch.

## Running it

```bash
pnpm install
pnpm --filter @voltledger/calibration calibrate   # ingest -> split -> fit -> data card
pnpm --filter @voltledger/calibration compare     # generator-vs-NASA sanity check
pnpm --filter @voltledger/calibration test         # holdout-import guard
```

To regenerate `data/nasa-pcoe/*` from scratch: download
`https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip` (linked from NASA's
[PCoE data-set repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/)),
extract the nested per-batch zips into one directory of `B00NN.mat` files, then:

```bash
pip install scipy numpy
python3 scripts/convert_nasa_mat.py --input-dir <dir> \
  --out-csv data/nasa-pcoe/capacity_fade.csv --out-cells data/nasa-pcoe/cells.json
```

## Headline result (see DATA_CARD.md for the full picture, including what didn't work cleanly)

- Reference cycle-loss rate at 24°C: ~22%/100 cycles (LCO reference cells, R² and holdout MAE
  in the data card — it is not a small error; this is a first anchor, not a finished model).
- Thermal sensitivity came out slightly *negative* (less loss at higher temp) — the opposite
  sign from every chemistry's hand-set `thermalLossPctPerDegPerYear` in the generator. Not
  necessarily wrong (cold-charge lithium plating is real), but a genuine finding that the
  generator's heat-only thermal model doesn't hold up against this real dataset. See the data
  card's "On the negative sign" section before acting on it either way.
- Of 34 raw cells, 2 were excluded outright (corrupted first-cycle readings) and roughly half
  of the remaining cells didn't pass the R² ≥ 0.5 reliability gate used for the group fit —
  concentrated almost exactly in the batches NASA's own READMEs already flag as having
  unresolved data-quality issues (a crashed test-control script, unexplained low-capacity
  runs). That's corroboration of NASA's own caveat, not a filtering artifact.

## Not yet done (later slices)

- Gate B (target error threshold) — the holdout MAE here is a first number to anchor that
  against once WS-B's full SoH/RUL harness exists; it isn't that harness itself.
- `calendarLossPctPerYear` and `dcfcSensitivity` — NASA PCoE cannot calibrate either (see
  DATA_CARD.md's "What this is and isn't"). Needs a calendar/rest-aging dataset and a
  varied-charge-rate dataset respectively.

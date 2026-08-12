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
| **CALCE** | **Done, as a cross-check — not a chemistry-match.** Correction: CALCE is **not** actually gated behind a manual request form (the build spec doc's characterization, which this README initially repeated, was wrong) — `calce.umd.edu/battery-data` links directly-downloadable zips. CS2/CX2 (13 cells, LCO, Type 1/2 protocols) ingested as a second independent source — see `data/calce/CROSS_CHECK.md`. But CALCE's chemistry-matched cells (INR18650-20R/NMC, A123/LFP) turned out to be short single-session OCV/SOC-estimation captures, not long-run capacity-fade studies — they can't calibrate a cycle-fade rate. So this still doesn't close the LFP/NMC/NCA gap; see below. |
| **Sandia (SNL)** | **Blocked.** Lives inside batteryarchive.org's interactive JS data explorer (backed by an API, not static files) — not a plain scriptable download from this environment. |
| **Oxford** | **Blocked.** Hosted on Oxford's ORA repository (ora.ox.ac.uk), which returned a 403 to a non-browser fetch — likely blocks automated access; probably needs a manual browser download. |

**Why this matters beyond coverage:** NASA PCoE and CALCE's CS2/CX2 are both 18650/prismatic
LCO cells — not one of VoltLedger's four modeled chemistries (LFP/NMC/NCA/LTO). Between them
they prove the ingest → fit → holdout → wire-in *pipeline* works against real, independently-
sourced, physically-messy data, and give a cross-checked (if not tightly agreeing — see
below) cycle-loss-rate reference. Neither can chemistry-calibrate LFP/NMC/NCA. Sandia and
Oxford remain the paths to that; closing Gate A for real needs at least one of them.

**The CALCE/NASA cross-check result is itself a finding, not a confirmation:** the two
sources disagree by ~5.4x on cycle-loss rate (NASA higher). `data/calce/CROSS_CHECK.md`
has the full picture and a plausible explanation (different C-rates/cell designs), but the
honest takeaway is that a single-chemistry, single-source calibration would have been
fragile — this is exactly why the spec's Gate A wants multiple datasets.

**To unblock Sandia/Oxford:** whoever has access should download the raw files manually and
drop them somewhere this pipeline can read (following the pattern in
`scripts/convert_nasa_mat.py` / `scripts/convert_calce_xlsx.py` — a documented, reproducible
one-time conversion script per source, output checked into `data/<source>/`, raw files never
committed).

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
- `scripts/convert_calce_xlsx.py` — one-time conversion of CALCE's raw Arbin-tester `.xlsx`
  logs (not committed, ~880MB for the 13 cells in scope) into
  `data/calce/capacity_fade.csv` + `cells.json`. Correctly handles the fact that
  `Discharge_Capacity(Ah)` in the raw sheet is a *cumulative* counter per file, not a
  per-cycle value — this was a real bug caught and fixed during development (see the
  script's git history / comments), not a design decision.
- `src/calce-ingest.ts`, `src/cross-check.ts`, `src/cross-check-report.ts` — loads the CALCE
  dataset and checks its independent room-temperature cycle-loss rate against the NASA
  reference. Read-only comparison; does not feed back into `chemistry-params.calibrated.json`.

## Running it

```bash
pnpm install
pnpm --filter @voltledger/calibration calibrate   # ingest NASA + CALCE -> split -> fit -> data card + cross-check
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

To regenerate `data/calce/*` from scratch: download the CS2_33/34/35/36/37/38 and
CX2_16/33/34/35/36/37/38 zips from
[calce.umd.edu/battery-data](https://calce.umd.edu/battery-data) (direct links under
`web.calce.umd.edu/batteries/data/<CELL_ID>.zip`), extract each into its own `<CELL_ID>/`
folder under one directory, then:

```bash
pip install pandas openpyxl
python3 scripts/convert_calce_xlsx.py --input-dir <dir with CS2_NN/ CX2_NN/ subfolders> \
  --out-csv data/calce/capacity_fade.csv --out-cells data/calce/cells.json
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
- **Cross-check against CALCE (independent LCO source): does not closely agree.** CALCE's
  CS2/CX2 cells show ~4.1%/100cyc vs. NASA's ~22.1%/100cyc — a ~5.4x gap. See
  `data/calce/CROSS_CHECK.md` for the full picture and a plausible explanation (different
  C-rates and cell designs). The honest conclusion is that the NASA-derived reference rate
  carries real uncertainty, not that either number is wrong — exactly why Gate A calls for
  multiple datasets rather than one.

## Not yet done (later slices)

- Gate B (target error threshold) — the holdout MAE here is a first number to anchor that
  against once WS-B's full SoH/RUL harness exists; it isn't that harness itself.
- `calendarLossPctPerYear` and `dcfcSensitivity` — NASA PCoE cannot calibrate either (see
  DATA_CARD.md's "What this is and isn't"). Needs a calendar/rest-aging dataset and a
  varied-charge-rate dataset respectively.

# Data Card — NASA PCoE Battery Data Set (calibration anchor)

Generated: 2026-08-12T19:18:49.527Z
Model version: 0.1.0-nasa-pcoe

## Source

- **Dataset:** NASA PCoE Battery Data Set (official S3 mirror linked from nasa.gov PCoE data-set repository)
- **URL:** https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip
- **Citation:** B. Saha and K. Goebel (2007). "Battery Data Set", NASA Prognostics Data Repository, NASA Ames Research Center, Moffett Field, CA.
- **Chemistry:** 18650 Li-ion, LCO/graphite (~2Ahr rated) — NOT chemistry-matched to VoltLedger's LFP/NMC/NCA taxonomy; see data card.

## What this is and isn't

This is a **cycling aging study**: 34 x 18650 cells run through repeated charge/discharge
cycles at three fixed ambient temperatures (4C, ~22-24C, 43C) until 20-30% capacity fade.
It directly supports fitting a **cycle-linked degradation rate** and a **thermal sensitivity**
coefficient. It does **not** support:

- **Calendar/rest aging** (`calendarLossPctPerYear` in `tools/synthetic-generator`'s
  `ChemistryParams`) — these cells were continuously cycled, never rested for calendar-aging
  measurement.
- **DCFC sensitivity** (`dcfcSensitivity`) — charging in every batch used the same fixed
  1.5A CC/CV protocol; only discharge current varied, so fast-*charge* stress was never an
  independent variable here.
- **Chemistry-exact calibration for LFP/NMC/NCA** — these are 18650 LCO/graphite cells, which
  is not one of VoltLedger's four modeled chemistries (`Chemistry` enum: LFP/NMC/NCA/LTO).
  Treat this calibration as validating the model's *functional form* (does a linear
  cycle-loss + thermal-sensitivity model track real cells at all) — not as the final magnitude
  for any specific VoltLedger chemistry. CALCE, Sandia, and Oxford (chemistry-matched,
  currently acquisition-blocked — see `README.md`) are what close that gap.

## Coverage

- Cells ingested: 32 (of 34 raw) — 2 of 34 raw cells (B0039, B0041) excluded: no physically plausible capacity reading in their first 5 discharge cycles (< 0.5 Ahr against a ~2 Ahr rated cell) — consistent with NASA's own README caveat for the 4C-labeled batches ("several discharge runs where the capacity was very low... not fully analyzed").
- Ambient temperatures observed: 4, 22, 24, 43 C
- Total discharge-cycle data points: 2481
- B0042/43/44 are packaged under the "41-44" batch README, which states a 4C ambient — but each cycle's own `ambient_temperature` field reads 22C. This pipeline trusts the per-cycle sensor field over the batch label (that's what "ambientTempC" below reflects); flagging the discrepancy here rather than silently picking one.

## Train / holdout split

Split by cell (not by cycle, to avoid leaking a cell's own curve across the split):

- Train cells (24): B0006, B0007, B0018, B0026, B0027, B0028, B0030, B0031, B0032, B0034, B0036, B0038, B0042, B0043, B0044, B0046, B0047, B0048, B0050, B0051, B0052, B0054, B0055, B0056
- Holdout cells (8): B0005, B0025, B0029, B0033, B0040, B0045, B0049, B0053

Enforced by `src/holdout-guard.test.ts`: `packages/scoring` must never import
`@voltledger/calibration` — that's what keeps the holdout cells out of the model-under-test,
per build spec v2 §1.1.

## Fit

**Data-quality gate (applied uniformly to train AND holdout, stated here in full):** a
cell's per-cycle fade slope is only used if its own linear fit reaches R² >= 0.5 — below
that, the slope itself isn't reliably estimated, and feeding it into the group regression
(or judging the model against it) would measure noise, not signal. This gate excludes most
of the 4C batches almost exactly matching NASA's own README caveats for B0041-56 ("several
discharge runs where the capacity was very low... not fully analyzed", and for B0049-52,
"the experiment control software crashed") — the gate corroborates NASA's own documented
caveat rather than being tuned to produce a particular answer. Nothing is hidden: every
cell, gated or not, is in the per-cell table below with its own R² so you can see exactly
what was excluded and why.

Linear regression of per-cell loss-rate (%/100 cycles, itself an OLS slope of SoH% vs. cycle
index) against ambient temperature, fit on the 14 train cells that passed the gate:

- Reference loss rate at 24C: **22.065% / 100 cycles**
- Thermal sensitivity: **-0.1200% / 100 cycles per °C** away from 24C
- R² (temp -> loss-rate regression): 0.056

**On the negative sign:** this says loss *decreases* as ambient temperature rises from 4C
to 43C — the opposite of the usual "heat accelerates aging" assumption baked into
`tools/synthetic-generator`'s hand-set `thermalLossPctPerDegPerYear` (positive for every
chemistry). It's not necessarily wrong: lithium plating during cold-temperature charging is
a well-documented accelerant, and these cells all charged at a fixed rate regardless of
ambient temperature, so the coldest batch may genuinely have degraded fastest. But R² =
0.056 on 14 cells is a real result, not a strong one — treat
this as "the current model's simple heat-only assumption doesn't hold up against real cold-
climate data," not as a validated replacement coefficient.

## Holdout validation

Fit's predicted loss-rate vs. each holdout cell's own measured rate (same R² >= 0.5 gate
applied — 4 of 8 holdout cells excluded on the same grounds):

- Holdout cells evaluated: 4
- MAE: 8.321% / 100 cycles
- RMSE: 9.812% / 100 cycles

This MAE is the number to anchor Gate B (spec §4, WS-A/B) against once WS-B's full SoH/RUL
harness exists — it's a first real error figure, not yet the scoring-model accuracy figure
itself, and it is not a small error. That's an honest result of a 2-parameter linear model
against real, noisy, low-cycle-count cells — not a finished calibration.

## Per-cell fade rates

| Cell | Ambient (C) | Loss %/100 cycles | R² | Split |
|---|---|---|---|---|
| B0005 | 24 | 21.067 | 0.976 | holdout |
| B0006 | 24 | 25.265 | 0.964 | train |
| B0007 | 24 | 17.385 | 0.976 | train |
| B0018 | 24 | 21.342 | 0.940 | train |
| B0025 | 24 | 13.760 | 0.880 | holdout |
| B0026 | 24 | 0.000 | 0.001 | train |
| B0027 | 24 | 6.057 | 0.489 | train |
| B0028 | 24 | 14.731 | 0.887 | train |
| B0029 | 43 | 28.062 | 0.865 | holdout |
| B0030 | 43 | 27.900 | 0.879 | train |
| B0031 | 43 | 17.559 | 0.675 | train |
| B0032 | 43 | 28.606 | 0.827 | train |
| B0033 | 24 | 11.747 | 0.329 | holdout |
| B0034 | 24 | 6.540 | 0.342 | train |
| B0036 | 24 | 5.153 | 0.297 | train |
| B0038 | 24 | 0.000 | 0.470 | train |
| B0040 | 24 | 0.000 | 0.363 | holdout |
| B0042 | 22 | 16.864 | 0.953 | train |
| B0043 | 22 | 14.099 | 0.761 | train |
| B0044 | 22 | 14.681 | 0.768 | train |
| B0045 | 4 | 40.170 | 0.774 | holdout |
| B0046 | 4 | 36.125 | 0.816 | train |
| B0047 | 4 | 33.286 | 0.736 | train |
| B0048 | 4 | 26.167 | 0.677 | train |
| B0049 | 4 | 226.082 | 0.397 | holdout |
| B0050 | 4 | 158.406 | 0.133 | train |
| B0051 | 4 | 203.440 | 0.291 | train |
| B0052 | 4 | 0.000 | 0.496 | train |
| B0053 | 4 | 12.511 | 0.307 | holdout |
| B0054 | 4 | 18.379 | 0.673 | train |
| B0055 | 4 | 12.953 | 0.471 | train |
| B0056 | 4 | 7.699 | 0.199 | train |

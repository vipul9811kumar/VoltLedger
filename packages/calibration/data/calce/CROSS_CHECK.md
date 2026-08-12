# Cross-check — CALCE (CS2/CX2) vs. NASA PCoE

Generated: 2026-08-12T20:08:01.305Z

## Why this exists

Both NASA PCoE and CALCE's CS2/CX2 cells are the same chemistry (LiCoO2) but otherwise
unrelated: different labs, different cell manufacturers/designs, different years, different
testers. If two independent LCO sources land in the same ballpark for room-temperature
cycle-loss rate, that's real (if modest) corroboration of the NASA-derived number in
`data/nasa-pcoe/DATA_CARD.md`. If they don't agree, that's a real finding to flag, not a
reason to pick whichever one is more convenient.

**This does not feed back into `chemistry-params.calibrated.json`** — it's a check, not
an additional fit input.

## Source

- **Dataset:** CALCE Battery Data (CS2/CX2 families, Type 1/2 protocols only)
- **URL:** https://calce.umd.edu/battery-data
- **Citation:** He, W., Williard, N., Osterman, M., Pecht, M. (2011). "Prognostics of lithium-ion batteries based on Dempster-Shafer theory and the Bayesian Monte Carlo method." Journal of Power Sources, 196(23), 10314-10321.
- **Chemistry:** LiCoO2 (LCO), both CS2 and CX2 families — same chemistry as NASA PCoE, NOT chemistry-matched to VoltLedger's LFP/NMC/NCA.
- **Ambient temperature:** Not stated by CALCE for these Type 1/2 cells (unlike NASA's explicit chambers) — treat as an uncontrolled room-temperature cross-check, not thermal-fit input.
- **Scope:** CS2/CX2 "Type 1" (0.5C) and "Type 2" (1C) protocols only — simple constant-
  current full-depth cycling, the closest match to NASA's protocol. CS2-8/21 and CX2-4/31
  (CADEX tester, different file format) and CS2/CX2 Types 3-6 (pulsed/randomized/partial-
  cycling — not comparable to a simple full-cycle rate) are out of scope for this pass.

## Result

- NASA reference (24C): **22.065% / 100 cycles**
- CALCE room-temp, 13 cells passing the same R² ≥ 0.5 gate used
  throughout this package:
  - Median: **3.251% / 100 cycles**
  - Mean: **4.086% / 100 cycles**
- CALCE mean is **81% lower** than the NASA reference —
  a **5.4x** gap.

**Verdict: these do not closely agree.** This is not noise-level disagreement — it's a
real, order-of-magnitude-adjacent gap between two independent LCO sources, and it should
be read as exactly that, not smoothed over. A plausible explanation: NASA's cells were
discharged at 1-2C relative to their ~2Ah rating and driven to 20-30% fade in well under
200 cycles (a harsher, faster protocol), while CALCE's CS2/CX2 cells ran gentler 0.5-1C
cycling and took 700-2000+ cycles to reach comparable fade — different stress levels on
different cell designs can easily produce a multi-x difference in %-loss-per-cycle. That's
a plausible explanation, not a verified one. **Practical consequence: treat the NASA-
derived reference rate in `data/nasa-pcoe/DATA_CARD.md` as one data point with real
uncertainty around it, not a settled number** — exactly the caveat Gate B (spec §4) needs
to inherit once a real accuracy-threshold conversation happens.

## Per-cell rates

| Cell | Family | Protocol | Loss %/100 cycles | R² | Used in cross-check |
|---|---|---|---|---|---|
| CS2_33 | CS2 | Type1_0.5C | 6.647 | 0.789 | yes |
| CS2_34 | CS2 | Type1_0.5C | 5.677 | 0.860 | yes |
| CS2_35 | CS2 | Type2_1C | 5.929 | 0.791 | yes |
| CS2_36 | CS2 | Type2_1C | 6.529 | 0.842 | yes |
| CS2_37 | CS2 | Type2_1C | 5.340 | 0.807 | yes |
| CS2_38 | CS2 | Type2_1C | 5.225 | 0.798 | yes |
| CX2_16 | CX2 | Type1_0.5C | 1.605 | 0.822 | yes |
| CX2_33 | CX2 | Type1_0.5C | 2.596 | 0.865 | yes |
| CX2_34 | CX2 | Type2_0.5C | 2.880 | 0.960 | yes |
| CX2_35 | CX2 | Type1_0.5C | 2.340 | 0.859 | yes |
| CX2_36 | CX2 | Type2_0.5C | 2.420 | 0.946 | yes |
| CX2_37 | CX2 | Type2_0.5C | 2.679 | 0.931 | yes |
| CX2_38 | CX2 | Type2_0.5C | 3.251 | 0.947 | yes |

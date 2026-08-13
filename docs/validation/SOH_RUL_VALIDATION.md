# WS-B — SoH/RUL validation vs. real cells

Generated: 2026-08-13T02:02:44.711Z

## What this is and isn't

Compares `packages/scoring`'s hand-set `EXPECTED_SOH_BY_CHEMISTRY` / `tools/synthetic-generator`'s `CHEMISTRY_PARAMS.cycleLossPctPer100Cycles` (LFP/NMC/NCA) against real cycle-loss rates fitted from NASA PCoE + CALCE cells (see `packages/calibration`). **Every real cell here is LiCoO2 (LCO)** — not one of VoltLedger's modeled chemistries. This measures whether the model's assumptions sit in a plausible range next to real degradation data, compared against all three chemistries so nothing is cherry-picked — it is not a same-chemistry accuracy certification. See `packages/scoring/MODEL_CARD.md` for the full framing, including build spec v2 §1.2's distinction between validated inputs and the composite grade as a transparent rule.

**RUL** (remaining useful life, in cycles to 80% SoH — the standard EV end-of-life threshold) is derived here for both the real cells and the model by linear extrapolation of the fitted cycle-loss rate. No RUL estimator exists in `packages/scoring` today; this is a validation-only construct, not a production function being tested.

Cells included: 31 (R² ≥ 0.5 reliability gate, same threshold WS-A used for its own group fit and holdout validation — applied identically here, not tuned for this report).

## Overall error, by chemistry compared against

| Chemistry | n | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) | RMSE RUL (cycles) |
|---|---|---|---|---|---|
| LFP | 31 | 14.62 | 18.39 | 3692.06 | 3704.85 |
| NMC | 31 | 14.12 | 17.99 | 1692.06 | 1719.79 |
| NCA | 31 | 13.92 | 17.84 | 1358.73 | 1393.10 |

## By source (NASA vs. CALCE — do the two real datasets imply the same error?)

| Source / Chemistry | n | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) | RMSE RUL (cycles) |
|---|---|---|---|---|---|
| NASA / LFP | 18 | 22.58 | 23.89 | 3903.45 | 3903.57 |
| NASA / NMC | 18 | 22.08 | 23.42 | 1903.45 | 1903.69 |
| NASA / NCA | 18 | 21.88 | 23.23 | 1570.12 | 1570.41 |
| CALCE / LFP | 13 | 3.59 | 3.99 | 3399.37 | 3410.64 |
| CALCE / NMC | 13 | 3.09 | 3.55 | 1399.37 | 1426.53 |
| CALCE / NCA | 13 | 2.89 | 3.37 | 1066.04 | 1101.44 |

## By temperature band (NASA only — CALCE's ambient isn't documented, see WS-A data card)

Substitutes for an "age band" split, which this cycling-study data can't provide — stated here rather than silently relabeled.

| Temp band / Chemistry | n | MAE loss %/100cyc | RMSE loss %/100cyc | MAE RUL (cycles) | RMSE RUL (cycles) |
|---|---|---|---|---|---|
| 4C / LFP | 5 | 30.33 | 31.29 | 3929.90 | 3929.96 |
| 4C / NMC | 5 | 29.83 | 30.81 | 1929.90 | 1930.02 |
| 4C / NCA | 5 | 29.63 | 30.61 | 1596.57 | 1596.71 |
| 22C / LFP | 3 | 14.71 | 14.76 | 3867.77 | 3867.78 |
| 22C / NMC | 3 | 14.21 | 14.26 | 1867.77 | 1867.80 |
| 22C / NCA | 3 | 14.01 | 14.06 | 1534.44 | 1534.47 |
| 24C / LFP | 6 | 18.43 | 18.86 | 3889.34 | 3889.41 |
| 24C / NMC | 6 | 17.93 | 18.37 | 1889.34 | 1889.49 |
| 24C / NCA | 6 | 17.73 | 18.18 | 1556.01 | 1556.19 |
| 43C / LFP | 4 | 25.03 | 25.45 | 3918.31 | 3918.35 |
| 43C / NMC | 4 | 24.53 | 24.96 | 1918.31 | 1918.40 |
| 43C / NCA | 4 | 24.33 | 24.76 | 1584.97 | 1585.08 |

## Per-cell detail

| Cell | Source | Temp (C) | Real loss %/100cyc | Real R² | Real RUL (cyc) | NMC model loss | NMC error | NMC RUL error (cyc) |
|---|---|---|---|---|---|---|---|---|
| B0005 | NASA | 24 | 21.07 | 0.976 | 94.93 | 1.00 | -20.07 | 1905.07 |
| B0006 | NASA | 24 | 25.26 | 0.964 | 79.16 | 1.00 | -24.26 | 1920.84 |
| B0007 | NASA | 24 | 17.38 | 0.976 | 115.04 | 1.00 | -16.38 | 1884.96 |
| B0018 | NASA | 24 | 21.34 | 0.940 | 93.71 | 1.00 | -20.34 | 1906.29 |
| B0025 | NASA | 24 | 13.76 | 0.880 | 145.34 | 1.00 | -12.76 | 1854.66 |
| B0028 | NASA | 24 | 14.73 | 0.887 | 135.77 | 1.00 | -13.73 | 1864.23 |
| B0029 | NASA | 43 | 28.06 | 0.865 | 71.27 | 1.00 | -27.06 | 1928.73 |
| B0030 | NASA | 43 | 27.90 | 0.879 | 71.68 | 1.00 | -26.90 | 1928.32 |
| B0031 | NASA | 43 | 17.56 | 0.675 | 113.90 | 1.00 | -16.56 | 1886.10 |
| B0032 | NASA | 43 | 28.61 | 0.827 | 69.91 | 1.00 | -27.61 | 1930.09 |
| B0042 | NASA | 22 | 16.86 | 0.953 | 118.60 | 1.00 | -15.86 | 1881.40 |
| B0043 | NASA | 22 | 14.10 | 0.761 | 141.86 | 1.00 | -13.10 | 1858.14 |
| B0044 | NASA | 22 | 14.68 | 0.768 | 136.23 | 1.00 | -13.68 | 1863.77 |
| B0045 | NASA | 4 | 40.17 | 0.774 | 49.79 | 1.00 | -39.17 | 1950.21 |
| B0046 | NASA | 4 | 36.12 | 0.816 | 55.36 | 1.00 | -35.12 | 1944.64 |
| B0047 | NASA | 4 | 33.29 | 0.736 | 60.09 | 1.00 | -32.29 | 1939.91 |
| B0048 | NASA | 4 | 26.17 | 0.677 | 76.43 | 1.00 | -25.17 | 1923.57 |
| B0054 | NASA | 4 | 18.38 | 0.673 | 108.82 | 1.00 | -17.38 | 1891.18 |
| CS2_33 | CALCE | n/a | 6.65 | 0.789 | 300.89 | 1.00 | -5.65 | 1699.11 |
| CS2_34 | CALCE | n/a | 5.68 | 0.860 | 352.30 | 1.00 | -4.68 | 1647.70 |
| CS2_35 | CALCE | n/a | 5.93 | 0.791 | 337.32 | 1.00 | -4.93 | 1662.68 |
| CS2_36 | CALCE | n/a | 6.53 | 0.842 | 306.31 | 1.00 | -5.53 | 1693.69 |
| CS2_37 | CALCE | n/a | 5.34 | 0.807 | 374.56 | 1.00 | -4.34 | 1625.44 |
| CS2_38 | CALCE | n/a | 5.22 | 0.798 | 382.80 | 1.00 | -4.22 | 1617.20 |
| CX2_16 | CALCE | n/a | 1.60 | 0.822 | 1246.22 | 1.00 | -0.60 | 753.78 |
| CX2_33 | CALCE | n/a | 2.60 | 0.865 | 770.37 | 1.00 | -1.60 | 1229.63 |
| CX2_34 | CALCE | n/a | 2.88 | 0.960 | 694.39 | 1.00 | -1.88 | 1305.61 |
| CX2_35 | CALCE | n/a | 2.34 | 0.859 | 854.67 | 1.00 | -1.34 | 1145.33 |
| CX2_36 | CALCE | n/a | 2.42 | 0.946 | 826.51 | 1.00 | -1.42 | 1173.49 |
| CX2_37 | CALCE | n/a | 2.68 | 0.931 | 746.51 | 1.00 | -1.68 | 1253.49 |
| CX2_38 | CALCE | n/a | 3.25 | 0.947 | 615.26 | 1.00 | -2.25 | 1384.74 |

(NMC shown as the representative column above for readability — LFP and NCA follow the same pattern; see `chemistry-params.calibrated.json`-style raw output for all three if needed.)

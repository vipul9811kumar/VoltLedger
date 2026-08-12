# Generator assumptions vs. NASA PCoE reference (sanity check, not a calibration)

NASA-derived reference (LCO cells, 24C, R²=0.06, n=14 cells): **22.06% loss / 100 cycles**

| Chemistry | Generator: cycleLossPctPer100Cycles | vs. NASA LCO reference |
|---|---|---|
| LFP | 0.50 | 0.02x (lower than LCO ref) |
| NMC | 1.00 | 0.05x (lower than LCO ref) |
| NCA | 1.20 | 0.05x (lower than LCO ref) |

Read this as: does the generator's assumed cycle-fade rate sit in a plausible range next to one real dataset's rate — not as agreement or disagreement with a chemistry-matched ground truth, which this dataset cannot provide. See DATA_CARD.md.

**Caveat on the ~20-50x gap above:** NASA cycled these cells back-to-back to full depth (80-100% DoD) with no rest, as an accelerated-aging test protocol — that is far harsher than a real EV's typical daily partial-depth cycling, which is what the generator's `cycleLossPctPer100Cycles` is meant to represent. Some of this gap is genuine signal (the generator may be too optimistic); some of it is comparing accelerated-test cycles to real-world-equivalent cycles, which are not the same unit. WS-B / a depth-of-discharge-aware re-analysis is needed before treating this as an action item on the generator itself.

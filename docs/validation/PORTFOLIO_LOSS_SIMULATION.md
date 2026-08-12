# WS-D — Portfolio loss simulation (SIMULATED_CALIBRATED)

Generated: 2026-08-12T21:55:25.405Z | seed: 42 | n=300 loans

**Provenance: SIMULATED_CALIBRATED.** Every number below is a synthetic-portfolio simulation against an illustrative (not fitted) hazard/recovery model — see `METHODOLOGY.md` for the full spec, what's held constant, and known simplifications. Never present these figures as a real lender outcome; that language is reserved for actual design-partner data, per build spec v2 §1.3.

## Headline: loss delta

**WITH VoltLedger signal: $148,943 net credit loss** (18.33% default rate, 40.72% LGD)
**WITHOUT (flat-LTV baseline): $1,451,638 net credit loss** (20.00% default rate, 84.65% LGD)

**Loss delta: $1,302,695** (WITHOUT − WITH) across this 300-loan simulated portfolio.

## By chemistry

| Chemistry | n (WITH) | Default % (WITH) | Net loss (WITH) | LGD % (WITH) | Default % (W/O) | Net loss (W/O) | LGD % (W/O) | Loss delta |
|---|---|---|---|---|---|---|---|---|
| LFP | 136 | 11.03% | $16,279 | 14.58% | 12.50% | $334,080 | 73.17% | $317,802 |
| NCA | 55 | 32.73% | $58,410 | 57.11% | 32.73% | $476,563 | 90.46% | $418,154 |
| NMC | 109 | 20.18% | $74,255 | 48.91% | 22.94% | $640,994 | 87.64% | $566,740 |

## By segment (usage profile, as a proxy for borrower/fleet type)

| Segment | n (WITH) | Default % (WITH) | Net loss (WITH) | LGD % (WITH) | Default % (W/O) | Net loss (W/O) | LGD % (W/O) | Loss delta |
|---|---|---|---|---|---|---|---|---|
| COMMERCIAL_DELIVERY | 60 | 30.00% | $57,291 | 52.55% | 35.00% | $537,731 | 87.09% | $480,441 |
| DAILY_COMMUTER | 53 | 15.09% | $12,155 | 14.84% | 13.21% | $122,011 | 65.00% | $109,855 |
| HIGH_MILEAGE_DRIVER | 63 | 9.52% | $21,720 | 40.23% | 14.29% | $225,171 | 81.82% | $203,451 |
| RIDESHARE_FLEET | 65 | 27.69% | $53,423 | 77.46% | 27.69% | $483,871 | 96.89% | $430,448 |
| WEEKEND_DRIVER | 59 | 8.47% | $4,355 | 8.40% | 8.47% | $82,855 | 61.35% | $78,500 |

See `METHODOLOGY.md` (in `tools/portfolio-sim/`) before citing any number above.

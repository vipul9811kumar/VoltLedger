# WS-D — Portfolio loss simulation (SIMULATED_CALIBRATED)

Generated: 2026-08-12T21:35:26.024Z | seed: 42 | n=300 loans

**Provenance: SIMULATED_CALIBRATED.** Every number below is a synthetic-portfolio simulation against an illustrative (not fitted) hazard/recovery model — see `METHODOLOGY.md` for the full spec, what's held constant, and known simplifications. Never present these figures as a real lender outcome; that language is reserved for actual design-partner data, per build spec v2 §1.3.

## Headline: loss delta

**WITH VoltLedger signal: $151,572 net credit loss** (18.33% default rate, 40.64% LGD)
**WITHOUT (flat-LTV baseline): $1,381,570 net credit loss** (19.00% default rate, 85.91% LGD)

**Loss delta: $1,229,998** (WITHOUT − WITH) across this 300-loan simulated portfolio.

## By chemistry

| Chemistry | n (WITH) | Default % (WITH) | Net loss (WITH) | LGD % (WITH) | Default % (W/O) | Net loss (W/O) | LGD % (W/O) | Loss delta |
|---|---|---|---|---|---|---|---|---|
| LFP | 136 | 10.29% | $17,368 | 16.72% | 9.56% | $266,274 | 76.35% | $248,905 |
| NCA | 55 | 32.73% | $58,420 | 54.66% | 32.73% | $476,788 | 90.50% | $418,368 |
| NMC | 109 | 21.10% | $75,784 | 46.71% | 23.85% | $638,508 | 87.16% | $562,725 |

## By segment (usage profile, as a proxy for borrower/fleet type)

| Segment | n (WITH) | Default % (WITH) | Net loss (WITH) | LGD % (WITH) | Default % (W/O) | Net loss (W/O) | LGD % (W/O) | Loss delta |
|---|---|---|---|---|---|---|---|---|
| COMMERCIAL_DELIVERY | 60 | 25.00% | $50,741 | 55.35% | 26.67% | $426,006 | 90.05% | $375,264 |
| DAILY_COMMUTER | 53 | 15.09% | $10,732 | 13.33% | 13.21% | $122,224 | 65.12% | $111,493 |
| HIGH_MILEAGE_DRIVER | 63 | 14.29% | $31,233 | 37.63% | 15.87% | $225,098 | 80.53% | $193,864 |
| RIDESHARE_FLEET | 65 | 29.23% | $55,904 | 75.66% | 30.77% | $542,718 | 96.74% | $486,814 |
| WEEKEND_DRIVER | 59 | 6.78% | $2,962 | 6.75% | 6.78% | $65,524 | 61.35% | $62,562 |

See `METHODOLOGY.md` (in `tools/portfolio-sim/`) before citing any number above.

# RV Market Back-Test (WS-C)

## What this is and isn't

This is a **directional** back-test, not a per-age-band curve-fit error table. The public
Manheim EV Index (see `data/manheim/DATA_CARD.md`) has no age or chemistry axis — it's a
calendar-time wholesale-price index — so it can only be compared to this model on direction
and rough magnitude of change over the same calendar window, not on absolute retention
values. See `CALIBRATION_NOTE.md` for the (separate, larger) battery-value-vs-whole-vehicle
mismatch found when checking against Autovista's %RV anchors.

A small synthetic cohort (one battery per chemistry, using only the already-shipped
`EXPECTED_SOH_BY_CHEMISTRY` curve — no noisy generator) is aged forward across the real
Manheim observation dates and run through the production `computeResidualValue`. The
resulting modeled portfolio value is normalized to a base=100 index, matching Manheim's own
index convention, so the two series' *movements* can be compared even though their *levels*
mean different things.

## Primary back-test: modeled portfolio trend vs. Manheim EV Index

| Release | Modeled index | Modeled %MoM | Real EV Index %MoM | Real EV Index %YoY | Direction |
|---|---|---|---|---|---|
| May 2026 | 100 | — | +3.5% | +11.9% | N/A |
| Mid-June 2026 | 99.8 | -0.2% | — | +13.7% | N/A |
| Mid-July 2026 | 99.3 | -0.5% | -0.4% | +12.4% | AGREE |

**Direction agreement: 1/1 comparable months.**

This is expected to be a small, often-disagreeing sample: the model has **no notion of macro
used-EV market conditions** (demand shocks, tax-credit expiry, supply normalization — all of
which move the real Manheim EV Index, per its own published commentary this session) — it
only ages batteries down a fixed SoH/depreciation curve. Disagreement here is a real,
documented limitation of a pure engineering-fundamentals RV model, not a bug.

## Secondary sanity check: Autovista %RV anchors (EU, small-n, illustrative)

See `CALIBRATION_NOTE.md` for the full table and discussion — not repeated here to avoid
implying these EU whole-vehicle figures were used in the primary (US, battery-value) back-test
above. They were not blended into it.

## Recovery-model cross-check (feeds WS-D, partial)

The build spec also asks for a realized-recovery model calibrated to Manheim
conversion/guide-value behavior, feeding `tools/portfolio-sim`'s recovery assumptions.
Granular Manheim guide-value/conversion data (the MMR Valuations API, including
EV-battery-health-adjusted values) is paid-API-gated — confirmed this session, not just
unexplored (see `data/manheim/DATA_CARD.md`). This workstream's honest contribution here is
limited to a documented note: `tools/portfolio-sim`'s existing flat
`repossessionLiquidationDiscountPct: 20` is roughly consistent in direction with typical
wholesale-vs-retail EV gaps implied by the public Manheim index level, but this is **not** a
fitted conversion curve — a real one remains blocked by data access. No change was made to
`tools/portfolio-sim`; its `METHODOLOGY.md` already correctly states this is "not yet
calibrated... swappable later."

## Known limitations

- 3 Manheim observation points (May, mid-June, mid-July 2026), hand-entered — see
  `data/manheim/DATA_CARD.md` for why this isn't a scraper-fed series.
- Only mid-July 2026 has both a real EV Index %MoM figure and a directly-comparable modeled
  %MoM — the other release's %MoM figures come from partially-overlapping source articles
  (see per-row `notes` in `data/manheim/muvvi_ev_index.json`).
- The synthetic cohort is a coarse stand-in (one battery per chemistry) for illustrating
  directional behavior — it is not VoltLedger's actual scored fleet.

## How to reproduce

`pnpm rv-calibrate` (from repo root) regenerates this file and `CALIBRATION_NOTE.md`.

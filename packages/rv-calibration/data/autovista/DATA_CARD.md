# Autovista/JD Power EU BEV %RV — data card

## What this is

Three hand-entered EU country-level %RV (residual value, as % of original list price) figures
for BEVs at 3 years / 60,000 km, sourced from a single free Autovista24 news article
("BEV residual values suffer across Europe in April", April 2026 data). Confirmed real via
live web search on 2026-08-13 — search-index snippets surfaced the specific numbers even
though the source site (`autovista24.autovistagroup.com`, now merged into JD Power) 301s to
`jdpower.com` and returns 403 to automated fetching, so these were not scraped, they were
found via search and are individually citable back to that one article.

## What this is NOT

- **Not a systematic feed.** Three countries, one month, one article. Autovista/JD Power's
  systematic per-segment/chemistry curve data (Residual Value Monitor, AutovistaVALUATION)
  is a paid subscription product — confirmed gated, no public API/download found.
- **Not US market.** This is EU data (different EV subsidy/tax regimes, different market
  dynamics than the US). Given the session's decision to keep USD/US as canonical
  (overriding the build spec's original EUR/EU pivot for this workstream), these points are
  used as a **secondary, illustrative** sanity check only — never blended into the primary
  Manheim-based back-test's figures.
- **Not chemistry-specific.** These are blended BEV figures (all chemistries), not broken out
  by LFP/NMC/NCA/LTO the way `packages/scoring`'s constants are.
- **Not whole-vehicle-vs-battery equivalent.** This is whole-vehicle %RV (includes glider
  wear, mileage, brand depreciation — not just battery condition). Comparing it directly to
  this codebase's battery-only residual-value model is a real methodological mismatch — see
  `CALIBRATION_NOTE.md` for the specific numbers and why calibration only *reports* this gap
  rather than force-fitting `MARKET_DEPRECIATION_RATE` to close it.

## How it's used

`src/calibrate.ts` compares each chemistry's currently-implied 3yr battery-value retention
against this ~36–45% band as a documented, honest sanity check — not a fitting target.

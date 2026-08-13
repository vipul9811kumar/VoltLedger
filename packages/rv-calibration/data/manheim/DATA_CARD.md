# Manheim Used Vehicle Value Index (MUVVI) — EV Index data card

## What this is

Cox Automotive publishes the Manheim Used Vehicle Value Index monthly (plus a mid-month
update) — a US wholesale used-vehicle price index. As of May 2026 they began publishing a
separate **EV vs non-EV** split alongside the aggregate index. This is genuinely public,
free, ongoing data (confirmed via live web search, 2026-08-13) — no subscription or API key
required to read the published %YoY / %MoM figures in Cox Automotive's own insight articles.

## What this is NOT

- **Not an age-retention curve.** MUVVI/EV Index is a *calendar-time* index — it tracks how
  wholesale prices for the current mix of used EVs sold at auction move month to month. It
  has no age axis, no chemistry axis, and no per-vehicle retention-at-age-X figure. It cannot
  be used the way Autovista's %RV-at-3yr figures are used.
- **Not a bulk feed.** These three rows were hand-entered from Cox Automotive's own published
  articles (linked per-row) after confirming (2026-08-13) that granular Manheim data — the
  MMR Valuations API, including EV-battery-health-adjusted values — is paid-API-gated via
  Cox Automotive's Data Syndication team, not self-serve.
- **Not a large sample.** Three data points (May, mid-June, mid-July 2026). Extending this
  requires manually reading future Cox Automotive monthly releases — there is no scraper
  here, deliberately, since automated fetching of the underlying JD Power/Cox Automotive
  properties was found to be bot-protected during this session's research.

## How it's used

`src/backtest.ts` uses the %MoM / %YoY figures as the **primary, directional** back-test
signal: does the direction and rough magnitude of our modeled portfolio's aggregate RV trend
over the same calendar window match the real EV Index's movement? It is explicitly not used
to fit or replace `MARKET_DEPRECIATION_RATE` — see `CALIBRATION_NOTE.md` for why a
battery-value-only model isn't directly comparable to a whole-market wholesale-price index at
the calibration-fitting level either.

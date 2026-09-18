---
status: testing
phase: 01-live-price-terminal
source: [01-VERIFICATION.md]
started: 2026-09-18T02:45:00Z
updated: 2026-09-18T02:45:00Z
---

## Current Test

number: 1
name: MKT-01 — Watchlist grid streams all ten tickers with live-updating prices
expected: |
  Start the finished application (npm --prefix frontend run build; uv run --directory backend --extra dev uvicorn app.main:app --port 8000; open http://localhost:8000). All ten tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) visible with live-updating prices, no manual refresh needed.
awaiting: user response

## Tests

### 1. MKT-01 — Watchlist grid streams all ten tickers with live-updating prices
expected: All ten tickers visible with live-updating prices, no manual refresh needed
result: [pending]

### 2. MKT-02 — Price flash animation (green uptick / red downtick, fades within ~500ms)
expected: |
  Visible green/red flash animations occurring across the grid over several seconds, fading within ~500ms. Low-volatility tickers (JPM, V) legitimately produce no flash on some ticks when the price rounds to the same cent — the criterion is that flashes clearly occur across the grid over a few seconds, not that every row flashes every tick.
result: [pending]

### 3. MKT-03 — Sparklines fill in progressively from left to right
expected: Sparklines progressively draw as data arrives, starting empty on page load, over the first minute
result: [pending]

### 4. MKT-04 — Clicking a ticker draws its chart with readable axes and tooltip
expected: |
  Clicking several different tickers redraws the main chart for that symbol each time, with readable time/price axes and a working tooltip, and the clicked row is visibly highlighted.
result: [pending]

### 5. MKT-05 — Connection dot self-recovers after a real network drop
expected: |
  Header dot is green while streaming. With devtools network set to offline, the dot leaves green (amber while retrying, red only if it gives up). Restoring network brings the dot back to green by itself, with no page reload.
result: [pending]

### 6. Simulated-data disclosure is visible on screen
expected: A visible "Simulated market data" (or equivalent) disclosure string, legible at a normal viewport — not just present in the HTML source.
result: [pending]

### 7. Header shows no portfolio total or cash balance
expected: No dollar-denominated figure anywhere in the header — those belong to Phase 3 (PORT-01) and must not appear as placeholder figures.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

---
status: complete
phase: 01-live-price-terminal
source: [01-VERIFICATION.md]
started: 2026-09-18T02:45:00Z
updated: 2026-09-18T03:05:00Z
---

## Current Test

None — all tests complete.

## Tests

### 1. MKT-01 — Watchlist grid streams all ten tickers with live-updating prices
expected: All ten tickers visible with live-updating prices, no manual refresh needed
result: pass

### 2. MKT-02 — Price flash animation (green uptick / red downtick, fades within ~500ms)
expected: |
  Visible green/red flash animations occurring across the grid over several seconds, fading within ~500ms. Low-volatility tickers (JPM, V) legitimately produce no flash on some ticks when the price rounds to the same cent — the criterion is that flashes clearly occur across the grid over a few seconds, not that every row flashes every tick.
result: pass

### 3. MKT-03 — Sparklines fill in progressively from left to right
expected: Sparklines progressively draw as data arrives, starting empty on page load, over the first minute
result: pass (after fix)
root_cause: |
  frontend/components/Sparkline.tsx rendered its Recharts LineChart with no
  <YAxis>. Recharts' default domain for an unrendered axis is [0, dataMax] —
  for a ~$150-250 stock with cent-level fluctuations, that pins nearly the
  entire visible price range below the chart, so the line reads as flat.
  MainChart.tsx already avoids this with an explicit domain={["auto","auto"]}
  YAxis; Sparkline never got the same treatment.
fix: |
  Added a hidden YAxis (domain={["dataMin", "dataMax"]}) to both Sparkline
  render paths, keeping it visually axis-free while making the scale follow
  the actual price range. Commit 0c8b7e1. Verified: full frontend suite
  (54 tests), typecheck, and build all green after the fix. Server restarted
  on a freshly rebuilt frontend/out. Re-tested by user — confirmed working.

### 4. MKT-04 — Clicking a ticker draws its chart with readable axes and tooltip
expected: |
  Clicking several different tickers redraws the main chart for that symbol each time, with readable time/price axes and a working tooltip, and the clicked row is visibly highlighted.
result: pass

### 5. MKT-05 — Connection dot self-recovers after a real network drop
expected: |
  Header dot is green while streaming. With devtools network set to offline, the dot leaves green (amber while retrying, red only if it gives up). Restoring network brings the dot back to green by itself, with no page reload.
result: pass

### 6. Simulated-data disclosure is visible on screen
expected: A visible "Simulated market data" (or equivalent) disclosure string, legible at a normal viewport — not just present in the HTML source.
result: pass

### 7. Header shows no portfolio total or cash balance
expected: No dollar-denominated figure anywhere in the header — those belong to Phase 3 (PORT-01) and must not appear as placeholder figures.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. MKT-03 sparklines initially rendered flat due to a missing YAxis domain in Sparkline.tsx (Recharts defaults to a zero-anchored scale); fixed in commit 0c8b7e1 and confirmed working by the user on re-test.

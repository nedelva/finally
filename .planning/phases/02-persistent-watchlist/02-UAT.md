---
status: testing
phase: 02-persistent-watchlist
source: [02-VERIFICATION.md]
started: 2026-09-18T13:35:00Z
updated: 2026-09-18T13:35:00Z
---

## Current Test

number: 1
name: Initial watchlist load has no loading flicker
expected: |
  Reload the app in a browser and add several tickers to the watchlist; watch the initial
  GET /api/watchlist round trip on page load. No visible skeleton/spinner flash or layout
  jump — the watchlist grid appears populated on first paint, matching 02-01's assumption
  that a local SQLite read resolves fast enough to need no loading treatment.
awaiting: user response

## Tests

### 1. Initial watchlist load has no loading flicker
expected: No visible skeleton/spinner flash or layout jump — the watchlist grid appears populated on first paint, matching 02-01's assumption that a local SQLite read resolves fast enough to need no loading treatment.
result: [pending]

### 2. Add/remove ticker visual and interaction confirmation
expected: In a running browser, submit the add-ticker form (purple button, "Adding…" in-flight state) and click the × remove glyph on a row; confirm styling, color tokens (purple submit button, red × glyph, inline error text), disabled/"Adding…" state while in flight, and an immediate, visually clean row removal with no flash/flicker or accidental navigation to the chart — matching the UI-SPEC's Copywriting/Color contract.
result: [pending]

### 3. Failed initial watchlist fetch shows no user-visible error (confirmed code gap)
expected: Disconnect the backend (or force GET /api/watchlist to fail) while the app is loaded, and observe what the watchlist panel shows. `useWatchlist()` (frontend/lib/hooks.ts:77-107) captures a failed GET into an `error` string, but `Watchlist.tsx` never reads or renders it — a failed initial fetch currently renders as an indistinguishable empty watchlist with no message. This needs either a real fix (render the error) or an explicit product decision that silent-empty is acceptable for this phase.
result: [pending]

### 4. Watchlist panel overflow/scroll behavior with many tickers
expected: Add tickers until the watchlist panel exceeds one screen's worth of rows and observe the panel's layout behavior. The panel should either scroll internally or have some intentional overflow treatment — rows should not silently push the rest of the page layout in a way that breaks the terminal's dense, single-screen aesthetic. `Watchlist.tsx` currently has no overflow/scroll styling — this is an open design decision from 02-01, not yet resolved.
result: [pending]

### 5. Failed DELETE error message visibility
expected: Force `removeWatchlistTicker` to reject (e.g. simulate a failed DELETE) and confirm the UI treatment renders visibly and acceptably. The reused `watchlist-add-error` inline slot (under the add form, not next to the failing row) should display the server's error text. Wiring is confirmed by code read (`Watchlist.tsx`'s `setError` feeds the shared `<p data-testid="watchlist-add-error">`), but no test asserts the error text actually renders in that slot — only that `refetch` was not called.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

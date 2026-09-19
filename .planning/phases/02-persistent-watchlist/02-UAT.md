---
status: partial
phase: 02-persistent-watchlist
source: [02-VERIFICATION.md]
started: 2026-09-18T13:35:00Z
updated: 2026-09-19T00:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Initial watchlist load has no loading flicker
expected: No visible skeleton/spinner flash or layout jump — the watchlist grid appears populated on first paint, matching 02-01's assumption that a local SQLite read resolves fast enough to need no loading treatment.
result: issue
reported: "the previous verification failed too (I was watching a stale page) - upon recheck the initial page does not show any tickers"
severity: blocker

### 2. Add/remove ticker visual and interaction confirmation
expected: In a running browser, submit the add-ticker form (purple button, "Adding…" in-flight state) and click the × remove glyph on a row; confirm styling, color tokens (purple submit button, red × glyph, inline error text), disabled/"Adding…" state while in flight, and an immediate, visually clean row removal with no flash/flicker or accidental navigation to the chart — matching the UI-SPEC's Copywriting/Color contract.
result: issue
reported: "the add action returns a 405 status"
severity: blocker

### 3. Failed initial watchlist fetch shows no user-visible error (confirmed code gap)
expected: Disconnect the backend (or force GET /api/watchlist to fail) while the app is loaded, and observe what the watchlist panel shows. A failed initial fetch should surface some visible indication to the user rather than rendering as an indistinguishable empty watchlist.
result: issue
reported: "I killed the backend and refreshed the page. There is no error message showing up"
severity: major

### 4. Watchlist panel overflow/scroll behavior with many tickers
expected: Add tickers until the watchlist panel exceeds one screen's worth of rows and observe the panel's layout behavior. The panel should either scroll internally or have some intentional overflow treatment.
result: blocked
blocked_by: other
reason: "Impossible to test due to previous failures; the Add action does not lead to adding a ticker"

### 5. Failed DELETE error message visibility
expected: Force removeWatchlistTicker to reject and confirm the UI treatment renders visibly and acceptably — the reused watchlist-add-error inline slot should display the server's error text.
result: blocked
blocked_by: other
reason: "Blocked by same root cause as test 4 — Add flow is broken (405), so a ticker cannot be added to then test its removal"

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
issues: 3
pending: 0
skipped: 0
blocked: 2

## Gaps

- gap_id: G-02-1
  truth: "Reload the app in a browser; the watchlist grid appears populated with tickers on first paint (no skeleton/spinner flash, no layout jump)."
  status: failed
  reason: "User reported: the previous verification failed too (I was watching a stale page) - upon recheck the initial page does not show any tickers"
  severity: blocker
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-02-2
  truth: "Submitting the add-ticker form successfully adds a ticker to the watchlist."
  status: failed
  reason: "User reported: the add action returns a 405 status"
  severity: blocker
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- gap_id: G-02-3
  truth: "A failed initial GET /api/watchlist surfaces a visible error to the user instead of rendering as an indistinguishable empty watchlist."
  status: failed
  reason: "User reported: I killed the backend and refreshed the page. There is no error message showing up"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

## Gaps

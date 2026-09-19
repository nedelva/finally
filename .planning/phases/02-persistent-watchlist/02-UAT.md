---
status: testing
phase: 02-persistent-watchlist
source: [02-VERIFICATION.md, 02-04-SUMMARY.md]
started: 2026-09-18T13:35:00Z
updated: 2026-09-19T13:15:00Z
---

## Current Test

number: 1
name: Initial watchlist load has no loading flicker
expected: |
  Reload the app in a browser. The watchlist grid appears populated with tickers on first
  paint — no skeleton/spinner flash, no layout jump. (Retest: 02-04 fixed Watchlist.tsx to
  render a loading state that reuses the same table shell/header as the populated state,
  specifically to avoid the layout jump this test checks for.)
awaiting: user response

## Tests

### 1. Initial watchlist load has no loading flicker
expected: No visible skeleton/spinner flash or layout jump — the watchlist grid appears populated on first paint. Retest after 02-04's fix (shared table shell across loading/populated states).
result: [pending]

### 2. Add/remove ticker visual and interaction confirmation
expected: In a running browser, submit the add-ticker form (purple button, "Adding…" in-flight state) and click the × remove glyph on a row; confirm styling, color tokens (purple submit button, red × glyph, inline error text), disabled/"Adding…" state while in flight, and an immediate, visually clean row removal with no flash/flicker or accidental navigation to the chart. Retest: the earlier 405 was a stale-backend artifact (G-02-2, resolved), not a code defect — this is the first real attempt at this test.
result: [pending]

### 3. Failed initial watchlist fetch shows a visible error
expected: Disconnect the backend (or force GET /api/watchlist to fail) while the app is loaded, and observe what the watchlist panel shows. A distinct, visible error message should now appear (dedicated watchlist-load-error slot), not an indistinguishable empty watchlist. Retest after 02-04's fix.
result: [pending]

### 4. Watchlist panel overflow/scroll behavior with many tickers
expected: Add tickers until the watchlist panel exceeds one screen's worth of rows and observe the panel's layout behavior. The panel should either scroll internally or have some intentional overflow treatment — rows should not silently push the rest of the page layout. This was never actually executed before (blocked by the stale-backend 405); no code addresses overflow/scroll in any of the four plans.
result: [pending]

### 5. Failed DELETE error message visibility
expected: Force removeWatchlistTicker to reject (e.g. simulate a failed DELETE) and confirm the UI treatment renders visibly and acceptably — the reused watchlist-add-error inline slot should display the server's error text. This was never actually executed before (blocked by the stale-backend 405).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-1
  truth: "Reload the app in a browser; the watchlist grid appears populated with tickers on first paint (no skeleton/spinner flash, no layout jump)."
  status: resolved
  reason: "User reported: the previous verification failed too (I was watching a stale page) - upon recheck the initial page does not show any tickers"
  severity: blocker
  test: 1
  root_cause: "Same underlying defect as G-02-3: Watchlist.tsx:31 destructured only { watchlist, refetch } from useWatchlist(), discarding error/loading. A failed GET /api/watchlist rendered byte-identically to a genuinely empty watchlist. useWatchlist() also fetches once on mount with no retry, so a failed fetch was terminal for the session. Directly reproduced via Playwright route interception (aborting the render-driving GET): table stayed at 0 rows indefinitely with no error shown, while a second independent useWatchlist() instance (app/page.tsx:12) received data fine — proving the failure was isolated and silently swallowed, not a backend-wide outage."
  artifacts:
    - path: "frontend/components/Watchlist.tsx"
      issue: "Line 31 discarded error/loading fields from useWatchlist(); single empty-state branch (watchlist.length === 0) couldn't distinguish empty vs. load-failed vs. loading"
    - path: "frontend/lib/hooks.ts"
      issue: "useWatchlist() (lines 77-107) fetches once on mount, no retry/poll — a transient failure was terminal for the session (unchanged by 02-04, out of scope)"
  missing:
    - "Render a distinct state for load-failure vs. genuine empty vs. loading in Watchlist.tsx"
  debug_session: ".planning/debug/watchlist-empty-on-load.md"
  resolved_by: "02-04"
  resolved_at: "2026-09-19T12:45:00Z"

- gap_id: G-02-2
  truth: "Submitting the add-ticker form successfully adds a ticker to the watchlist."
  status: resolved
  reason: "User reported: the add action returns a 405 status"
  severity: blocker
  test: 2
  root_cause: "Not a code defect. The backend process serving the original UAT session predated the phase-02 watchlist routes (a long-lived uvicorn process with no --reload, never restarted after the 02-01/02-02 commits landed), so POST /api/watchlist fell through to the StaticFiles mount at / and returned Starlette's 405 for an unclaimed method+path. All reviewed backend/frontend code (backend/app/api/watchlist.py, backend/app/main.py, frontend/lib/api.ts, frontend/components/Watchlist.tsx) is correct. Live-reproduced the exact 405 shape on demand by hitting a route unclaimed by any handler, with zero code changes. Re-verified live after this session's backend restart: POST /api/watchlist now returns 201 (first add) / 409 (duplicate) as expected — the gap does not reproduce against current code."
  artifacts: []
  missing: []
  debug_session: ".planning/debug/add-ticker-405-g02-2.md"
  resolved_by: "backend restart (no code change)"
  resolved_at: "2026-09-19T09:33:00Z"

- gap_id: G-02-3
  truth: "A failed initial GET /api/watchlist surfaces a visible error to the user instead of rendering as an indistinguishable empty watchlist."
  status: resolved
  reason: "User reported: I killed the backend and refreshed the page. There is no error message showing up"
  severity: major
  test: 3
  root_cause: "Watchlist.tsx:31 destructured only { watchlist, refetch } from useWatchlist(), discarding the hook's error/loading fields. useWatchlist() (hooks.ts:77-107) correctly captured a failed GET into its own error state (setError(res.error), line 90) — the hook worked fine — but Watchlist.tsx never read it. Watchlist.tsx also had its own separately-scoped error state (line 35, same name) used only for add/remove form failures (feeds the watchlist-add-error <p>) — a naive destructure of useWatchlist()'s error would have silently shadowed it. Additionally, the approved UI-SPEC Copywriting Contract (02-UI-SPEC.md:126) states the empty-state heading should show 'only if the user removes every ticker' — the prior behavior (showing it during loading and on fetch-failure too) actively violated that already-approved contract."
  artifacts:
    - path: "frontend/components/Watchlist.tsx"
      issue: "Discarded useWatchlist()'s error/loading; local error state (line 35) separately scoped for add/remove-only; render condition contradicted 02-UI-SPEC.md:126's approved empty-state contract"
    - path: "frontend/__tests__/Watchlist.test.tsx"
      issue: "mockUseWatchlist() helper hardcoded error: null, loading: false — no coverage for the failed/loading states"
  missing:
    - "Destructure error/loading from useWatchlist() under distinct names (e.g. loadError) to avoid colliding with the existing add/remove error state"
    - "Render precedence: loading -> loadError -> watchlist.length === 0 -> table"
    - "Decide whether load-error gets its own slot or is reconciled with the existing watchlist-add-error slot"
    - "Test coverage for the failed-load and loading states"
  debug_session: ".planning/debug/watchlist-load-error-silent.md"
  resolved_by: "02-04"
  resolved_at: "2026-09-19T12:45:00Z"

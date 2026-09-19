---
status: diagnosed
phase: 02-persistent-watchlist
source: [02-VERIFICATION.md, 02-04-SUMMARY.md]
started: 2026-09-18T13:35:00Z
updated: 2026-09-19T13:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Initial watchlist load has no loading flicker
expected: No visible skeleton/spinner flash or layout jump — the watchlist grid appears populated on first paint. Retest after 02-04's fix (shared table shell across loading/populated states).
result: pass

### 2. Add/remove ticker visual and interaction confirmation
expected: In a running browser, submit the add-ticker form (purple button, "Adding…" in-flight state) and click the × remove glyph on a row; confirm styling, color tokens (purple submit button, red × glyph, inline error text), disabled/"Adding…" state while in flight, and an immediate, visually clean row removal with no flash/flicker or accidental navigation to the chart.
result: issue
reported: "the delete action is not user-friendly; the × remove glyph is too small and require very precise positioning of the mouse cursor and sometimes it needs two-three clicks until is triggered. Upon DevTools inspection I see the element is an html button; I would prefer a different styling that makes it stand out from the surrounding background. Other than that, I am happy with it."
severity: minor

### 3. Failed initial watchlist fetch shows a visible error
expected: Disconnect the backend (or force GET /api/watchlist to fail) while the app is loaded, and observe what the watchlist panel shows. A distinct, visible error message should now appear, not an indistinguishable empty watchlist.
result: pass

### 4. Watchlist panel overflow/scroll behavior with many tickers
expected: Add tickers until the watchlist panel exceeds one screen's worth of rows and observe the panel's layout behavior. The panel should either scroll internally or have some intentional overflow treatment — rows should not silently push the rest of the page layout.
result: issue
reported: "adding more tickers make the panel grow larger. as a result only the page get a scroll bar. Another side effect is that the chart grows and keeps having the same height as the watch list panel."
severity: major

### 5. Failed DELETE error message visibility
expected: Force removeWatchlistTicker to reject (e.g. simulate a failed DELETE) and confirm the UI treatment renders visibly and acceptably — the reused watchlist-add-error inline slot should display the server's error text.
result: pass
result: [pending]

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-4
  truth: "The watchlist row remove (×) control is easy to hit with a mouse — a reasonably sized, clearly-actionable target."
  status: failed
  reason: "User reported: the delete action is not user-friendly; the × remove glyph is too small and require very precise positioning of the mouse cursor and sometimes it needs two-three clicks until is triggered. Upon DevTools inspection I see the element is an html button; I would prefer a different styling that makes it stand out from the surrounding background. Other than that, I am happy with it."
  severity: minor
  test: 2
  root_cause: "WatchlistRow.tsx:109-118's remove button has className=\"text-sm text-[var(--color-down)]\" — no padding, no min-width/min-height, no background/border. Its clickable hit-box is exactly the glyph's intrinsic content box for a single 14px x character (~8-10px x ~17-20px), far under WCAG 2.5.8 AA's 24x24px minimum. Tailwind v4 Preflight actively zeroes the browser's default button padding/border, so nothing compensates. The wrapping <td> carries visual padding (py-1.5 pr-3) that makes the clickable-looking zone larger than the button's true hit box, so near-misses silently fail — explaining both 'requires precise positioning' and '2-3 clicks to trigger'. This is a design-contract gap, not an implementation deviation: 02-UI-SPEC.md:148 specifies only the glyph's typography/color and never specifies a hit-area size or background/hover affordance — the implementation is spec-compliant, the spec under-specified the control. Ruled out: overlapping siblings, event-bubbling/double-fire, remount-during-click (rows are keyed by ticker, not remounted on stream ticks)."
  artifacts:
    - path: "frontend/components/WatchlistRow.tsx"
      issue: "Remove button (lines 109-118) has zero padding/background/border/hover/focus classes — hit box is the bare glyph"
    - path: ".planning/phases/02-persistent-watchlist/02-UI-SPEC.md"
      issue: "Line 148 (and color table line 79, which forbids purple here — reserved for Add Ticker) specifies only typography/color, never hit-area size or resting-state affordance"
  missing:
    - "Fixed ~24x24px flex-centered hit box around the glyph (e.g. inline-flex items-center justify-center h-6 w-6), sized to fit inside the current ~32px row height"
    - "Visible resting-state background/border using --color-down (not purple, per spec constraint) so it stands out from the surrounding background, per the user's explicit request — not hover-only"
    - "Reuse the existing focus:ring-1 focus:ring-[var(--color-primary-blue)] convention (Watchlist.tsx:105) for keyboard focus"
  debug_session: ".planning/debug/remove-button-hit-area-g02-4.md"

- gap_id: G-02-5
  truth: "The watchlist panel scrolls internally (or has an intentional overflow treatment) once it exceeds one screen's worth of rows — the rest of the page layout, including the main chart, is unaffected by watchlist row count."
  status: failed
  reason: "User reported: adding more tickers make the panel grow larger. as a result only the page get a scroll bar. Another side effect is that the chart grows and keeps having the same height as the watch list panel."
  severity: major
  test: 4
  root_cause: "Two coupled defects, one shared upstream trigger (this was explicitly flagged as an unresolved design decision at 02-01 planning time, 02-01-PLAN.md:50, never actioned since). (1) No scroll bound: Watchlist.tsx:92's outer panel div has no max-h-*/overflow-y-auto; height is purely content-driven (one row per entry, uncapped), and no ancestor constrains height either, so the browser falls back to page-level scroll. (2) Chart height coupling: page.tsx:43's row container (flex flex-col gap-4 lg:flex-row) sets no items-start override, so it uses flexbox's default align-items: stretch at the lg: breakpoint. Combined with MainChart.tsx:41's PanelChrome root div (flex h-full flex-col ...), MainChart's bordered box resolves h-full against its stretched parent — inheriting whichever sibling is tallest, which is always the unbounded, growing Watchlist. The chart's drawn content stays fixed at PANEL_HEIGHT=320 (MainChart.tsx:31,137) — only the empty space in the surrounding box grows, matching the user's exact wording. IMPORTANT for the fix: bounding Watchlist's height alone fixes symptom 1 but only masks symptom 2 (if the cap is set below MainChart's natural height, the coupling mechanism reverses and Watchlist gets stretched to match MainChart instead) — true decoupling requires separately touching the align-items/h-full pairing."
  artifacts:
    - path: "frontend/components/Watchlist.tsx"
      issue: "Line 92 panel wrapper missing height bound / scroll treatment"
    - path: "frontend/app/page.tsx"
      issue: "Line 43 flex row missing items-start override (defaults to stretch)"
    - path: "frontend/components/MainChart.tsx"
      issue: "Line 41 PanelChrome's h-full is the piece that visibly inherits the stretched height from the row"
  missing:
    - "Bounded scroll container on the Watchlist panel (max-h-* + overflow-y-auto on Watchlist.tsx:92)"
    - "Decouple MainChart from the row's stretch behavior (items-start on page.tsx:43's row div, or remove/replace h-full on MainChart.tsx:41) — independent of the scroll fix, both are needed"
  debug_session: ".planning/debug/watchlist-scroll-chart-height-g02-5.md"

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

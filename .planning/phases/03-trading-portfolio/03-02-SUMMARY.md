---
phase: 03-trading-portfolio
plan: 02
subsystem: ui
tags: [react, hooks, sse, portfolio-valuation, vitest, tdd]

requires:
  - phase: 03-trading-portfolio
    provides: "usePortfolio() (03-01) already mounted in page.tsx, feeding cash_balance and positions"
provides:
  - "useLiveTotalValue(portfolio, ticks) — client-side live portfolio valuation in frontend/lib/hooks.ts"
  - "Header.tsx cashBalance/totalValue props — the header's first dollar-denominated figures (PORT-01)"
  - "First dedicated test coverage for deriveLivePosition, including its D-03 no-live-price fallback branch"
affects: [03-03-positions-table-heatmap, 03-04-pnl-chart-snapshot-task]

actuals:
  tokens: 3900
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure-derivation hook (no useState/useEffect) over two already-mounted data sources (usePortfolio + usePriceStreamContext), rather than a third fetch or a second EventSource"
    - "formatMoney(null) as the single code path covering both pre-load and fetch-error states — no separate loading/error branch in the component"

key-files:
  created:
    - frontend/__tests__/positionMath.test.ts
    - frontend/__tests__/Header.test.tsx
  modified:
    - frontend/lib/hooks.ts
    - frontend/components/Header.tsx
    - frontend/app/page.tsx
    - frontend/__tests__/ConnectionDot.test.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "useLiveTotalValue routes every position through the existing deriveLivePosition rather than recomputing quantity*price inline, guaranteeing the header total and the (03-03) positions table always agree and share the same D-03 no-live-tick fallback"
  - "Header figures are neutral gray-100/tabular-nums with no up/down color and no flash animation — per UI-SPEC, per-position P&L coloring already lives in the positions table/heatmap and a second signal for the same number would compete with it"

patterns-established:
  - "A hook whose docstring in a prior plan already reserved its name and shape is implemented as a pure prop derivation, not a new fetch — closing a documented gap without adding new I/O"

requirements-completed: [PORT-01]

coverage:
  - id: D1
    description: "useLiveTotalValue derives cash_balance + sum(deriveLivePosition(position, tick).marketValue) for every position, returning null for a null portfolio"
    requirement: "PORT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/positionMath.test.ts::useLiveTotalValue (5 cases: null portfolio, zero positions, two live-ticked positions, no-tick fallback, tick-present override)"
        status: pass
    human_judgment: false
  - id: D2
    description: "deriveLivePosition's D-03 fallback branch (livePrice === undefined) echoes the position's four snapshot fields unchanged; the live branch derives marketValue/pnl/pnlPercent correctly including the avg_cost=0 edge case"
    requirement: "PORT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/positionMath.test.ts::deriveLivePosition (4 cases: undefined-price fallback, price-above-avg_cost, price-below-avg_cost, avg_cost=0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Header renders cashBalance and totalValue as neutral, non-flashing, tabular-nums figures, falling back to formatMoney's em dash before load and on fetch failure, without dropping the wordmark, disclosure, or connection dot"
    requirement: "PORT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Header.test.tsx (5 cases: loaded $10,000.00 in both figures, null-props em dash with no digit, null-props with no second error element, wordmark+disclosure present in both states, connection dot still reflects status)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run build succeeds and the static export still renders FinAlly"
    requirement: "PORT-01"
    verification:
      - kind: other
        ref: "npm --prefix frontend run build && grep -q FinAlly frontend/out/index.html"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visually, the header shows a cash figure and a total-value figure side by side with the connection dot in the running terminal, the total ticks as prices move, and neither figure flashes or strobes"
    verification: []
    human_judgment: true
    rationale: "Automated tests cover DOM content and class presence, not the felt experience of watching the total tick live over a real SSE stream or confirming the complete absence of any visual strobe at the ~500ms cadence; a human should load the running app per the plan's <human-check>."

duration: 18min
completed: 2026-09-20
status: complete
---

# Phase 3 Plan 02: Header Live Portfolio Valuation Summary

**Live header cash + portfolio value via a pure `useLiveTotalValue` derivation over `deriveLivePosition`, closing the `hooks.ts` gap `usePortfolio`'s own docstring had reserved.**

## Performance
- **Duration:** 18min
- **Started:** 2026-09-20T15:06:04+02:00
- **Completed:** 2026-09-20T15:24:00+02:00
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments
- `useLiveTotalValue(portfolio, ticks)` added to `frontend/lib/hooks.ts` — a pure, stateless derivation (no `useState`/`useEffect`) that sums `cash_balance` plus every position's live market value via the existing `deriveLivePosition`, so the header total can never disagree with the (03-03) positions table and correctly falls back to the server's own `market_value` when no SSE tick has arrived for a ticker yet.
- `Header.tsx` now renders the app's first dollar-denominated figures — cash balance and live total portfolio value — as neutral, `tabular-nums`, non-flashing text beside the existing wordmark and connection dot, honoring the Phase 1 prohibition against a faked placeholder number via `formatMoney`'s existing null-safe em-dash fallback.
- `deriveLivePosition` (previously untested despite being load-bearing since D-03) now has dedicated coverage for both branches, including the `avg_cost = 0` edge case.

## Task Commits
1. **Task 1: Live portfolio valuation** — `cb854af` (test, RED) → `4e4cbca` (feat, GREEN)
2. **Task 2: Header cash balance and live total portfolio value** — `41946e5` (test, RED) → `95428a0` (feat, GREEN)

**Plan metadata:** committed alongside this SUMMARY (see final commit hash in STATE.md history).

_TDD tasks: each produced a RED (failing test) commit followed by a GREEN (implementation) commit — no separate REFACTOR commit was needed for either task._

## Files Created/Modified
- `frontend/lib/hooks.ts` — added `useLiveTotalValue`, imports `deriveLivePosition` from `./positionMath`
- `frontend/components/Header.tsx` — `HeaderProps.cashBalance`/`totalValue`, two new figures, updated file-header comment
- `frontend/app/page.tsx` — destructures `portfolio` from `usePortfolio()`, calls `useLiveTotalValue(portfolio, ticks)`, feeds both into `<Header>`
- `frontend/__tests__/positionMath.test.ts` — new file, 9 tests covering `deriveLivePosition` and `useLiveTotalValue`
- `frontend/__tests__/Header.test.tsx` — new file, 5 tests covering loaded/loading/error header rendering
- `frontend/__tests__/ConnectionDot.test.tsx` — updated the two pre-existing `Header` tests for the new required props (see Deviations)
- `frontend/__tests__/Watchlist.test.tsx` — added `useLiveTotalValue` to the `@/lib/hooks` mock (see Deviations)

## Decisions Made
- `useLiveTotalValue` is a pure derivation over already-mounted hooks (`usePortfolio`, `usePriceStreamContext`), not a new fetch or a second `EventSource` — matches the RESEARCH.md "Don't Hand-Roll" guidance against a second live-value stream.
- Header figures carry no flash animation and no up/down color, even though the total recomputes ~2x/sec — per-position P&L coloring already lives in the positions table/heatmap; a second color signal for the same underlying number would compete with it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `ConnectionDot.test.tsx`'s two pre-existing `Header` tests needed the new required props**
- **Found during:** Task 2
- **Issue:** `HeaderProps` gained required `cashBalance`/`totalValue` fields. `ConnectionDot.test.tsx` (written in Phase 1, before PORT-01 existed) rendered `<Header status="connected" />` with no other props and asserted "renders no dollar-denominated figure — portfolio total and cash balance arrive in a later phase." That later phase is this one; both the type and the assertion were now stale.
- **Fix:** Passed `cashBalance={10000} totalValue={10000}` to the brand/disclosure/dot test (unrelated to the dollar-figure assertion). Rewrote the second test to pass `cashBalance={null} totalValue={null}` and retitled it to assert the pre-load em-dash rule, rather than deleting a test that now exercises a real, still-true behavior (no dollar figure before data loads).
- **Files modified:** `frontend/__tests__/ConnectionDot.test.tsx`
- **Verification:** `npm run typecheck` (0 errors) and `npm run test` (110/110 passing).
- **Committed in:** `95428a0`

**2. [Rule 3 - Blocking issue] `Watchlist.test.tsx`'s `@/lib/hooks` mock needed a `useLiveTotalValue` stub**
- **Found during:** Task 2
- **Issue:** `page.tsx` now calls `useLiveTotalValue()` (imported from `@/lib/hooks`) to feed `Header`'s `totalValue` prop. `Watchlist.test.tsx` fully mocks `@/lib/hooks` (established in 03-01 for `usePortfolio`) and several tests render `<Page />` through that mock — calling the now-undefined `useLiveTotalValue` as a function crashed 5 of those tests.
- **Fix:** Added `useLiveTotalValue: vi.fn(() => null)` to the existing mock, matching the same pattern 03-01 used for `usePortfolio`.
- **Files modified:** `frontend/__tests__/Watchlist.test.tsx`
- **Verification:** `npm run test` — all 110 frontend tests pass (previously 5 failing in this file after the `page.tsx` change).
- **Committed in:** `95428a0`

---
**Total deviations:** 2 auto-fixed (both blocking issues, both isolated to pre-existing test-double setup).
**Impact on plan:** None on scope or behavior — both are necessary, mechanical consequences of `Header`'s new required props and `page.tsx`'s new `useLiveTotalValue` call, exactly mirroring the same class of fix 03-01 made for `usePortfolio`.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `useLiveTotalValue` and `deriveLivePosition`'s test coverage are both available for 03-03's `PositionsTable`/`Heatmap` to build on without re-deriving the same math.
- `page.tsx` now destructures `portfolio` from `usePortfolio()` — 03-03 can consume it directly rather than re-wiring the hook call site.
- No blockers for 03-03 or 03-04.
- Human verification still open per this plan's `<human-check>`: load the running app and confirm the header's cash/total figures render correctly and never flash — deferred to end-of-phase UAT per this project's `human_verify_mode`.

---
*Phase: 03-trading-portfolio*
*Completed: 2026-09-20*

## Self-Check: PASSED

All created files verified present on disk (`frontend/__tests__/positionMath.test.ts`, `frontend/__tests__/Header.test.tsx`, this SUMMARY.md); all four task commits (`cb854af`, `4e4cbca`, `41946e5`, `95428a0`) verified present in `git log --oneline --all`.

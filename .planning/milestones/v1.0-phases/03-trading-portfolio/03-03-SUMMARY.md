---
phase: 03-trading-portfolio
plan: 03
subsystem: ui
tags: [react, recharts, treemap, portfolio-visualization, vitest, tdd]

requires:
  - phase: 03-trading-portfolio
    provides: "deriveLivePosition (03-02), usePortfolio()/portfolio.positions and useLiveTotalValue already mounted in page.tsx (03-01/03-02)"
provides:
  - "PositionsTable.tsx — live six-column positions table (Symbol/Qty/Avg Cost/Price/P&L/Chg %) recomputed through deriveLivePosition"
  - "Heatmap.tsx — recharts Treemap sized by market value, coloured green/red/neutral by live P&L percent, click-to-select"
  - "Both components mounted in page.tsx, wired to the shared setSelectedTicker callback (D-10) and to usePortfolio()'s loading/error"
affects: [03-04-pnl-chart-snapshot-task]

actuals:
  tokens: 6362
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "recharts Treemap content render-prop as a plain function (props) => <Tile .../> rather than an element clone — matches the RESEARCH.md Context7-sourced example and avoids a placeholder-props element"
    - "Local TileDatum interface widened with a [key: string]: unknown index signature to satisfy recharts' TreemapDataType constraint on the data array"

key-files:
  created:
    - frontend/components/PositionsTable.tsx
    - frontend/components/Heatmap.tsx
    - frontend/__tests__/PositionsTable.test.tsx
    - frontend/__tests__/Heatmap.test.tsx
  modified:
    - frontend/app/page.tsx

key-decisions:
  - "PositionsTable and Heatmap both take positions/ticks/loading/error/onSelect directly as props (no internal fetch) — page.tsx destructures loading/error from the already-mounted usePortfolio() call, matching the plan's stated wiring exactly rather than introducing a second data-fetch path"
  - "Heatmap's content render-prop is a plain function over recharts' TreemapNode type, not a cloned placeholder element — recharts spreads each data row's own fields (name, size, pnlPercent) onto the computed node before invoking content(nodeProps), confirmed by reading node_modules/recharts/es6/chart/Treemap.js this session, so the function form needs no placeholder props"
  - "PositionsTable and Heatmap panel/row layout reused verbatim from Watchlist.tsx (table shell, scroll container) and MainChart.tsx (PanelChrome, explicit width/height jsdom escape hatch) per the plan's read_first list — no new panel chrome pattern introduced"

patterns-established:
  - "A recharts custom chart element (Treemap tile) colours by a semantic CSS custom property in an inline `style` object (not an SVG presentation attribute) — confirmed this resolves correctly in real browsers, unlike the Sparkline stroke precedent which used a literal hex specifically because presentation attributes don't reliably resolve custom properties"

requirements-completed: [PORT-04, PORT-05]

coverage:
  - id: D1
    description: "PositionsTable renders one row per holding with Symbol/Qty/Avg Cost/Price/P&L/Chg % where every price-derived cell recomputes from the live SSE tick through deriveLivePosition, falling back to the REST snapshot's own fields when no tick matches"
    requirement: "PORT-04"
    verification:
      - kind: unit
        ref: "frontend/__tests__/PositionsTable.test.tsx (10 cases: six headers, live-tick recompute, REST-snapshot fallback, D-03 flat-colour guard, avg_cost=0 percent guard, empty/loading/error precedence, off-watchlist holding, click-to-select)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Heatmap renders a recharts Treemap sized by each position's live market value and coloured green/red/neutral by live P&L percent, with tiles wired to the shared setSelectedTicker callback (D-10) and a D-11 empty-state message"
    requirement: "PORT-05"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Heatmap.test.tsx (9 cases: svg+rect rendering, up/down/neutral tile fill, click-to-select, D-11 empty state, loading/error panel treatment, tile-area proportionality by market value)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full frontend suite, typecheck, and static export build stay green with both new components mounted in page.tsx"
    verification:
      - kind: unit
        ref: "npm --prefix frontend run test (129/129 passing, up from 120)"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run typecheck (0 errors)"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run build && grep -q FinAlly frontend/out/index.html"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visually, buying two different tickers shows a heatmap with one visibly-larger tile per the bigger holding, green/red tile colouring, click-to-select switching the main chart, and the positions table's price/P&L cells moving with the live stream"
    verification: []
    human_judgment: true
    rationale: "Automated tests cover DOM structure, colour tokens, and geometry ratios under jsdom's synchronous render, not the felt experience of watching tiles resize and prices flash together over a real ~500ms SSE cadence in a running browser; per this project's human_verify_mode=end-of-phase, this plan's own <human-check> (buy two tickers, confirm sizing/colour/click-to-select/empty-state-on-sell-all) is deferred to end-of-phase UAT rather than a mid-plan halt."

duration: 15min
completed: 2026-09-20
status: complete
---

# Phase 3 Plan 03: Positions Table and Portfolio Heatmap Summary

**Live six-column positions table and a P&L-coloured recharts Treemap heatmap, both recomputing off the same `deriveLivePosition` math the header total already uses, with heatmap tiles wired into the existing click-to-select callback.**

## Performance
- **Duration:** 15min
- **Started:** 2026-09-20T15:06:00+02:00 (approx.)
- **Completed:** 2026-09-20T15:22:07+02:00
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `PositionsTable.tsx` gives every holding a live row — ticker, quantity, average cost, current price, unrealized P&L, and percent change — recomputed per-render through `deriveLivePosition(position, ticks[ticker]?.price)`, so its numbers can never drift from the header's `useLiveTotalValue` total. A position on the D-03 avg_cost fallback (zero P&L) renders in the neutral flat colour, never green or red.
- `Heatmap.tsx` renders recharts' own `Treemap`, sized by each position's live market value (`dataKey="size"`) and coloured green/red/neutral by live P&L percent, with a custom tile that carries the same `onSelect` callback a watchlist row click uses (D-10) — no second selection mechanism. Zero positions render the D-11 empty-state message inside the panel chrome rather than hiding the panel.
- Both components are mounted side-by-side in `page.tsx` below the trade bar, each fed `loading`/`error` now destructured from the already-mounted `usePortfolio()` call — no new data-fetch path introduced.

## Task Commits
1. **Task 1: Positions table** — `ed7cdd5` (test, RED) → `00fe2c3` (feat, GREEN)
2. **Task 2: Portfolio heatmap** — `0fe99f4` (test, RED) → `f5e61e9` (feat, GREEN)

**Plan metadata:** committed alongside this SUMMARY (see final commit hash in STATE.md history).

_TDD tasks: each produced a RED (failing test, via module-resolution failure on the not-yet-existing component — the same convention 03-01's TradeBar RED commit used) followed by a GREEN (implementation) commit — no separate REFACTOR commit was needed for either task._

## Files Created/Modified
- `frontend/components/PositionsTable.tsx` — new, 143 lines. Six-column live table over `deriveLivePosition`, reusing `Watchlist.tsx`'s panel/scroll-container shape and `WatchlistRow`'s `changeColorClass`/border/`tabular-nums` conventions.
- `frontend/components/Heatmap.tsx` — new, 180 lines. recharts `Treemap` with a custom tile content function, reusing `MainChart.tsx`'s `PanelChrome` and explicit width/height jsdom escape hatch.
- `frontend/__tests__/PositionsTable.test.tsx` — new, 10 tests.
- `frontend/__tests__/Heatmap.test.tsx` — new, 9 tests.
- `frontend/app/page.tsx` — destructures `loading`/`error` from `usePortfolio()`; mounts `PositionsTable` and `Heatmap` side-by-side in a new layout row below the trade bar, both wired to `setSelectedTicker`.

## Decisions Made
- Heatmap's `content` render-prop is a plain function `(props: TreemapNode) => <HeatmapTile .../>`, not a cloned placeholder element — confirmed by reading `node_modules/recharts/es6/chart/Treemap.js` this session that recharts spreads each data row's own fields (`name`, `size`, `pnlPercent`) onto the computed node before calling `content(nodeProps)`, so no placeholder-prop element was needed to satisfy the type checker.
- `TileDatum` carries an explicit `[key: string]: unknown` index signature so the local data-shaping type satisfies recharts' `TreemapDataType` constraint — a type-level accommodation, not a runtime behavior change.
- Both new components take `positions`/`ticks`/`loading`/`error`/`onSelect` directly as props rather than fetching internally, matching the plan's explicit wiring instructions and keeping `usePortfolio()` as the single portfolio data-fetch site in `page.tsx`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Heatmap test's neutral-fill assertion used a literal hex string jsdom never serializes**
- **Found during:** Task 2 (Heatmap), first test run after implementation
- **Issue:** The RED test asserted `rect.getAttribute("style")` contains the literal `"#8b949e"`. jsdom's CSSOM normalizes hex colors set via an inline `style` object into `rgb(...)` when serializing the `style` attribute, so the assertion failed against a correctly-implemented component (`fill: rgb(139, 148, 158); ...`), not a bug in `Heatmap.tsx`.
- **Fix:** Changed the assertion to check for the jsdom-normalized `rgb(139, 148, 158)` string, plus explicit negative checks that neither `var(--color-up)` nor `var(--color-down)` leaked into the neutral tile's style — strengthens the test rather than merely working around the tooling quirk.
- **Files modified:** `frontend/__tests__/Heatmap.test.tsx`
- **Verification:** `npm --prefix frontend run test -- Heatmap` — all 9 cases pass; full suite (129/129) confirmed clean afterward.
- **Committed in:** `f5e61e9`

**2. [Rule 3 - Blocking issue] `TileDatum` needed an index signature to satisfy recharts' `TreemapDataType`**
- **Found during:** Task 2 (Heatmap), `npm run typecheck` after the first implementation pass
- **Issue:** `tsc` rejected `data: TileDatum[]` passed to `Treemap`'s `data` prop — `TreemapDataType` requires `[key: string]: unknown`, which the plain `{name, size, pnlPercent}` interface lacked.
- **Fix:** Added `[key: string]: unknown` to the local `TileDatum` interface. No runtime change; recharts already receives the same object shape at runtime either way.
- **Files modified:** `frontend/components/Heatmap.tsx`
- **Verification:** `npm --prefix frontend run typecheck` — 0 errors.
- **Committed in:** `f5e61e9`

---
**Total deviations:** 2 auto-fixed (1 bug in a test assertion, 1 blocking type-level fix). Neither changed any user-visible behavior or the plan's scope.
**Impact on plan:** None on scope or behavior — both are mechanical consequences of jsdom's CSSOM normalization and TypeScript's structural typing against a third-party library's generic constraint, isolated to test assertions and a type annotation.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `PositionsTable` and `Heatmap` both consume `portfolio.positions` and `ticks` directly; 03-04's P&L chart can be mounted alongside them in `page.tsx` without any further wiring changes to `usePortfolio()` or `usePriceStreamContext()`.
- The `deriveLivePosition`-everywhere convention (header total, positions table, heatmap) is now consistently applied across all three live-value surfaces — no divergent fallback logic remains to reconcile.
- Human verification still open per this plan's Task 2 `<human-check>`: buy two different tickers in the running app and confirm heatmap sizing/colour, click-to-select, and the empty state after selling everything — deferred to end-of-phase UAT per this project's `human_verify_mode`.
- No blockers for 03-04.

## Self-Check: PASSED

---
*Phase: 03-trading-portfolio*
*Completed: 2026-09-20*

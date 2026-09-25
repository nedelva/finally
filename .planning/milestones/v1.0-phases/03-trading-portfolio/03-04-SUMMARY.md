---
phase: 03-trading-portfolio
plan: 04
subsystem: api
tags: [fastapi, sqlite, asyncio, background-task, recharts, react, tdd]

requires:
  - phase: 03-trading-portfolio
    provides: "total_portfolio_value shared valuation helper and the in-transaction post-trade snapshot write (03-01); the deriveLivePosition-everywhere convention and PositionsTable/Heatmap panel chrome (03-03)"
provides:
  - "app.db.repository.record_snapshot / get_snapshots — periodic and read-side halves of PORT-06's snapshot persistence"
  - "GET /api/portfolio/history — serves PortfolioHistoryResponse ascending by recorded_at"
  - "backend/app/market/snapshot_task.py — snapshot_loop background coroutine (30s cadence) wired into main.py's lifespan"
  - "frontend/components/PnLChart.tsx — full-history P&L line chart with the D-13 pre-first-tick bootstrap point, mounted in page.tsx"
affects: [phase-04-ai-chat, phase-05-docker-deployment]

actuals:
  tokens: 8023
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Background task cadence: sleep-then-write-then-catch-log-continue, re-raising asyncio.CancelledError so task.cancel() still propagates — snapshot_task.py mirrors SimulatorDataSource._run_loop's shape exactly"
    - "recharts Line dot={{ r: 2 }} (rather than MainChart's dot={false}) so jsdom tests can assert an exact plotted-point count via .recharts-dot, without parsing SVG path syntax"

key-files:
  created:
    - backend/app/market/snapshot_task.py
    - backend/tests/market/test_snapshot_task.py
    - frontend/components/PnLChart.tsx
    - frontend/__tests__/PnLChart.test.tsx
  modified:
    - backend/app/db/repository.py
    - backend/app/db/__init__.py
    - backend/app/api/portfolio.py
    - backend/app/market/__init__.py
    - backend/app/main.py
    - backend/tests/db/test_repository.py
    - backend/tests/api/test_portfolio.py
    - backend/tests/test_main.py
    - frontend/lib/hooks.ts
    - frontend/app/page.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "record_snapshot routes through the same total_portfolio_value(conn, price_cache) helper execute_trade's post-trade write already uses, so the periodic writer, the post-trade writer, and build_portfolio can never disagree on a valuation — asserted directly by three equality tests including the D-03 avg_cost-fallback case"
  - "snapshot_loop sleeps before its first write (never writes immediately on task creation) — the post-trade writer and the frontend's D-13 bootstrap point already cover the first interval, so an immediate write at startup would add a duplicate"
  - "PnLChart's Line uses var(--color-primary-blue) rather than MainChart's literal #209dd7 hex, per this plan's own action text and the UI-SPEC's token table — same visual color, CSS-variable form specifically for this new component"
  - "PnLChart's dot renders at r={2} instead of MainChart's dot={false}, purely for jsdom testability — lets tests assert an exact plotted-point count via querySelectorAll('.recharts-dot') rather than parsing the line path's d attribute"

patterns-established:
  - "Backend RED tests for a not-yet-implemented repository/background-task function use a raise-NotImplementedError stub (Phase 02's established convention) so pytest collection succeeds and the named test fails on the planned behavior; frontend RED tests for a not-yet-existing component use a module-resolution failure (Phase 03's established convention, 03-01/03-03) — both conventions reused verbatim in this plan, not reinvented"

requirements-completed: [PORT-06]

coverage:
  - id: D1
    description: "record_snapshot writes one portfolio_snapshots row valued through the shared total_portfolio_value helper (agreeing with the post-trade writer and build_portfolio to the cent, including the D-03 avg_cost-fallback case); get_snapshots reads them back ascending by recorded_at with exactly {total_value, recorded_at}; GET /api/portfolio/history exposes both"
    requirement: "PORT-06"
    verification:
      - kind: unit
        ref: "backend/tests/db/test_repository.py::TestRecordSnapshot, TestGetSnapshots (6 cases: fresh-db cash value, post-buy equality with total_portfolio_value, equality when a held ticker has no cache entry, two-calls-produce-two-rows, ascending order with exact keys, empty-db returns [])"
        status: pass
      - kind: integration
        ref: "backend/tests/api/test_portfolio.py::TestPortfolioHistory (3 cases: fresh-db {snapshots: []}, post-trade snapshot matches the trade's own total_value, every entry has exactly two keys)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A 30-second background task in the app lifespan writes a snapshot every interval, survives a write failure without exiting, and is cancelled cleanly on shutdown"
    requirement: "PORT-06"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_snapshot_task.py (5 cases: short-interval writes >=1 row, raising recorder on first call still writes on a later iteration, cancelling the task raises CancelledError, SNAPSHOT_INTERVAL_SECONDS==30.0, snapshot_loop's default interval is that constant)"
        status: pass
      - kind: integration
        ref: "backend/tests/test_main.py::TestLifespanSnapshotTask (entering/exiting the real app lifespan through TestClient leaves no pending task)"
        status: pass
      - kind: other
        ref: "manual: ran a real uvicorn dev server, executed a trade (snapshot appears immediately, total_value matches the trade's own response), then polled GET /api/portfolio/history until a second snapshot appeared ~30s later from the background task alone"
        status: pass
    human_judgment: false
  - id: D3
    description: "PnLChart plots every returned snapshot with no time-range control (D-12), plots a single bootstrap point from the current portfolio total when history is empty (D-13), and renders loading/error states per the shared panel-chrome convention"
    requirement: "PORT-06"
    verification:
      - kind: unit
        ref: "frontend/__tests__/PnLChart.test.tsx (7 cases: three-snapshot plot with exact dot count, D-13 single-point bootstrap, waiting placeholder when both empty, loading placeholder, panel-level error with no chart, two one-second-apart snapshots both plotted, no button/select rendered)"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run test (136/136 passing, up from 129), npm --prefix frontend run typecheck (0 errors), npm --prefix frontend run build (static export succeeds)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visually, on a running app: the P&L chart shows a single point immediately on a fresh database, a new point appears at once after a trade, further points accumulate on their own after about a minute, and no time-range control is present anywhere in the panel"
    verification: []
    human_judgment: true
    rationale: "Task 3's own <verify> block includes this exact scenario as a <human-check>. Per this project's human_verify_mode=end-of-phase, it is deferred to end-of-phase UAT rather than a mid-plan halt, consistent with 03-03's identical deferral for its own human-check. This plan did independently verify the backend half of the same scenario via a real running dev server (see D2's manual verification) — only the frontend's visual/felt experience remains open."

duration: 55min
completed: 2026-09-20
status: complete
---

# Phase 3 Plan 04: Portfolio Snapshots and P&L Chart Summary

**Periodic 30-second portfolio snapshot background task, a shared-valuation-verified `GET /api/portfolio/history` endpoint, and a full-history P&L chart with a pre-first-tick bootstrap point — closing out PORT-06 and completing Phase 3.**

## Performance
- **Duration:** 55min
- **Started:** 2026-09-20T18:02:00+02:00 (approx.)
- **Completed:** 2026-09-20T18:57:00+02:00 (approx.)
- **Tasks:** 3 completed
- **Files modified:** 15

## Accomplishments
- `record_snapshot(price_cache)` and `get_snapshots()` extend `app.db.repository`, both provably agreeing with the existing post-trade writer and `build_portfolio` via the shared `total_portfolio_value` helper — including the D-03 avg_cost-fallback case. `GET /api/portfolio/history` serves them in the exact `PortfolioHistoryResponse` shape the frontend already types.
- `backend/app/market/snapshot_task.py`'s `snapshot_loop` writes a snapshot every 30 seconds (mirroring `SimulatorDataSource._run_loop`'s sleep-write-catch-log-continue shape), survives a write failure without exiting, and is started/cancelled cleanly alongside the market data source in `main.py`'s lifespan. Verified against a real running dev server: a trade produced an immediate snapshot, and a second snapshot appeared ~21 seconds later from the background task alone with no further action.
- `frontend/components/PnLChart.tsx` plots the full snapshot history with no time-range control (D-12) and, when no snapshot exists yet, plots a single point from the current portfolio total instead of an empty chart (D-13). Mounted in `page.tsx` below the heatmap, refetching immediately after every filled trade via `TradeBar`'s `onFilled`.

## Task Commits
1. **Task 1: Snapshot persistence and the history endpoint** — `1b33856` (test, RED) → `269d66e` (feat, GREEN)
2. **Task 2: The 30-second snapshot background task in the app lifespan** — `27f852f` (test, RED) → `e673ced` (feat, GREEN)
3. **Task 3: P&L chart — full snapshot history with the pre-first-tick bootstrap** — `a084f63` (test, RED) → `fa7fc3f` (feat, GREEN)

**Plan metadata:** committed alongside this SUMMARY.

_TDD tasks: each produced a RED (failing test) commit followed by a GREEN (implementation) commit — no separate REFACTOR commit was needed for any of the three tasks._

## Files Created/Modified
- `backend/app/db/repository.py` — `record_snapshot`, `get_snapshots`
- `backend/app/db/__init__.py`, `backend/app/api/portfolio.py` — exports and `GET /portfolio/history` route
- `backend/app/market/snapshot_task.py` — new, `snapshot_loop` and `SNAPSHOT_INTERVAL_SECONDS`
- `backend/app/market/__init__.py`, `backend/app/main.py` — barrel export and lifespan wiring (create/cancel the snapshot task alongside `source.start()`/`source.stop()`)
- `backend/tests/db/test_repository.py`, `backend/tests/api/test_portfolio.py`, `backend/tests/market/test_snapshot_task.py`, `backend/tests/test_main.py` — 18 new backend tests
- `frontend/components/PnLChart.tsx` — new, 188 lines
- `frontend/lib/hooks.ts` — `usePortfolioHistory` gains an `error` field mirroring `usePortfolio`'s
- `frontend/app/page.tsx` — mounts `usePortfolioHistory()` and `<PnLChart>`, wires `TradeBar`'s `onFilled` to refetch both portfolio and history
- `frontend/__tests__/PnLChart.test.tsx` — new, 7 tests
- `frontend/__tests__/Watchlist.test.tsx` — mock fix (see Deviations)

## Decisions Made
- `record_snapshot` routes through the same `total_portfolio_value(conn, price_cache)` helper the post-trade writer already uses — the periodic writer, the post-trade writer, and `build_portfolio` can never disagree on a valuation, verified directly by equality tests including the D-03 fallback case.
- `snapshot_loop` sleeps before its first write — the post-trade writer and the frontend's D-13 bootstrap point already cover the first interval, so an immediate write at startup would add a duplicate.
- `PnLChart`'s line stroke uses `var(--color-primary-blue)` (rather than `MainChart`'s literal `#209dd7` hex) per this plan's own action text — same color, CSS-variable form for this new component.
- `PnLChart`'s dot renders at `r={2}` (rather than `MainChart`'s `dot={false}`) purely for jsdom testability — lets tests assert an exact plotted-point count via `.recharts-dot` rather than parsing the line's SVG path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `Watchlist.test.tsx`'s `@/lib/hooks` mock needed a `usePortfolioHistory` stub**
- **Found during:** Task 3
- **Issue:** `page.tsx` now calls `usePortfolioHistory()` (to feed `PnLChart`'s `snapshots`/`error` props). `Watchlist.test.tsx` fully mocks `@/lib/hooks` and several of its tests render `<Page />` through that mock — destructuring from an undefined `usePortfolioHistory()` return crashed those tests.
- **Fix:** Added a `usePortfolioHistory: vi.fn(() => ({ snapshots: [], loading: false, error: null, refetch: vi.fn(async () => {}) }))` stub alongside the existing `useWatchlist`/`usePortfolio`/`useLiveTotalValue` mocks — the same pattern 03-01 established for `usePortfolio`.
- **Files modified:** `frontend/__tests__/Watchlist.test.tsx`
- **Verification:** `npm run test` — all 136 frontend tests pass (previously 5 failing in this file after the `page.tsx` change).
- **Committed in:** `fa7fc3f`

---
**Total deviations:** 1 auto-fixed (blocking issue).
**Impact on plan:** None on scope or behavior — a necessary consequence of `page.tsx`'s new `usePortfolioHistory()` call, isolated to test-double setup in an already-existing test file, identical in kind to 03-01's own deviation for the same file.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- PORT-01 through PORT-06 are all now deliverable and verifiable — Phase 3 (Trading & Portfolio) is complete.
- `record_snapshot`/`get_snapshots` and `snapshot_loop` are fully self-contained and require no further wiring from Phase 4 (AI Chat).
- End-of-phase UAT still owes: this plan's own Task 3 `<human-check>` (P&L chart bootstrap point, live trade point, ~1 minute of organic accumulation, no time-range control), plus the human-judgment items already deferred by 03-01 and 03-03 (trade bar visual polish; heatmap sizing/colour/click-to-select/empty-state).
- No blockers for Phase 4.

## Self-Check: PASSED

All created files verified present on disk (`backend/app/db/repository.py`, `backend/app/market/snapshot_task.py`, `backend/tests/market/test_snapshot_task.py`, `frontend/components/PnLChart.tsx`, `frontend/__tests__/PnLChart.test.tsx`, this SUMMARY.md); all six task commits (`1b33856`, `269d66e`, `27f852f`, `e673ced`, `a084f63`, `fa7fc3f`) verified present in `git log --oneline --all`.

---
*Phase: 03-trading-portfolio*
*Completed: 2026-09-20*

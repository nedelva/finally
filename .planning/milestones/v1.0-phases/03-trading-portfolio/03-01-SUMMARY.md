---
phase: 03-trading-portfolio
plan: 01
subsystem: api
tags: [fastapi, sqlite, trading, portfolio, react, tdd]

requires:
  - phase: 02-persistent-watchlist
    provides: SQLite schema (positions/trades/portfolio_snapshots tables), watchlist REST CRUD, add_watchlist_ticker/get_watchlist repository conventions
provides:
  - "GET /api/portfolio and POST /api/portfolio/trade, mounted before the static-file mount"
  - "app.db.repository.execute_trade — atomic buy/sell trade engine with D-01 watchlist gate and D-03-aware valuation"
  - "app.db.repository.total_portfolio_value — shared valuation helper used by the post-trade snapshot and (03-04's) record_snapshot"
  - "frontend/components/TradeBar.tsx — instant Buy/Sell trade bar mounted in page.tsx"
affects: [03-02-header-live-total-value, 03-03-positions-table-heatmap, 03-04-pnl-chart-snapshot-task]

actuals:
  tokens: 10800
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Single with conn: transaction for a multi-table money-mutating write (watchlist gate + cash + positions + trades + portfolio_snapshots)"
    - "Shared round-then-sum valuation helper (total_portfolio_value) consumed by both an in-transaction snapshot write and a stateless REST read, so the two agree to the cent"
    - "D-03 avg_cost fallback for a ticker absent from PriceCache, applied identically in total_portfolio_value and build_portfolio"

key-files:
  created:
    - backend/app/api/portfolio.py
    - frontend/components/TradeBar.tsx
    - backend/tests/api/test_portfolio.py
  modified:
    - backend/app/db/repository.py
    - backend/app/db/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/tests/db/test_repository.py
    - frontend/app/page.tsx
    - frontend/__tests__/TradeBar.test.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "avg_cost recomputed only on buy (weighted average); a sell carries the prior avg_cost through untouched — recomputing on sell would corrupt every later P&L figure"
  - "Epsilon (1e-9) governs both the over-sell rejection and the close-out delete, so float dust can never strand a position at a near-zero quantity"
  - "D-01 enforced via a SELECT on the watchlist table on the transaction's own connection, not via get_watchlist() (which would open a second connection and reopen the read-then-write race) and not via a PriceCache hit (which is not proof of membership)"

patterns-established:
  - "Repository functions that write more than one table share a single with conn: block for the whole validate-then-write sequence, so SQLite serializes a concurrent second call rather than letting two callers read the same starting cash"

requirements-completed: [PORT-02, PORT-03, PORT-06]

coverage:
  - id: D1
    description: "execute_trade atomically fills a buy/sell at the live PriceCache price, updates cash/positions/trades, and writes a portfolio_snapshots row sharing the same transaction"
    requirement: "PORT-02, PORT-03, PORT-06"
    verification:
      - kind: unit
        ref: "backend/tests/db/test_repository.py::TestExecuteTrade (13 cases: weighted-avg buy, unchanged avg_cost on sell, epsilon close-out, over-sell/over-buy rejection, zero/negative quantity, off-watchlist ticker, snapshot-equals-total_portfolio_value with and without a cached price)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/portfolio and POST /api/portfolio/trade are mounted and return the exact Position/Portfolio/Trade shapes frontend/lib/types.ts declares"
    requirement: "PORT-02, PORT-03"
    verification:
      - kind: integration
        ref: "backend/tests/api/test_portfolio.py (TestGetPortfolio, TestBuyTrade, TestSellTrade — 9 cases)"
        status: pass
      - kind: other
        ref: "manual curl -X POST localhost:8000/api/portfolio/trade against a running dev server; success:true, portfolio.cash_balance below 10000"
        status: pass
    human_judgment: false
  - id: D3
    description: "Trade bar: watchlist-driven ticker select, fractional quantity, instant Buy/Sell with in-flight labels, clear-on-success fading confirmation, and a preserved-input error slot"
    requirement: "PORT-02, PORT-03"
    verification:
      - kind: unit
        ref: "frontend/__tests__/TradeBar.test.tsx (7 cases: options-from-watchlist, empty-watchlist disable+hint, disabled-until-positive-quantity, postTrade call args, in-flight label, clear-on-success with fade timer, preserved-input on rejection)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual/UX quality of the trade bar in the running terminal (colors, spacing, fade timing feel) matches the UI-SPEC's intent"
    verification: []
    human_judgment: true
    rationale: "Automated tests cover behavior and DOM state, not subjective visual polish or perceived fade smoothness; a human should confirm the running UI at localhost:8000 looks and feels right per the UI-SPEC's Copywriting Contract."

duration: 23min
completed: 2026-09-20
status: complete
---

# Phase 3 Plan 01: Trade Engine and Portfolio API Summary

**SQLite trade engine with atomic buy/sell fills, a shared D-03-aware valuation helper for the post-trade snapshot, and a live trade bar wired end-to-end in the terminal UI.**

## Performance
- **Duration:** 23min
- **Started:** 2026-09-20T14:33:03+02:00
- **Completed:** 2026-09-20T14:56:21+02:00
- **Tasks:** 2 completed
- **Files modified:** 11

## Accomplishments
- `execute_trade` fills a buy or sell instantly at the live `PriceCache` price inside one SQLite transaction — watchlist membership gate (D-01), weighted-average `avg_cost` on buy, unchanged `avg_cost` on sell, epsilon close-out delete, and a `portfolio_snapshots` write sharing the same transaction's valuation (PORT-06's post-trade half).
- `GET /api/portfolio` and `POST /api/portfolio/trade` are mounted on the running app (before the static-file mount) and return the exact `Position`/`Portfolio`/`Trade` shapes `frontend/lib/types.ts` already declares.
- The trade bar (`TradeBar.tsx`) lets a user pick a watched ticker from a dropdown, enter a whole or fractional quantity, and press Buy or Sell for an instant fill with an inline fading confirmation or a preserved-input error — no modal, no confirmation step.

## Task Commits
1. **Task 1: Trade engine and portfolio API** — `6afb331` (test, RED) → `dee94d6` (feat, GREEN)
2. **Task 2: Trade bar** — `baa63f7` (test, RED) → `64874eb` (feat, GREEN)

**Plan metadata:** committed alongside this SUMMARY (see final commit hash in STATE.md history).

_TDD tasks: each produced a RED (failing test) commit followed by a GREEN (implementation) commit — no separate REFACTOR commit was needed for either task._

## Files Created/Modified
- `backend/app/db/repository.py` — `get_cash_balance`, `get_positions`, `execute_trade`, `total_portfolio_value`
- `backend/app/api/portfolio.py` — `TradeRequest`, `build_portfolio`, `create_portfolio_router`
- `backend/app/db/__init__.py`, `backend/app/api/__init__.py` — export barrels updated
- `backend/app/main.py` — mounts `create_portfolio_router(price_cache)` before the static mount
- `backend/tests/db/test_repository.py`, `backend/tests/api/test_portfolio.py` — 22 new tests
- `frontend/components/TradeBar.tsx` — new trade bar component
- `frontend/app/page.tsx` — mounts `TradeBar`, wired to `usePortfolio().refetch`
- `frontend/__tests__/TradeBar.test.tsx` — 7 new tests
- `frontend/__tests__/Watchlist.test.tsx` — mock fix (see Deviations)

## Decisions Made
- `avg_cost` recomputed only on buy (weighted average); untouched on sell — recomputing on sell would corrupt every later unrealized-P&L figure.
- `1e-9` epsilon governs both the over-sell rejection and the close-out delete, so float dust can never strand a position at a near-zero quantity.
- D-01 (watchlist membership) enforced via a `SELECT 1 FROM watchlist ...` on the trade's own transaction connection — not via `get_watchlist()` (a second connection would reopen the read-then-write race) and not via a `PriceCache` hit (not proof of membership).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `Watchlist.test.tsx`'s `@/lib/hooks` mock needed a `usePortfolio` stub**
- **Found during:** Task 2
- **Issue:** `page.tsx` now calls `usePortfolio()` (to get `refetch` for `TradeBar`'s `onFilled` prop). `Watchlist.test.tsx` fully mocks `@/lib/hooks` with only `useWatchlist`, and several of its tests render `<Page />` through that mock — destructuring `{ refetch }` from an undefined `usePortfolio()` return crashed those tests.
- **Fix:** Added a `usePortfolio: vi.fn(() => ({ portfolio: null, loading: false, error: null, refetch: vi.fn(async () => {}) }))` stub alongside the existing `useWatchlist` mock.
- **Files modified:** `frontend/__tests__/Watchlist.test.tsx`
- **Verification:** `npm run test` — all 96 frontend tests pass (previously 5 failing in this file after the `page.tsx` change).
- **Committed in:** `64874eb`

---
**Total deviations:** 1 auto-fixed (blocking issue).
**Impact on plan:** None on scope or behavior — a necessary consequence of `page.tsx`'s new `usePortfolio()` call, isolated to test-double setup in an already-existing test file.

## Issues Encountered
- Combining Vitest fake timers with `@testing-library/user-event`'s async `type`/`click` helpers hung indefinitely in the confirmation-fade test. Resolved by using `fireEvent` + `act(async () => ...)` for that one test instead of `userEvent`, matching this repo's existing fake-timer test style (`usePriceFlash.test.ts`, `Watchlist.test.tsx`'s flash-clear test) rather than inventing a new pattern.

## Known Limitations (documented per plan, not a bug)
- A position on a ticker removed from the watchlist cannot be sold until the ticker is re-added — D-01 gates trading on watchlist membership and D-04 leaves removal unrestricted. This is an accepted consequence of the locked decisions (RESEARCH.md Pitfall 4), not a defect. No escape hatch was added.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `total_portfolio_value` and `build_portfolio`'s D-03 fallback are ready for 03-04's `record_snapshot`/`get_snapshots` to reuse without modification.
- `usePortfolio()` is now called from `page.tsx`; 03-02's `useLiveTotalValue`/`Header` work can build on this without re-wiring the hook call site.
- No blockers for 03-02, 03-03, or 03-04.

---
*Phase: 03-trading-portfolio*
*Completed: 2026-09-20*

## Self-Check: PASSED

All created files verified present on disk (`backend/app/api/portfolio.py`, `frontend/components/TradeBar.tsx`, `backend/tests/api/test_portfolio.py`, this SUMMARY.md); all four task commits (`6afb331`, `dee94d6`, `baa63f7`, `64874eb`) verified present in `git log --oneline --all`.

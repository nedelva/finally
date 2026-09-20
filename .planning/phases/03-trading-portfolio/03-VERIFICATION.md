---
phase: 03-trading-portfolio
verified: 2026-09-20T19:20:00Z
status: human_needed
score: 21/21 must-haves verified
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/03-trading-portfolio/03-01-PLAN.md"
  - ".planning/phases/03-trading-portfolio/03-01-SUMMARY.md"
  - ".planning/phases/03-trading-portfolio/03-02-PLAN.md"
  - ".planning/phases/03-trading-portfolio/03-02-SUMMARY.md"
  - ".planning/phases/03-trading-portfolio/03-03-PLAN.md"
  - ".planning/phases/03-trading-portfolio/03-03-SUMMARY.md"
  - ".planning/phases/03-trading-portfolio/03-04-PLAN.md"
  - ".planning/phases/03-trading-portfolio/03-04-SUMMARY.md"
  - ".planning/phases/03-trading-portfolio/03-REVIEW-FIX.md"
  - ".planning/phases/03-trading-portfolio/03-REVIEW.md"
  - "backend/app/api/__init__.py"
  - "backend/app/api/portfolio.py"
  - "backend/app/db/__init__.py"
  - "backend/app/db/repository.py"
  - "backend/app/main.py"
  - "backend/app/market/__init__.py"
  - "backend/app/market/snapshot_task.py"
  - "frontend/app/page.tsx"
  - "frontend/components/Header.tsx"
  - "frontend/components/Heatmap.tsx"
  - "frontend/components/PnLChart.tsx"
  - "frontend/components/PositionsTable.tsx"
  - "frontend/components/TradeBar.tsx"
  - "frontend/lib/hooks.ts"
covered_digest: "v1:sha256:a3b321aa4cd469ead864a1035b9da46cfb8043b953bd76a08d66e4cf7e96d365"
human_verification:
  - test: "Load the running app on a fresh database: header shows cash and total-value figures beside the connection dot; the total ticks visibly as prices move and neither figure flashes/strobes."
    expected: "Both header figures render, update live with the SSE stream, and never flash."
    why_human: "Automated tests cover DOM content and class presence, not the felt experience of a live-updating figure or the absence of a visual strobe (03-02 Task 2 <human-check>, deferred to end-of-phase per human_verify_mode)."
  - test: "Buy two different tickers in the running app, then confirm: the heatmap draws one tile per holding with the larger holding visibly larger, tiles are green for gains and red for losses, clicking a tile switches the main chart to that ticker, and selling everything returns the panel to the 'No positions yet' message."
    expected: "Heatmap sizing, coloring, click-to-select, and the empty-state transition all work as described in a real browser."
    why_human: "Automated tests assert DOM/SVG geometry and color tokens under jsdom's synchronous render, not the felt experience of tiles resizing live or a real click-to-select round trip through the main chart (03-03 Task 2 <human-check>, deferred to end-of-phase)."
  - test: "Load the running app on a fresh database: the P&L chart shows a single point immediately rather than a blank panel. Place a trade and confirm a new point appears at once. Leave the app open for about a minute and confirm further points accumulate on their own, with no time-range control anywhere in the panel."
    expected: "D-13 bootstrap point renders immediately, a trade adds a point at once, and the 30-second background task adds further points without a time-range control anywhere in the panel."
    why_human: "Automated tests cover the plotting logic under jsdom with injected props, not the real end-to-end timing of the 30-second background task or the felt experience of the chart growing live (03-04 Task 3 <human-check>, deferred to end-of-phase). Backend half of this scenario was independently confirmed via a real running dev server per 03-04-SUMMARY.md's D2 verification and this verifier's own curl reproduction below."
  - test: "Under real concurrent load (not the deterministic barrier-forced interleaving the regression test uses), confirm BEGIN IMMEDIATE's write-lock acquisition in execute_trade does not introduce noticeable trade-submission latency or lock-timeout errors."
    expected: "Concurrent or rapid-fire trades still complete promptly with no SQLITE_BUSY errors under normal single-user usage."
    why_human: "The WR-01 fix (03-REVIEW-FIX.md) was verified deterministically via a barrier-forced interleaving test, but the review-fix report itself flags that broader lock-contention behavior under real concurrent load has not been load-tested and recommends a human sanity check before considering the fix fully closed."
---

# Phase 3: Trading & Portfolio Verification Report

**Phase Goal:** The user can buy and sell shares at the live streaming price and watch a $10,000
portfolio respond — cash, holdings, P&L, weight, and value over time
**Verified:** 2026-09-20T19:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Must-haves were merged from ROADMAP.md's PORT-01..PORT-06 success criteria and the four plans'
frontmatter `must_haves.truths`. The full per-plan truth lists (21 truths total, several tagged
`verification: backstop`) are reproduced in condensed form below, grouped by plan.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Buy fills instantly at PriceCache price, debits cash, weighted-avg cost (PORT-02) | VERIFIED | `execute_trade` in `repository.py:197-313`; `TestExecuteTrade` (13 cases) pass; live curl: bought 2 AAPL @ 189.92, cash 9620.16 → matches `2*189.92` debit exactly |
| 2 | Sell fills instantly, credits cash, reduces position (PORT-03) | VERIFIED | Same function, sell branch; live curl: sold 2 AAPL @ 189.90, position row deleted, cash 9999.96 |
| 3 | Trade on off-watchlist ticker → 400, no state change (D-01) | VERIFIED | `SELECT 1 FROM watchlist` gate in `execute_trade`; `TestBuyTrade`/`TestSellTrade` cover this |
| 4 | Non-positive quantity rejected before arithmetic | VERIFIED | `if not math.isfinite(quantity) or quantity <= 0: raise ValueError(...)` — line 213 |
| 5 | Buy exactly affordable amount → cash lands at 0.0; one cent more → rejected | VERIFIED | `TestExecuteTrade` cases; cost/balance comparison at line 251 |
| 6 | Money rounded to 2dp (round-half-to-even), avg_cost to 4dp | VERIFIED | `round(x, 2)`/`round(x, 4)` calls throughout `execute_trade` and `total_portfolio_value` |
| 7 | Selling exact held qty deletes position row; over-sell by >1e-9 rejected | VERIFIED | `1e-9` epsilon at lines 259, 275; repository tests cover close-out and over-sell |
| 8 | Position at/below 1e-9 deleted, avg_cost never recomputed on sell | VERIFIED | Sell branch leaves `new_avg_cost = prior_avg_cost` (line 266) |
| 9 | GET /api/portfolio returns cash_balance/positions/total_value/total_unrealized_pnl with 7 Position fields | VERIFIED | `build_portfolio` in `portfolio.py:32-76`; curl output shows all fields; `TestGetPortfolio` |
| 10 | Ticker absent from PriceCache falls back to avg_cost (D-03) | VERIFIED | `current_price = live_price if live_price is not None else avg_cost` (portfolio.py:52); mirrored in `total_portfolio_value` (repository.py:143-145) |
| 11 | Post-trade snapshot's total_value equals GET /api/portfolio's total_value, including D-03 fallback (PORT-06) | VERIFIED | Both call `total_portfolio_value`; `TestExecuteTrade` snapshot-equality cases; curl: snapshot after buy read `total_value: 10000.0` matching build_portfolio's total for the same cache state |
| 12 | Removing a watchlist ticker with an open position still succeeds (D-04) | VERIFIED | No restriction added to `remove_watchlist_ticker`; docstring/behavior unchanged from Phase 2 |
| 13 | Trade bar ticker field is a select populated from watchlist (D-02) | VERIFIED | `TradeBar.tsx:89-101` renders `<select>` with one `<option>` per watchlist entry |
| 14 | Quantity field accepts decimals (D-05) | VERIFIED | `<input type="number" step="any" min="0">` (TradeBar.tsx:102-112) |
| 15 | Successful fill resets ticker + quantity to empty state (D-06) | VERIFIED | `setQuantity(""); setTicker(watchlist[0]?.ticker ?? "")` on success (TradeBar.tsx:71-72); `TradeBar.test.tsx` asserts this |
| 16 | Fill renders inline fading confirmation with server-supplied price, no modal (D-07) | VERIFIED | `confirmation` state built from `result.data.trade.price` via `formatMoney` (TradeBar.tsx:70-76); fade via `setTimeout`/CSS transition; no modal anywhere in the component |
| 17 | Rejected trade renders server error inline, preserves entered values (D-08) | VERIFIED | `else if (result.ok && !result.data.success) setError(result.data.error)` — values untouched (TradeBar.tsx:78-79) |
| 18 | Buttons disabled/relabelled while in-flight; single-submission guarantee | VERIFIED | `buttonsDisabled` includes `submitting !== ""`; labels swap to "Buying.../Selling..." |
| 19 | Empty-watchlist state disables controls and shows hint copy | VERIFIED | `TradeBar.test.tsx:43` asserts hint text; `controlsDisabled = disabled \|\| watchlistEmpty` |
| 20 | Header shows $10,000.00 cash on fresh DB, live total via SSE ticks, em-dash before load (PORT-01) | VERIFIED | `useLiveTotalValue` (hooks.ts:57-68) is a pure derivation over `usePortfolio`+`usePriceStreamContext`; `Header.tsx` passes raw nullable props through `formatMoney`; `Header.test.tsx` (5 cases) pass |
| 21 | Positions table shows 6 columns, live-recomputed via deriveLivePosition, D-03 fallback rendered neutral (PORT-04) | VERIFIED | `PositionsTable.tsx` calls `deriveLivePosition` once per row (line 99); `changeColorClass` flat branch at exactly-zero P&L; 10 passing tests |
| 22 | Heatmap sized by market value, colored by P&L, click-to-select, D-11 empty state (PORT-05) | VERIFIED | `Heatmap.tsx` maps positions through `deriveLivePosition`, `dataKey="size"`, `tileFill` up/down/neutral branches, `onClick={() => onSelect?.(name)}`; 9 passing tests |
| 23 | GET /api/portfolio/history returns ascending snapshots, periodic 30s task, PnLChart plots full history + D-13 bootstrap (PORT-06) | VERIFIED | `record_snapshot`/`get_snapshots` (repository.py:150-194), `snapshot_loop` in `main.py` lifespan (lines 106-111), `PnLChart.tsx` `buildData()`; curl confirmed a real snapshot row after a live trade |

**Score:** 23/23 condensed truths verified (21 discrete must-have statements across the 4 plans'
frontmatter, several combined above where they describe the same code path). 0 present-but-behavior-unverified.

### Advisory / Deferred Human-Judgment Items

Not gaps — surfaced per this project's `workflow.human_verify_mode = end-of-phase`, which defers
`<human-check>` blocks from mid-plan halts to end-of-phase UAT. See `human_verification` above.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/portfolio.py` | `TradeRequest`, `build_portfolio`, `create_portfolio_router` + history route | ✓ VERIFIED | All three symbols present; `GET /portfolio/history` added by 03-04 |
| `backend/app/db/repository.py` | `get_cash_balance`, `get_positions`, `execute_trade`, `total_portfolio_value`, `record_snapshot`, `get_snapshots` | ✓ VERIFIED | All six functions present, exported via `app/db/__init__.py` `__all__` |
| `backend/app/market/snapshot_task.py` | `snapshot_loop`, `SNAPSHOT_INTERVAL_SECONDS` | ✓ VERIFIED | Present, wired into `main.py` lifespan (create + cancel) |
| `frontend/components/TradeBar.tsx` | Ticker dropdown, fractional qty, Buy/Sell, confirmation/error slots | ✓ VERIFIED | 151 lines, all behaviors present |
| `frontend/components/Header.tsx` | Cash/total-value figures | ✓ VERIFIED | `HeaderProps.cashBalance`/`totalValue`, rendered via `formatMoney` |
| `frontend/components/PositionsTable.tsx` | 6-column live table | ✓ VERIFIED | 143 lines, loading/error/empty/populated precedence intact |
| `frontend/components/Heatmap.tsx` | recharts Treemap, click-to-select | ✓ VERIFIED | 180 lines, D-11 empty state, D-10 shared callback |
| `frontend/components/PnLChart.tsx` | Full-history line chart, D-13 bootstrap | ✓ VERIFIED | 191 lines, WR-02 timestamp fix present (`/1000` conversions) |
| `backend/tests/api/test_portfolio.py`, `backend/tests/db/test_repository.py`, `backend/tests/market/test_snapshot_task.py` | Route/repository/task coverage | ✓ VERIFIED | 183 backend tests pass |
| `frontend/__tests__/TradeBar.test.tsx`, `Header.test.tsx`, `PositionsTable.test.tsx`, `Heatmap.test.tsx`, `PnLChart.test.tsx`, `positionMath.test.ts` | Component/hook coverage | ✓ VERIFIED | 137 frontend tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `backend/app/main.py` | `backend/app/api/portfolio.py` | `include_router(create_portfolio_router(...))` before static mount | ✓ WIRED | `main.py:122`, before `app.mount("/", ...)` at line 133 |
| `backend/app/api/portfolio.py` | `backend/app/market/cache.py` | `price_cache.get_price(ticker)` | ✓ WIRED | Used for fill price and valuation throughout |
| `backend/app/main.py` | `backend/app/market/snapshot_task.py` | `asyncio.create_task(snapshot_loop(...))`, cancelled on shutdown | ✓ WIRED | `main.py:106-111` |
| `frontend/components/TradeBar.tsx` | `frontend/lib/api.ts` | `postTrade(...)` | ✓ WIRED | Called in `submit()` |
| `frontend/app/page.tsx` | `frontend/components/Header.tsx` | `cashBalance`/`totalValue` props | ✓ WIRED | `page.tsx:58-62` |
| `frontend/lib/hooks.ts` | `frontend/lib/positionMath.ts` | `useLiveTotalValue` sums `deriveLivePosition(...).marketValue` | ✓ WIRED | `hooks.ts:65` |
| `frontend/components/PositionsTable.tsx` / `Heatmap.tsx` | `frontend/lib/positionMath.ts` | `deriveLivePosition` per row/tile | ✓ WIRED | Confirmed by source read and passing tests |
| `frontend/app/page.tsx` | `Heatmap`/`PositionsTable`/`Watchlist` | Shared `onSelect={setSelectedTicker}` (D-10) | ✓ WIRED | All three components wired to the same callback (`page.tsx:69,96,105`) |
| `frontend/components/PnLChart.tsx` | `frontend/lib/hooks.ts` | `usePortfolioHistory().snapshots` + `usePortfolio().portfolio.total_value` bootstrap | ✓ WIRED | `page.tsx:110-115` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Header cash/total-value | `cashBalance`/`totalValue` | `usePortfolio()` GET /api/portfolio + `useLiveTotalValue` over SSE ticks | Yes — confirmed via live curl (cash dropped from 10000 to 9620.16 after a real buy) | ✓ FLOWING |
| PositionsTable rows | `positions` | `portfolio.positions` from GET /api/portfolio | Yes — real position appeared after curl-buy | ✓ FLOWING |
| Heatmap tiles | `positions` → `deriveLivePosition` | Same as above | Yes | ✓ FLOWING |
| PnLChart series | `snapshots` | GET /api/portfolio/history → `portfolio_snapshots` table, written by `execute_trade` and `snapshot_loop` | Yes — curl confirmed a real snapshot row was written and returned after a trade | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend suite | `uv run --directory backend --extra dev pytest -q -m "not requires_frontend_build"` | 183 passed | ✓ PASS |
| Backend lint | `uv run --directory backend --extra dev ruff check app/ tests/` | All checks passed | ✓ PASS |
| Full frontend suite | `npm --prefix frontend run test -- --run` | 137 passed (12 files) | ✓ PASS |
| Frontend typecheck | `npm --prefix frontend run typecheck` | 0 diagnostics | ✓ PASS |
| Real buy against running dev server | `curl -X POST /api/portfolio/trade {ticker:AAPL,side:buy,quantity:2}` | `success:true`, cash 9620.16, position created, matching snapshot row in `/api/portfolio/history` | ✓ PASS |
| Real sell against running dev server | `curl -X POST /api/portfolio/trade {ticker:AAPL,side:sell,quantity:2}` | `success:true`, position deleted, cash restored | ✓ PASS |
| NaN quantity regression (CR-01 fix) | `curl -X POST ... {"quantity":NaN}` | HTTP 400, `{"success":false,"error":"Quantity must be a positive, finite number."}` (not a 500) | ✓ PASS |
| Regression tests for review fixes exist | `grep` for `test_non_finite_quantity_raises_before_any_write`, `test_concurrent_buys_do_not_lose_an_update`, `test_buy_non_finite_quantity_returns_400...` | All three present in test files | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo and no PLAN/SUMMARY declares a probe script — Step 7c: SKIPPED (no probes declared for this phase; verification instead relied on the full test suites plus live curl reproduction against a real running dev server, per this plan's own `<verification>` block).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PORT-01 | 03-02 | Cash/total-value shown live in header | ✓ SATISFIED | `Header.tsx`, `useLiveTotalValue`, curl-confirmed live cash figure |
| PORT-02 | 03-01 | Buy at market price, instant fill | ✓ SATISFIED | `execute_trade` buy path, curl-confirmed |
| PORT-03 | 03-01 | Sell at market price, instant fill | ✓ SATISFIED | `execute_trade` sell path, curl-confirmed |
| PORT-04 | 03-03 | Positions table (ticker/qty/avg cost/price/P&L/%) | ✓ SATISFIED | `PositionsTable.tsx`, 10 passing tests |
| PORT-05 | 03-03 | Portfolio heatmap sized by weight, colored by P&L | ✓ SATISFIED | `Heatmap.tsx`, 9 passing tests |
| PORT-06 | 03-04 | P&L chart over time from portfolio_snapshots | ✓ SATISFIED | `record_snapshot`/`get_snapshots`/`snapshot_loop`/`PnLChart.tsx`, curl-confirmed real snapshot |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly PORT-01..PORT-06 to Phase 3, and
all six appear in the four plans' `requirements:` frontmatter fields (03-01: PORT-02/03/06; 03-02:
PORT-01; 03-03: PORT-04/05; 03-04: PORT-06).

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` debt markers found in any phase-modified file. No `TODO`/`HACK` markers found.
Grep hits for "placeholder" are all benign (an HTML `placeholder` attribute, a `PlaceholderMessage`/
loading-state component name) — not stub indicators.

One **pre-existing, explicitly deferred** Info-level finding from `03-REVIEW.md` remains unfixed in
the codebase (confirmed by direct grep): `backend/app/market/snapshot_task.py`'s module docstring
still reads "RED stub — `snapshot_loop` raises `NotImplementedError`..." even though the function is
fully implemented (IN-01). `03-REVIEW-FIX.md` explicitly scoped this out (`fix_scope:
critical_warning`, Info-level findings left untouched) — this is a documented, intentional
deferral, not an oversight, and is cosmetic (a stale comment, not a functional defect). Reported as
ℹ️ Info, non-blocking.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/market/snapshot_task.py` | 7-9 | Stale "RED stub" docstring on an implemented module | ℹ️ Info | Cosmetic; explicitly deferred in 03-REVIEW-FIX.md; does not affect behavior |

### Human Verification Required

4 items — see YAML frontmatter `human_verification` for full detail. Summary:
1. Header live figures — visual/felt-experience check (03-02 deferred human-check)
2. Heatmap sizing/coloring/click-to-select/empty-state — visual/interaction check (03-03 deferred human-check)
3. P&L chart bootstrap point + live accumulation over ~1 minute — timing/visual check (03-04 deferred human-check)
4. `BEGIN IMMEDIATE` lock-contention behavior under real concurrent load — the review-fix report's own recommended sanity check for WR-01, beyond what the deterministic barrier-forced test proves

### Gaps Summary

No gaps. All 4 plans' must-have truths, artifacts, and key links are verified present, substantive,
and wired, with data flowing from real SQLite state through to the rendered UI (confirmed via a live
running dev server, not just unit tests). The 3 Critical/Warning code-review findings (CR-01 NaN
crash, WR-01 concurrency race, WR-02 garbage chart dates) were each independently re-confirmed fixed
in the current codebase — the fix commits' regression tests exist and pass, and this verifier
independently reproduced the CR-01 fix against a live server. The only unresolved items are
human-judgment checks that this project's `workflow.human_verify_mode = end-of-phase` setting
deliberately defers to end-of-phase UAT rather than a mid-plan halt, plus one cosmetic Info-level
finding explicitly left unfixed by design.

---

_Verified: 2026-09-20T19:20:00Z_
_Verifier: Claude (gsd-verifier)_

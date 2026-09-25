---
phase: 03-trading-portfolio
reviewed: 2026-09-20T18:45:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - backend/app/api/__init__.py
  - backend/app/api/portfolio.py
  - backend/app/db/__init__.py
  - backend/app/db/repository.py
  - backend/app/main.py
  - backend/app/market/__init__.py
  - backend/app/market/snapshot_task.py
  - backend/tests/api/test_portfolio.py
  - backend/tests/db/test_repository.py
  - backend/tests/market/test_snapshot_task.py
  - backend/tests/test_main.py
  - frontend/__tests__/ConnectionDot.test.tsx
  - frontend/__tests__/Header.test.tsx
  - frontend/__tests__/Heatmap.test.tsx
  - frontend/__tests__/PnLChart.test.tsx
  - frontend/__tests__/PositionsTable.test.tsx
  - frontend/__tests__/TradeBar.test.tsx
  - frontend/__tests__/Watchlist.test.tsx
  - frontend/__tests__/positionMath.test.ts
  - frontend/app/page.tsx
  - frontend/components/Header.tsx
  - frontend/components/Heatmap.tsx
  - frontend/components/PnLChart.tsx
  - frontend/components/PositionsTable.tsx
  - frontend/components/TradeBar.tsx
  - frontend/lib/hooks.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-20T18:45:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the trading/portfolio backend (routes, repository, snapshot task, app wiring) and the corresponding frontend surface (portfolio-derived components and hooks) added in this phase. The existing test suites (177 backend / 136 frontend) all pass, but several defects are not exercised by any test and were confirmed by direct reproduction rather than static reading alone:

- A **Critical** input-validation gap in `execute_trade`: a `NaN` trade quantity slips past every numeric guard (because any comparison against `NaN` is `False`) and crashes the trade endpoint with an unhandled `sqlite3.IntegrityError`, reproduced end-to-end against a real `TestClient`.
- A **Warning**-level race condition in `execute_trade`'s read-then-write sequence, confirmed against CPython's actual `sqlite3` transaction semantics (SELECTs do not open a transaction; only the first write does), which can let two concurrent trade requests read the same stale cash balance.
- A **Warning**-level display bug in `PnLChart`: the P&L chart's X-axis ticks and tooltip render nonsensical dates (confirmed via reproduction: a `2026-01-01` snapshot renders as `Feb 25 57971`) because `buildData()` produces millisecond timestamps while `formatClock` expects Unix seconds for numeric input.
- Three **Info**-level quality issues: a stale "RED stub" docstring in an already-implemented module, a watchlist/market-source inconsistency on restart with an emptied watchlist, and a minor rounding-precision inconsistency between REST and live-recomputed P&L percentages.

One candidate finding — that `execute_trade` blocks *selling* a position whose ticker has since been removed from the watchlist — was investigated and traced to an explicit, documented design decision (D-01/D-03 in `03-CONTEXT.md`), not an implementation defect, and is therefore not reported below.

## Critical Issues

### CR-01: `NaN` trade quantity bypasses all validation and crashes the trade endpoint

**File:** `backend/app/db/repository.py:212-264`
**Issue:** `execute_trade`'s only quantity guard is `if quantity <= 0: raise ValueError(...)` (line 212), and the buy/sell branches rely on further numeric comparisons (`cost > balance` at line 243, `quantity > prior_quantity + 1e-9` at line 251) to reject bad input. None of these guards account for `quantity = NaN`: every comparison against `NaN` evaluates to `False` in Python, so a `NaN` quantity sails past *all* of them.

`POST /api/portfolio/trade`'s `TradeRequest.quantity: float` (in `backend/app/api/portfolio.py`) has no `allow_inf_nan=False` constraint, and both Python's `json.loads` (used internally by Starlette to parse the request body) and Pydantic v2 accept the literal token `NaN` in a JSON body by default. Reproduced end-to-end:

```
body = b'{"ticker":"AAPL","side":"buy","quantity":NaN}'
client.post('/api/portfolio/trade', content=body, headers={'Content-Type':'application/json'})
```

This computes `cost = nan`, `new_quantity = nan`, `new_cash = nan`, and the subsequent
`conn.execute("UPDATE users_profile SET cash_balance = ? WHERE id = ?", (new_cash, ...))`
raises an **unhandled** `sqlite3.IntegrityError: NOT NULL constraint failed: users_profile.cash_balance` (Python's `sqlite3` driver binds a `NaN` float as SQL `NULL`, which then violates the `NOT NULL` column constraint). This exception is not `ValueError`, so `post_trade_route`'s `except ValueError` in `backend/app/api/portfolio.py:110-111` does not catch it — it propagates out of the route handler and becomes an unhandled 500 in production (Starlette's `ServerErrorMiddleware`), returning a bare error page instead of the `{success: false, error: ...}` shape every other caller of this endpoint expects. The `with conn:` block does roll back cleanly on the exception (no persisted corruption), but the endpoint contract is broken for any NaN/non-finite quantity.

**Fix:** Validate finiteness alongside positivity, and treat it as an ordinary rejection:

```python
import math

if not math.isfinite(quantity) or quantity <= 0:
    raise ValueError("Quantity must be a positive, finite number.")
```

Add this check at the top of `execute_trade` (repository.py:212) before the ticker/watchlist lookups, and add a regression test posting `quantity: NaN`/`Infinity`/`-Infinity` to `POST /api/portfolio/trade`.

## Warnings

### WR-01: `execute_trade` has a read-then-write race across concurrent trades

**File:** `backend/app/db/repository.py:216-296`
**Issue:** `execute_trade` opens `with conn:` and then issues several `SELECT`s (watchlist membership, cash balance, position) before its first write. CPython's `sqlite3` module only opens an implicit transaction before the first `INSERT`/`UPDATE`/`DELETE` — confirmed directly:

```python
c.execute("SELECT * FROM t")
print(c.in_transaction)   # False
c.execute("INSERT INTO t VALUES (1)")
print(c.in_transaction)   # True
```

Each `POST /api/portfolio/trade` request is dispatched through `await asyncio.to_thread(execute_trade, ...)` (`backend/app/api/portfolio.py:107-109`), which runs on a real OS thread from `asyncio`'s default thread-pool executor — so two trade requests in flight at once (e.g. a double-click that beats the frontend's `submitting` guard, two open tabs, or a direct API caller) can both execute their cash/position `SELECT`s before either has written anything, both compute their affordability/quantity checks against the same stale balance, and then serialize their writes one after another — the second write overwrites the first's result using numbers computed from data that is now stale (a classic lost-update). This can let a sequence of trades collectively spend more cash than the user has, or under/over-credit a sell, silently violating the "insufficient cash" invariant this same file's tests otherwise verify.

**Fix:** Force the whole read-modify-write sequence inside a single write transaction, e.g. issue an explicit `conn.execute("BEGIN IMMEDIATE")` before the first `SELECT` (acquiring the write lock up front) instead of relying on the implicit deferred-transaction behavior, or wrap the balance/position reads and the following writes with `SELECT ... FOR UPDATE`-equivalent locking via `BEGIN IMMEDIATE`.

### WR-02: `PnLChart` renders garbage dates on its X-axis and tooltip

**File:** `frontend/components/PnLChart.tsx:115-129` (via `frontend/lib/format.ts:48-55`)
**Issue:** `buildData()` builds `ChartPoint.timestamp` from `Date.parse(snapshot.recorded_at)` (line 121) or `Date.now()` (line 126) — both **milliseconds** since epoch. That value is fed straight into `formatClock` as the `dataKey="timestamp"` tick formatter (`PnLChart.tsx:86`) and tooltip label formatter (`PnLChart.tsx:98`). `formatClock` (`lib/format.ts:48-55`), however, treats a numeric argument as **Unix seconds** and does `new Date(isoOrUnixSeconds * 1000)` — the same contract `MainChart.tsx` correctly relies on, because `PriceTick.timestamp` really is Unix seconds per `types.ts`'s own comment ("Unix seconds (float)").

Reproduced directly:

```js
const ms = Date.parse('2026-01-01T00:00:00Z');   // 1767225600000
new Date(ms * 1000).toString();                  // "Thu Feb 25 57971 ..."
```

So every axis tick and tooltip label on the P&L chart shows a date roughly 56,000 years in the future instead of the actual snapshot time. No existing test asserts on the rendered tick/tooltip text (`PnLChart.test.tsx` only checks dot/path counts), so this regressed silently.

**Fix:** Convert to seconds when building `ChartPoint`, matching `formatClock`'s numeric contract:

```ts
timestamp: Date.parse(snapshot.recorded_at) / 1000,
...
timestamp: Date.now() / 1000,
```

Add a test asserting the rendered X-axis tick text (or tooltip label) for a known `recorded_at` to prevent regression.

## Info

### IN-01: Stale "RED stub" docstring in an already-implemented module

**File:** `backend/app/market/snapshot_task.py:7-9`
**Issue:** The module docstring reads "RED stub — `snapshot_loop` raises `NotImplementedError` after its first sleep until Task 2's GREEN step," but the function below it is fully implemented (writes snapshots, catches/logs exceptions, re-raises `CancelledError`). This is leftover TDD-cycle language that no longer describes the code and will mislead anyone reading the module docstring first.
**Fix:** Remove the "RED stub" paragraph now that the GREEN implementation has landed.

### IN-02: Emptied watchlist is silently replaced by `DEFAULT_TICKERS` on restart

**File:** `backend/app/main.py:100-102`
**Issue:** `tickers = [normalize_ticker(row["ticker"]) for row in rows] or DEFAULT_TICKERS` — if the user has removed every ticker from their watchlist (an explicitly supported state per `remove_watchlist_ticker`/D-04) and the process restarts, `rows` is `[]`, so `tickers` falls back to the 10 default tickers rather than starting the market source with zero tickers. The persisted watchlist (empty) and the live `PriceCache`/SSE stream (10 phantom tickers) then disagree. The user-visible impact is currently minimal (the `Watchlist`/`TradeBar` UI both derive their ticker set from the REST `/api/watchlist` response, not from the SSE stream), but it is a real inconsistency between persisted state and runtime state, and any future feature that trusts "the tickers currently in `PriceCache`" as a proxy for "the user's watchlist" will be wrong immediately after such a restart.
**Fix:** Only fall back to `DEFAULT_TICKERS` when this is a genuinely fresh database (e.g. distinguish "no watchlist table content ever seeded" from "user intentionally emptied it"), or simply start the source with an empty ticker list when `rows == []`.

### IN-03: Inconsistent rounding precision between REST and live-recomputed P&L percent

**File:** `backend/app/api/portfolio.py:55-57` vs. `frontend/lib/positionMath.ts:29`
**Issue:** `build_portfolio` rounds `unrealized_pnl_percent` to 4 decimal places, while every other money-shaped field in the same payload (`market_value`, `unrealized_pnl`) is rounded to 2. The frontend's `deriveLivePosition` recomputes the same percentage with no rounding at all when a live tick exists, and only the display layer (`formatPercent`, `toFixed(2)`) normalizes it. The values converge, so this is not incorrect, but the differing precision conventions for otherwise-parallel fields is a minor inconsistency worth aligning (e.g. round to 2 like the sibling fields) for readability of raw API responses and future consumers (chat/LLM context) that might read `unrealized_pnl_percent` directly.
**Fix:** Round `unrealized_pnl_percent` to 2 decimals in `build_portfolio`, matching the other percentage fields in the codebase.

---

_Reviewed: 2026-09-20T18:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

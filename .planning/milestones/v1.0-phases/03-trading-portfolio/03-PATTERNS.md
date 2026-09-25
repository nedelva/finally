# Phase 3: Trading & Portfolio - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 14 (9 new, 5 modified)
**Analogs found:** 14 / 14 (2 partial — see No Analog Found)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/api/portfolio.py` (NEW) | controller/route | request-response | `backend/app/api/watchlist.py` | exact |
| `backend/app/db/repository.py` (EXTEND: `get_positions`, `get_cash_balance`, `execute_trade`, `record_snapshot`, `get_snapshots`) | service/model | CRUD | `backend/app/db/repository.py`'s existing `add_watchlist_ticker`/`remove_watchlist_ticker` | exact |
| `backend/app/db/__init__.py` (MODIFY: export new repository functions) | module barrel | — | itself (existing `__all__` pattern) | exact |
| `backend/app/api/__init__.py` (MODIFY: export `create_portfolio_router`) | module barrel | — | itself (existing `__all__` pattern) | exact |
| `backend/app/main.py` (MODIFY: mount portfolio router, start/stop snapshot task in lifespan) | config/bootstrap | event-driven (background task) | itself (existing lifespan + `source.start()`/`source.stop()`) | exact |
| `backend/app/market/snapshot_task.py` (NEW — recommended location, see rationale below) | background task | event-driven | `backend/app/market/simulator.py`'s `_run_loop`/`start`/`stop` (`SimulatorDataSource`) | role-match |
| `frontend/components/TradeBar.tsx` (NEW) | component/form | request-response | `frontend/components/Watchlist.tsx` (add-ticker form) | exact |
| `frontend/components/PositionsTable.tsx` (NEW) | component/table | CRUD (display) | `frontend/components/Watchlist.tsx` + `WatchlistRow.tsx` (table shell + row) | exact |
| `frontend/components/Heatmap.tsx` (NEW) | component/chart | transform | `frontend/components/MainChart.tsx` | role-match (partial — see No Analog Found) |
| `frontend/components/PnLChart.tsx` (NEW) | component/chart | transform | `frontend/components/MainChart.tsx` | exact |
| `frontend/components/Header.tsx` (MODIFY: add cash/total value display) | component | request-response (display) | itself + `frontend/lib/format.ts` | exact |
| `frontend/app/page.tsx` (MODIFY: wire portfolio state, mount new components, extend click-to-select) | page/container | event-driven | itself (existing selection-guard effect) | exact |
| `frontend/lib/hooks.ts` (EXTEND: add `useLiveTotalValue`) | hook | transform | itself (existing `usePortfolio`/`usePortfolioHistory`, already present) + `frontend/lib/positionMath.ts` | exact |
| `backend/tests/api/test_portfolio.py` (NEW) | test | request-response | `backend/tests/api/test_watchlist.py` + `backend/tests/api/conftest.py` | exact |
| `backend/tests/db/test_repository.py` (EXTEND) | test | CRUD | itself (existing `TestAddWatchlistTicker`/`TestRemoveWatchlistTicker`) | exact |
| `frontend/__tests__/TradeBar.test.tsx` (NEW) | test | request-response | `frontend/__tests__/Watchlist.test.tsx` (add-ticker form tests) | exact |
| `frontend/__tests__/PositionsTable.test.tsx`, `Heatmap.test.tsx`, `PnLChart.test.tsx` (NEW) | test | transform | `frontend/__tests__/MainChart.test.tsx` | exact |
| `frontend/__tests__/Header.test.tsx` (NEW) | test | request-response | `frontend/__tests__/Watchlist.test.tsx` (mocking conventions) + `frontend/components/Header.tsx` | role-match |
| `frontend/__tests__/positionMath.test.ts` (NEW) | test | transform | none in-repo (new file, trivial pure-function tests) | no analog (low risk) |

**Note on `backend/app/market/snapshot_task.py` location:** `03-RESEARCH.md`'s Pattern 3 shows `snapshot_loop` inline without committing to a file. It writes to `app/db` (repository) and reads `PriceCache`, so it belongs with the other background-task lifecycle code. Recommend a new small module `backend/app/market/snapshot_task.py` (mirrors `simulator.py`'s task-lifecycle shape but is not itself a `MarketDataSource`) rather than inlining a 15-line loop into `main.py` — keeps `main.py`'s lifespan a thin composition, matching how `simulator.py`/`factory.py` are already separated from `main.py`. If the planner prefers, inlining directly in `main.py` is also acceptable — flag as a planning decision, not a fixed requirement.

## Pattern Assignments

### `backend/app/api/portfolio.py` (controller, request-response)

**Analog:** `backend/app/api/watchlist.py` (full file read, 154 lines)

**Imports pattern** (`watchlist.py` lines 8-20):
```python
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import add_watchlist_ticker, get_watchlist, remove_watchlist_ticker
from app.market import PriceCache, is_valid_ticker_format, normalize_ticker

logger = logging.getLogger(__name__)
```
For `portfolio.py`, swap the `app.db` import for the new repository functions (`get_positions`, `get_cash_balance`, `execute_trade`, `record_snapshot`, `get_snapshots`) and add `from typing import Literal` + `pydantic.BaseModel` for `TradeRequest`.

**Request-body validation pattern** (`watchlist.py` lines 23-26):
```python
class WatchlistAddRequest(BaseModel):
    """Request body for `POST /api/watchlist`."""

    ticker: str
```
`TradeRequest` follows identically, per RESEARCH.md's Code Examples:
```python
class TradeRequest(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float
```

**Router factory pattern** (`watchlist.py` lines 68-81, 153):
```python
def create_watchlist_router(price_cache: PriceCache) -> APIRouter:
    """... Constructs a fresh `APIRouter` on every call ..."""
    router = APIRouter(prefix="/api", tags=["watchlist"])

    @router.get("/watchlist")
    async def get_watchlist_route() -> dict:
        """Return the current user's watchlist joined with live prices."""
        return await asyncio.to_thread(build_watchlist, price_cache)
    ...
    return router
```
`create_portfolio_router(price_cache)` mirrors this exactly: `GET /portfolio` → `asyncio.to_thread(build_portfolio, price_cache)`; `POST /portfolio/trade` → `asyncio.to_thread(execute_trade, ...)` wrapped in try/except `ValueError`; `GET /portfolio/history` → `asyncio.to_thread(get_snapshots)`.

**Error handling / status code translation pattern** (`watchlist.py` lines 102-108):
```python
try:
    result = await asyncio.to_thread(add_watchlist_ticker, normalized)
except ValueError:
    return JSONResponse(
        status_code=409,
        content={"error": f"{normalized} is already on your watchlist."},
    )
```
`POST /api/portfolio/trade` reuses this exact `try/except ValueError → JSONResponse(status_code=400, ...)` shape (per RESEARCH.md Pattern 1), but the body discriminant is `{"success": False, "error": str(exc)}` — matches `frontend/lib/types.ts`'s `TradeErrorResponse` exactly (no `portfolio` key on the error path, per RESEARCH.md Open Question 2).

**Build-view-model pattern** (`watchlist.py`'s `build_watchlist`, lines 29-65) — join persisted rows with `PriceCache`, choose an honest fallback per-row. `build_portfolio` in `portfolio.py` follows the identical shape but with the D-03 avg_cost fallback instead of null:
```python
def build_portfolio(price_cache: PriceCache) -> dict:
    cash_balance = get_cash_balance()
    positions = []
    total_value = cash_balance
    total_unrealized_pnl = 0.0
    for row in get_positions():
        live_price = price_cache.get_price(row["ticker"])
        current_price = live_price if live_price is not None else row["avg_cost"]
        market_value = round(row["quantity"] * current_price, 2)
        unrealized_pnl = round((current_price - row["avg_cost"]) * row["quantity"], 2)
        unrealized_pnl_percent = (
            round((current_price / row["avg_cost"] - 1) * 100, 4) if row["avg_cost"] > 0 else 0.0
        )
        positions.append({...})  # field names below
        total_value += market_value
        total_unrealized_pnl += unrealized_pnl
    return {"cash_balance": cash_balance, "positions": positions,
            "total_value": round(total_value, 2), "total_unrealized_pnl": round(total_unrealized_pnl, 2)}
```
Field names are **binding** per CONTEXT.md's Claude's Discretion resolution — verified against `frontend/lib/types.ts:21-36`: `Position.{ticker, quantity, avg_cost, current_price, market_value, unrealized_pnl, unrealized_pnl_percent}`, `Portfolio.{cash_balance, positions, total_value, total_unrealized_pnl}`.

**D-01 enforcement (new logic, no direct analog):** `execute_trade` must check watchlist membership before checking `PriceCache`, per RESEARCH.md's Security Domain table — `get_watchlist()` (already imported/available) gives the membership set; do not rely on `PriceCache.get_price(ticker) is None` alone as the gate.

---

### `backend/app/db/repository.py` (service, CRUD — new functions)

**Analog:** itself, existing `add_watchlist_ticker` (lines 39-63) and `remove_watchlist_ticker` (lines 66-87)

**Module-level conventions** (lines 1-17, applies to every new function):
```python
"""... Plain, module-level, synchronous functions — every call opens and closes its
own SQLite connection ... Route handlers must wrap every call here in
`await asyncio.to_thread(...)` ... Every SQL statement uses `?` placeholders ..."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import UTC, datetime

from app.db.connection import get_connection
from app.db.schema import DEFAULT_USER_ID
```

**Write pattern — one connection, `with conn:` for atomic commit** (lines 50-63):
```python
def add_watchlist_ticker(ticker: str) -> dict:
    row_id = str(uuid.uuid4())
    added_at = datetime.now(UTC).isoformat()
    conn = get_connection()
    try:
        try:
            with conn:
                conn.execute("INSERT INTO watchlist (...) VALUES (?, ?, ?, ?)", (...))
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"{ticker} is already on your watchlist.") from exc
    finally:
        conn.close()
    return {"ticker": ticker, "added_at": added_at}
```
`execute_trade(price_cache, ticker, side, quantity)` is the highest-risk new function — a single `with conn:` block reads `users_profile.cash_balance` + the `positions` row, validates, then writes `users_profile`, `positions` (upsert/delete), `trades` (insert), and `portfolio_snapshots` (insert) — all inside that one block. Concrete transaction body: RESEARCH.md's Architecture Patterns → Pattern 2 (lines 219-289 of 03-RESEARCH.md), which is itself derived from this exact connection-lifecycle idiom. Key rules pulled from CLAUDE.md + RESEARCH.md Pitfalls, restated here as the binding contract for this function:
- `avg_cost` recomputed **only** on buy: `new_avg_cost = round((old_basis + cost) / new_qty, 4)`; unchanged on sell.
- Epsilon close-out: `if new_qty <= 1e-9: DELETE` rather than storing near-zero; same epsilon (`quantity > held + 1e-9`) when validating an over-sell.
- `quantity <= 0` raises `ValueError` before any arithmetic (pydantic's `float` alone permits 0/negative).
- Round every money value to 2 decimals at write time (`round(x, 2)`), matching `PriceCache.update()`'s own 2-decimal rounding (`backend/app/market/cache.py` line 38: `rounded_price = round(price, 2)`).
- Upsert uses SQLite's `ON CONFLICT (user_id, ticker) DO UPDATE` against the existing `UNIQUE (user_id, ticker)` constraint (`schema.py` line 45) — valid syntax, no `IntegrityError` catch needed here (unlike `add_watchlist_ticker`, which uses the constraint to *reject* duplicates rather than merge them).

**Return-value-not-exception for "absent" pattern** (lines 66-86, `remove_watchlist_ticker`):
```python
def remove_watchlist_ticker(ticker: str) -> bool:
    conn = get_connection()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM watchlist WHERE user_id = ? AND ticker = ?", (...))
            return cursor.rowcount > 0
    finally:
        conn.close()
```
`get_positions()`, `get_cash_balance()`, `get_snapshots()` are simple reads — mirror `get_watchlist()` (lines 20-36): own connection, `SELECT ... WHERE user_id = ? ORDER BY ...`, `[dict(row) for row in rows]`, `finally: conn.close()`.

**Schema reference (read-only, do not re-declare):** `backend/app/db/schema.py` lines 37-68 — `positions` (id, user_id, ticker, quantity REAL, avg_cost REAL, updated_at, `UNIQUE(user_id, ticker)`), `trades` (id, user_id, ticker, side, quantity REAL, price REAL, executed_at), `portfolio_snapshots` (id, user_id, total_value REAL, recorded_at). `DEFAULT_USER_ID = "default"` at line 100.

---

### `backend/app/db/__init__.py` (module barrel)

**Analog:** itself (lines 1-18)
```python
"""Persistence subsystem for FinAlly.

Public API:
    init_db                - Idempotent lazy schema creation + default-data seeding
    get_watchlist           - Read the current user's watchlist rows
    add_watchlist_ticker    - Insert a new watchlist row, raising ValueError on a duplicate
    remove_watchlist_ticker - Delete a watchlist row, returning whether one was deleted
"""

from .init import init_db
from .repository import add_watchlist_ticker, get_watchlist, remove_watchlist_ticker

__all__ = [
    "init_db",
    "get_watchlist",
    "add_watchlist_ticker",
    "remove_watchlist_ticker",
]
```
Add `get_positions`, `get_cash_balance`, `execute_trade`, `record_snapshot`, `get_snapshots` to both the import line and `__all__`, plus a docstring line each — this is the enforced convention per `.claude/CLAUDE.md`'s Module Design section ("Define `__all__` in every module's `__init__.py`"; "Clients import from `app.market`, not `app.market.cache`, etc." — same rule applies to `app.db`).

---

### `backend/app/api/__init__.py` (module barrel)

**Analog:** itself (lines 1-11)
```python
"""REST API subsystem for FinAlly.

Public API:
    create_watchlist_router - FastAPI router factory for /api/watchlist
"""

from .watchlist import create_watchlist_router

__all__ = [
    "create_watchlist_router",
]
```
Add `from .portfolio import create_portfolio_router` and `"create_portfolio_router"` to `__all__` — `main.py` imports routers exclusively through this barrel (`from app.api import create_watchlist_router`, `main.py` line 22), so `create_portfolio_router` must be exported the same way or the import in `main.py` breaks.

---

### `backend/app/main.py` (bootstrap, MODIFY)

**Analog:** itself (lines 90-137, existing lifespan + router mounting)

**Router mounting pattern** (lines 22, 110-114):
```python
from app.api import create_watchlist_router
...
app.include_router(create_stream_router(price_cache))
app.include_router(create_watchlist_router(price_cache))
```
Add `from app.api import create_portfolio_router` and `app.include_router(create_portfolio_router(price_cache))` — must come before the static-file mount at line 125-129 (comment at lines 110-112 explains why: `Starlette` resolves routes in registration order and a mount at `"/"` swallows everything after it).

**Lifespan task lifecycle pattern** (lines 93-106):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(init_db)
    rows = await asyncio.to_thread(get_watchlist)
    tickers = [normalize_ticker(row["ticker"]) for row in rows] or DEFAULT_TICKERS
    await source.start(tickers)
    app.state.price_cache = price_cache
    app.state.market_source = source
    logger.info("Market data source started with %d tickers", len(tickers))
    yield
    await source.stop()
    logger.info("Market data source stopped")
```
Add the snapshot task's start (after `await source.start(tickers)`) and cancellation (before/after `await source.stop()`, order doesn't matter — they're independent tasks) using the cancel-and-await-CancelledError idiom shown below (from `simulator.py`).

---

### `backend/app/market/snapshot_task.py` (NEW, background task)

**Analog:** `backend/app/market/simulator.py`'s `SimulatorDataSource` task lifecycle (lines 248-302, read this session)

**Start pattern** (`simulator.py` lines 248-260):
```python
async def start(self, tickers: list[str]) -> None:
    ...
    self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")
    logger.info("Simulator started with %d tickers", len(normalized_tickers))
```

**Stop pattern — cancel then await, swallow CancelledError** (`simulator.py` lines 262-270):
```python
async def stop(self) -> None:
    if self._task and not self._task.done():
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
    self._task = None
    logger.info("Simulator stopped")
```

**Loop pattern — catch `Exception` broadly, log, never re-raise; sleep at the bottom** (`simulator.py` lines 292-302):
```python
async def _run_loop(self) -> None:
    """Core loop: step the simulation, write to cache, sleep."""
    while True:
        try:
            if self._sim:
                prices = self._sim.step()
                for ticker, price in prices.items():
                    self._cache.update(ticker=ticker, price=price)
        except Exception:
            logger.exception("Simulator step failed")
        await asyncio.sleep(self._interval)
```
`snapshot_loop(price_cache, interval=30.0)` follows this exact shape but must `raise` on `asyncio.CancelledError` rather than swallow it inside the loop body (per CLAUDE.md's Error Handling section: "Async task cancellation: catch `asyncio.CancelledError` when cleaning up" — the *loop* re-raises so `create_task`'s own cancellation propagates; the *stop-side* caller, i.e. `main.py`'s lifespan, is what swallows it via `try/except CancelledError` or `contextlib.suppress`, matching `simulator.py.stop()`'s own catch site rather than duplicating a second catch inside the loop):
```python
async def snapshot_loop(price_cache: PriceCache, interval: float = 30.0) -> None:
    while True:
        try:
            await asyncio.sleep(interval)
            await asyncio.to_thread(record_snapshot, price_cache)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Snapshot task failed; will retry next interval")
```
This is the one piece of new backend logic with no literal in-repo quote for the exact loop body — RESEARCH.md's own Pattern 3 labels it "a structural analogy," not a literal quote. Treat the above as confirmed-correct against `simulator.py`'s real source (this session), not as an unverified research claim.

---

### `frontend/components/TradeBar.tsx` (component, request-response)

**Analog:** `frontend/components/Watchlist.tsx`'s add-ticker form (lines 1-121)

**Imports pattern** (lines 1, 16-20):
```typescript
"use client";

import { type FormEvent, useState } from "react";
import { addWatchlistTicker, removeWatchlistTicker } from "@/lib/api";
```
`TradeBar.tsx` imports `postTrade` from `@/lib/api` (already implemented, lines 54-71 of `api.ts`) instead.

**Form state + submit pattern** (lines 36-60):
```typescript
const [inputValue, setInputValue] = useState("");
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState("");

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const trimmed = inputValue.trim();
  if (trimmed === "") {
    setError("Enter a ticker symbol to add it.");
    return;
  }
  setSubmitting(true);
  setError("");
  const result = await addWatchlistTicker(inputValue);
  if (result.ok) {
    setInputValue("");
    setError("");
    refetch();
  } else {
    setError(result.error);
  }
  setSubmitting(false);
}
```
`TradeBar`'s submit handler follows this shape exactly but calls `postTrade({ticker, side, quantity})`; on success (`result.ok && result.data.success`), clear ticker+quantity (D-06) and set a transient inline confirmation string (D-07, e.g. `` `Bought ${quantity} ${ticker} @ $${price}` ``) that fades — reuse `usePriceFlash`-style timed-class-clear idiom (see `frontend/lib/usePriceFlash.ts` lines 12-35) or a simple `setTimeout` clearing the confirmation state after ~2-3s. On failure (`result.ok && !result.data.success`, or `!result.ok`), set the error state (D-08) — do not clear the form.

**Disabled-during-submit + error-slot JSX pattern** (lines 98-121):
```typescript
<input
  disabled={submitting}
  ...
/>
<button type="submit" disabled={submitting} ...>
  {submitting ? "Adding…" : "Add Ticker"}
</button>
...
<p data-testid="watchlist-add-error" className="px-4 text-sm text-[var(--color-down)] empty:hidden">
  {error}
</p>
```
`TradeBar` reuses the identical `empty:hidden` error-paragraph idiom for its own error slot (D-08 explicitly requires "the same error-slot pattern already established for watchlist add/remove failures").

**Dropdown requirement (D-02, no direct analog — new JSX, not a form pattern deviation):** ticker field must be a `<select>` populated from `useWatchlist().watchlist` (already available via the existing hook), not a free-text `<input>` like the watchlist's own add form. Quantity field is a plain `<input type="number" step="any" min="0">` (D-05, fractional shares).

---

### `frontend/components/PositionsTable.tsx` (component, CRUD display)

**Analog:** `frontend/components/Watchlist.tsx` (table shell, lines 79-171) + `frontend/components/WatchlistRow.tsx` (row shape, lines 43-122)

**Panel chrome + table shell pattern** (`Watchlist.tsx` lines 91-92, 122-124, 151-166):
```typescript
<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
  ...
  <div data-testid="watchlist-scroll-container" className="lg:max-h-[440px] overflow-y-auto">
    <table className="w-full border-collapse text-sm">
      {tableHead}
      <tbody>
        {watchlist.map((entry) => (
          <WatchlistRow key={entry.ticker} ... />
        ))}
      </tbody>
    </table>
  </div>
</div>
```
`PositionsTable` reuses this exact panel-chrome + scrollable-table-body shape. Columns (ticker, qty, avg cost, current price, unrealized P&L, %change) come from `deriveLivePosition(position, ticks[position.ticker]?.price)` (see `frontend/lib/positionMath.ts` lines 18-31) fed by the shared `usePriceStreamContext()` — never re-derive P&L math locally.

**Formatting helpers already available (no new formatting code needed):**
```typescript
import { formatMoney, formatPercent, formatQuantity } from "@/lib/format";
```
`formatMoney` (lines 5-17), `formatQuantity` (lines 33-37), `formatPercent` (lines 27-31 — already used by `WatchlistRow.tsx` line 12) are all null-safe (render `"—"` on null/undefined/NaN) per `format.ts`'s own header comment.

**Click-to-select reuse** (`WatchlistRow.tsx` lines 53, 81-90): the `<tr onClick={select}>` + `tabIndex={0}` + `onKeyDown` Enter/Space pattern extends to `PositionsTable`'s rows if row-click-to-select is desired for consistency with D-10's heatmap/watchlist click wiring (not explicitly required by CONTEXT.md for the table, but matches the established convention if adopted).

---

### `frontend/components/Heatmap.tsx` (component, transform — partial analog)

**Analog:** `frontend/components/MainChart.tsx` (panel chrome + jsdom-safe render path, full file read) — **role-match only**; recharts' `Treemap` `content` render-prop has no in-repo precedent (see No Analog Found).

**Panel chrome pattern to copy** (`MainChart.tsx` lines 33-46):
```typescript
function PanelChrome({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      {heading}
      {children}
    </div>
  );
}
```

**jsdom-safe explicit-dimension escape hatch — load-bearing for the required unit test** (`MainChart.tsx` lines 23-29, 124-146):
```typescript
export interface MainChartProps {
  selectedTicker?: string;
  history: PricePoint[];
  tick?: PriceTick;
  width?: number;
  height?: number;
}
...
if (width !== undefined && height !== undefined) {
  return (
    <PanelChrome heading={heading}>
      <LineChart width={width} height={height} data={history}>
        {chartAxesAndGrid()}
        {chartLine()}
      </LineChart>
    </PanelChrome>
  );
}
return (
  <PanelChrome heading={heading}>
    <div style={{ height: PANEL_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>{chartAxesAndGrid()}{chartLine()}</LineChart>
      </ResponsiveContainer>
    </div>
  </PanelChrome>
);
```
`Heatmap` and `PnLChart` **must** accept optional `width`/`height` props and branch identically — `ResponsiveContainer` measures zero size under jsdom (confirmed by `MainChart.test.tsx` lines 90, 96, 104-110, which always pass explicit `width={400} height={240}`). Without this branch, `Heatmap.test.tsx`/`PnLChart.test.tsx` cannot assert any rendered content.

**Empty-state pattern** (`MainChart.tsx` lines 90-101, 111-122 — "nothing selected" / "no history" branches): `Heatmap`'s D-11 empty state ("No positions yet — buy a ticker to see it here") follows this exact `PanelChrome`-wrapped centered-message shape.

**Treemap tile content (new pattern, cite research, not codebase):** per `03-RESEARCH.md`'s Code Examples (`Frontend: Heatmap tile coloring by P&L`), sourced from Context7 `/recharts/recharts`'s `CustomContentTreemap.tsx` — the `content` render-prop receives `{x, y, width, height, name, ...}`. Fill color: `pnlPercent > 0 ? "var(--color-up)" : pnlPercent < 0 ? "var(--color-down)" : "#8b949e"` (color tokens already defined in `frontend/app/globals.css` lines 10-11: `--color-up: #16a34a`, `--color-down: #dc2626`). Click handler on the tile's `<g onClick={...}>` wires D-10.

---

### `frontend/components/PnLChart.tsx` (component, transform)

**Analog:** `frontend/components/MainChart.tsx` (exact structural match — `LineChart` over a time series, same library, same axes/tooltip shape)

**Axes/grid/tooltip pattern to copy verbatim in shape** (`MainChart.tsx` lines 61-87):
```typescript
function chartAxesAndGrid() {
  return (
    <>
      <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
      <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]}
        tickFormatter={(value: number) => formatClock(value)} stroke="#8b949e" fontSize={11} />
      <YAxis domain={["auto", "auto"]} tickFormatter={(value: number) => formatPrice(value)}
        stroke="#8b949e" fontSize={11} width={64} />
      <Tooltip labelFormatter={(label: unknown) => formatClock(Number(label))}
        formatter={(value: unknown) => [formatPrice(Number(value)), "Price"] as [string, string]}
        contentStyle={{ background: "#161b22", border: "1px solid #30363d" }} />
    </>
  );
}
```
`PnLChart` reuses this shape with `dataKey`/`tickFormatter` targeting `PortfolioSnapshot.{recorded_at, total_value}` (`frontend/lib/types.ts` lines 68-71) instead of `PricePoint.{timestamp, price}`, and `formatMoney` instead of `formatPrice` on the Y axis/tooltip. Data source: `usePortfolioHistory()` (already implemented in `frontend/lib/hooks.ts` lines 49-75) — per D-13, prepend a synthetic first point from `usePortfolio().portfolio.total_value` fetched on load when `snapshots` is empty, rather than rendering an empty chart.

**D-12 (no time-range selector):** render `snapshots` as-is with no windowing/decimation — do not add a selector UI; this is an explicit negative constraint, not a missing feature.

---

### `frontend/components/Header.tsx` (component, MODIFY)

**Analog:** itself (lines 1-31) + `frontend/lib/format.ts`'s `formatMoney` (lines 5-17)

**Current state (to be extended, not replaced)** (lines 3-9, 18-30):
```typescript
// Two things this component must never do: silently drop the
// simulated-feed disclosure, and stand in a placeholder portfolio total or
// cash balance. Both arrive with PORT-01 in Phase 3 — until then this
// header shows no dollar-denominated figure at all, not a zero or a dash
// styled to look implemented (see must_haves.prohibitions in 01-05-PLAN.md).

export function Header({ status }: HeaderProps) {
  return (
    <header className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold text-[var(--color-accent-yellow)]">FinAlly</h1>
        <p className="text-xs text-gray-400">AI Trading Workstation — Simulated market data</p>
      </div>
      <ConnectionDot status={status} />
    </header>
  );
}
```
This is the PORT-01 UI home explicitly deferred by the file's own header comment. Add a new prop (e.g. `cashBalance: number | null`, `totalValue: number | null`) rendered via `formatMoney(value)` between the title block and `<ConnectionDot>`, following the header's existing flex layout. `totalValue` should be the live-recomputed figure from the new `useLiveTotalValue` hook (see below), not a static REST snapshot value, per RESEARCH.md's Pitfall 5 (avoid divergence between REST snapshot and live SSE recompute).

---

### `frontend/lib/hooks.ts` (EXTEND: add `useLiveTotalValue`)

**Analog:** itself (existing `usePortfolio`/`usePortfolioHistory`, lines 13-75 — already implemented, contrary to RESEARCH.md's Recommended Project Structure block which lists them as pre-existing too — confirmed this session) + `frontend/lib/positionMath.ts`'s `deriveLivePosition` (lines 18-31)

The hook's own docstring already names `useLiveTotalValue` without defining it (line 11: "the header/positions table otherwise derive their *live* value from the SSE stream client-side (see `useLiveTotalValue`)"). Per RESEARCH.md's Code Examples:
```typescript
import { deriveLivePosition } from "./positionMath";
import type { Portfolio, PriceStreamEvent } from "./types";

export function useLiveTotalValue(portfolio: Portfolio | null, ticks: PriceStreamEvent): number | null {
  if (!portfolio) return null;
  let total = portfolio.cash_balance;
  for (const position of portfolio.positions) {
    const livePrice = ticks[position.ticker]?.price;
    total += deriveLivePosition(position, livePrice).marketValue;
  }
  return total;
}
```
This is a pure function of existing state (not a new fetch), so it does not need the `mountedRef`/`useEffect` polling shape `usePortfolio`/`usePortfolioHistory` use — it is a plain function, not necessarily a hook with internal state (naming it `useLiveTotalValue` for docstring consistency is fine even if it takes no `useState`/`useEffect` internally).

---

### `frontend/app/page.tsx` (page container, MODIFY)

**Analog:** itself (lines 1-68, full file read)

**Existing selection-guard + composition pattern** (lines 10-37, 39-60):
```typescript
function Terminal() {
  const { status, ticks, history, tickers } = usePriceStreamContext();
  const { watchlist } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string | undefined>(undefined);

  useEffect(() => {
    const watchlistTickers = watchlist.map((entry) => entry.ticker);
    const validSelection = selectedTicker && watchlistTickers.includes(selectedTicker);
    if (validSelection) return;
    const fallback = watchlistTickers.find((t) => tickers.includes(t)) ?? watchlistTickers[0];
    if (fallback !== selectedTicker) setSelectedTicker(fallback);
  }, [selectedTicker, watchlist, tickers]);

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <Header status={status} />
      <div data-testid="terminal-layout-row" className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:w-1/2">
          <Watchlist selectedTicker={selectedTicker} onSelect={setSelectedTicker} />
        </div>
        <div className="lg:w-1/2">
          <MainChart selectedTicker={selectedTicker} history={...} tick={...} />
        </div>
      </div>
    </main>
  );
}
```
`page.tsx` gains: `usePortfolio()`, `usePortfolioHistory()` calls (both hooks already exist); `useLiveTotalValue(portfolio, ticks)` fed into `<Header>`; a second layout row (or extended grid) mounting `<TradeBar>`, `<PositionsTable>`, `<Heatmap onSelect={setSelectedTicker} selectedTicker={selectedTicker}>`, `<PnLChart>`. D-10's click-to-select reuses the exact `onSelect={setSelectedTicker}` prop wiring already used for `<Watchlist>` at line 48 — pass the same `setSelectedTicker` callback into `Heatmap`, no new selection-state mechanism.

---

### `backend/tests/api/test_portfolio.py` (test, NEW)

**Analog:** `backend/tests/api/test_watchlist.py` (full file, 281 lines) + `backend/tests/api/conftest.py` (full file, 87 lines)

**Fixture reuse — no conftest changes needed:**
```python
# conftest.py already provides:
#   client              -> TestClient(create_app(static_dir=tmp_path, market_source=fake_market_source))
#   fake_market_source  -> FakeMarketDataSource() recording double
# Seeding a fill price for a trade test:
client.app.state.price_cache.update(ticker="AAPL", price=190.5)
```
(pattern confirmed at `test_watchlist.py` line 46)

**Test class shape to mirror** (`test_watchlist.py` lines 66-94, `TestAddWatchlist`):
```python
class TestBuyTrade:
    def test_buy_returns_200_with_expected_body(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)
        response = client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 2})
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["trade"]["ticker"] == "AAPL"
```
Cover: fresh-DB cash/positions shape (PORT-01), buy fills at cache price and debits cash exactly (PORT-02), sell fills and credits cash / deletes position at epsilon zero (PORT-03), insufficient-cash/insufficient-shares return 400 with `{"success": false, "error": ...}` and cause no state change (mirrors `test_watchlist.py`'s "does not change row count on rejected write" tests, e.g. lines 148-153, 201-206), ticker-not-on-watchlist returns 400 (D-01 enforcement), and `GET /api/portfolio/history` returns snapshots after a trade (PORT-06).

---

### `backend/tests/db/test_repository.py` (test, EXTEND)

**Analog:** itself, existing `TestAddWatchlistTicker`/`TestRemoveWatchlistTicker` (full file, 72 lines) + `backend/tests/db/conftest.py`'s `initialized_db` fixture

```python
@pytest.fixture
def initialized_db(tmp_path, monkeypatch):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    init_db()
```
New test classes (`TestExecuteTrade`, `TestRecordSnapshot`, `TestGetPositions`) follow `TestAddWatchlistTicker`'s exact shape: direct function calls against `initialized_db`, no HTTP layer, asserting both the return dict shape and post-condition row state via `get_positions()`/`get_watchlist()`-style read-back calls.

---

### `frontend/__tests__/TradeBar.test.tsx` (test, NEW)

**Analog:** `frontend/__tests__/Watchlist.test.tsx`'s `describe("Watchlist add-ticker form", ...)` block (lines 827-952)

**Mocking convention — `vi.mock` the API module, not the component:**
```typescript
vi.mock("@/lib/api", () => ({
  postTrade: vi.fn(),
}));
```
(mirrors lines 24-27's `addWatchlistTicker`/`removeWatchlistTicker` mock)

**In-flight disabled-state test pattern** (lines 913-935): resolve a manually-controlled promise to assert `disabled`/`"Adding…"`-equivalent label mid-flight, then resolve and assert re-enable — copy this shape for TradeBar's buy/sell buttons during submit.

**Clear-on-success test pattern** (lines 937-951): assert ticker/quantity fields reset to empty after a successful trade (D-06), mirroring the input-value assertion at line 949.

---

### `frontend/__tests__/PositionsTable.test.tsx`, `Heatmap.test.tsx`, `PnLChart.test.tsx` (test, NEW)

**Analog:** `frontend/__tests__/MainChart.test.tsx` (full file, 134 lines)

**Explicit-dimension render pattern, required for jsdom** (lines 90, 96, 104-110):
```typescript
render(<MainChart history={[]} width={400} height={240} />);
```
Every `Heatmap`/`PnLChart` test must pass explicit `width`/`height` (see the Heatmap/PnLChart pattern sections above) — a bare `<ResponsiveContainer>` render will assert against a zero-size SVG under jsdom and fail non-deterministically.

**SVG-presence assertion pattern** (lines 102-116): `container.querySelector("svg")` / `container.querySelector("path")` — reuse this for asserting the `Treemap`/`LineChart` actually rendered content, not just chrome.

---

### `frontend/__tests__/Header.test.tsx` (test, NEW)

**Analog:** `frontend/components/Header.tsx` (itself, current props: `{status}` only) + `frontend/__tests__/Watchlist.test.tsx`'s mocking conventions for hook substitution

No existing `Header.test.tsx` file exists yet despite `03-RESEARCH.md`'s Validation Architecture table citing `npm test -- Header` for PORT-01 — this is a net-new test file, not an extension. Follow the render + `screen.getByText`/`getByTestId` assertion style used throughout `Watchlist.test.tsx` (e.g. lines 114-120) to assert the new cash/total-value props render through `formatMoney`, and that the pre-Phase-3 "no dollar figure" prohibition (now satisfied) doesn't regress into a stray `0`/`NaN` when `portfolio` is still loading (`null`).

---

## Shared Patterns

### Repository/Route Mirroring (backend, cross-cutting)
**Source:** `backend/app/db/repository.py` (module docstring, lines 1-8) + `backend/app/api/watchlist.py` (whole file)
**Apply to:** `backend/app/api/portfolio.py`, `backend/app/db/repository.py`'s new functions
```python
# Every repository function: own connection, `with conn:` for writes, ValueError for
# caller-level conditions.
conn = get_connection()
try:
    with conn:
        ...
finally:
    conn.close()

# Every route call site:
result = await asyncio.to_thread(repository_function, ...)
```

### `ValueError` → HTTP status translation (backend, cross-cutting)
**Source:** `backend/app/api/watchlist.py` lines 102-108
**Apply to:** `POST /api/portfolio/trade`'s 400 path
```python
try:
    result = await asyncio.to_thread(execute_trade, price_cache, body.ticker, body.side, body.quantity)
except ValueError as exc:
    return JSONResponse(status_code=400, content={"success": False, "error": str(exc)})
return JSONResponse(status_code=200, content=result)
```

### Background task lifecycle (backend, cross-cutting)
**Source:** `backend/app/market/simulator.py` lines 248-302 (`SimulatorDataSource.start`/`.stop`/`._run_loop`)
**Apply to:** the new snapshot task started/stopped in `main.py`'s lifespan
```python
# start: asyncio.create_task(...)
# stop:  task.cancel(); try: await task except asyncio.CancelledError: pass
# loop:  while True: try: ... except asyncio.CancelledError: raise
#                     except Exception: logger.exception(...)
#                     await asyncio.sleep(interval)
```

### Null-safe formatting helpers (frontend, cross-cutting)
**Source:** `frontend/lib/format.ts` (whole file, 56 lines) — `formatMoney`, `formatPrice`, `formatPercent`, `formatQuantity` all already implemented and already render `"—"` on null/undefined/NaN.
**Apply to:** `Header.tsx`, `PositionsTable.tsx`, `TradeBar.tsx`, `PnLChart.tsx` — never hand-roll `toFixed`/`toLocaleString` inline; import from `format.ts`.

### jsdom-safe recharts render path (frontend, cross-cutting)
**Source:** `frontend/components/MainChart.tsx` lines 23-29, 89, 124-146
**Apply to:** `Heatmap.tsx`, `PnLChart.tsx` — accept optional `width`/`height` props; when both are present, render the bare chart component directly (no `ResponsiveContainer`); otherwise wrap in `ResponsiveContainer` inside a fixed-height `<div>`. Load-bearing for `Heatmap.test.tsx`/`PnLChart.test.tsx` to render anything under jsdom.

### Error-slot + submitting-state UI pattern (frontend, cross-cutting)
**Source:** `frontend/components/Watchlist.tsx` lines 36-60 (state), 98-121 (JSX)
**Apply to:** `TradeBar.tsx` — `submitting` boolean disables inputs/buttons and swaps button label; a `<p className="... empty:hidden">{error}</p>` slot renders inline errors (D-08); success clears the form fields (D-06) and sets a transient confirmation message (D-07).

### Click-to-select wiring (frontend, cross-cutting)
**Source:** `frontend/app/page.tsx` lines 48 (`<Watchlist onSelect={setSelectedTicker}>`), `frontend/components/WatchlistRow.tsx` lines 53, 81-90 (`<tr onClick={select}>` + keyboard activation)
**Apply to:** `PositionsTable.tsx` rows (optional) and `Heatmap.tsx` tiles (required, D-10) — pass the same `setSelectedTicker` callback down from `page.tsx`, no parallel selection-state mechanism.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/components/Heatmap.tsx`'s `Treemap` `content` render-prop internals | component/chart | transform | No treemap or squarified-layout component exists anywhere in this repo; `MainChart.tsx` gives panel chrome + jsdom handling only. Use RESEARCH.md's Code Examples (Context7-sourced `CustomContentTreemap.tsx` pattern) for the tile-rendering shape itself. |
| `backend/app/db/repository.py`'s `execute_trade` (multi-table transactional write) | service | CRUD | No existing repository function writes to more than one table inside a single `with conn:` block (`add_watchlist_ticker`/`remove_watchlist_ticker` each touch exactly one table). The connection-lifecycle half of the pattern is a full analog; the four-table-single-transaction shape itself is new — use RESEARCH.md's Pattern 2 (verified against real schema/constraints this session) as the concrete reference. |
| `frontend/__tests__/positionMath.test.ts` | test | transform | `deriveLivePosition` exists in source (`frontend/lib/positionMath.ts`) but has no dedicated test file yet in `frontend/__tests__/`. Low-risk: it's a short pure function: test both branches (`livePrice === undefined` fallback, and the live-recompute branch) directly, no component-test scaffolding needed. |

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/db/`, `backend/app/market/`, `backend/app/main.py`, `backend/tests/api/`, `backend/tests/db/`, `frontend/components/`, `frontend/lib/`, `frontend/app/`, `frontend/__tests__/` — all directories read in full or via targeted `Read`/`Grep`, not sampled.
**Files scanned:** 24 (full reads: `watchlist.py`, `repository.py`, `schema.py`, `main.py`, `connection.py`, `db/__init__.py`, `api/__init__.py`, `cache.py`, `types.ts`, `api.ts`, `positionMath.ts`, `hooks.ts`, `Watchlist.tsx`, `WatchlistRow.tsx`, `MainChart.tsx`, `Header.tsx`, `usePriceFlash.ts`, `format.ts`, `page.tsx`, `test_watchlist.py`, `conftest.py` (api), `test_repository.py`, `db/conftest.py`, `MainChart.test.tsx`, `Watchlist.test.tsx`; targeted read: `simulator.py` lines 240-302)
**Tracked-source gate:** all 22 analog file paths verified via `git ls-files` this session — all tracked, none are gitignored mirrors.
**Pattern extraction date:** 2026-09-20

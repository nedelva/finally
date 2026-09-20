# Phase 1: Live Price Terminal - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 21 (5 backend new/modified, 2 backend tests, 1 backend dependency edit, 6 frontend config, 2 frontend lib additions, 6 frontend components/app files — see breakdown below)
**Analogs found:** 18 / 21 (3 config files have no live analog; use RESEARCH.md Code Examples instead)

## ⚠️ Blocking Repo Issue — Must Be a Task Before Any `frontend/lib/` Edit

**`frontend/lib/` is gitignored.** `.gitignore:17` has a bare `lib/` entry — a leftover from the generic Python `gitignore.io` template (intended for Python's `build/lib/` packaging output), not an intentional exclusion of this project's frontend utility directory. Verified this session:

```
$ git check-ignore -v frontend/lib/types.ts
.gitignore:17:lib/	frontend/lib/types.ts

$ git status --porcelain --ignored frontend/
!! frontend/lib/          ← entire directory ignored
?? frontend/              ← everything else (app/, components/, configs) is untracked but NOT ignored
```

This is **not** a plugin/capability mirror (gate #3645's usual case) — there is no tracked origin elsewhere to substitute. `frontend/lib/types.ts`, `api.ts`, `hooks.ts`, `usePriceFlash.ts`, `positionMath.ts`, `format.ts` are the one and only copies of this hand-authored source, and RESEARCH.md correctly mandates reusing them verbatim. But as written, **no file under `frontend/lib/` — existing or new (`usePriceStream.ts`, `PriceStreamContext.tsx`) — can ever be `git add`ed.** Any executor work there will build correctly and pass tests locally, then silently vanish from `git status`/commits, including the two new Phase 1 files this phase's own recommended structure places there.

**Required fix (make it its own Wave 0 task, before other frontend lib edits land):** narrow `.gitignore:17` — e.g. change `lib/` to `/lib/` (root-only Python build dir) or add an explicit negation `!frontend/lib/` beneath it — then `git add frontend/lib/*.ts`. This is a one-line `.gitignore` edit + a `git add`, not a design decision; flagging here per the mandate that analog paths must be real tracked source. `frontend/app/`, `frontend/components/`, and all config files at `frontend/` root are unaffected (not matched by the `lib/` pattern).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/main.py` | controller (app entrypoint) | request-response + lifecycle | `backend/market_data_demo.py` (lifecycle wiring) + `backend/app/market/stream.py` (router mount) | role-match (no FastAPI app exists yet) |
| `backend/app/market/models.py` (MODIFIED) | model | transform | itself (current code) | self |
| `backend/app/market/cache.py` (MODIFIED) | service (in-memory store) | CRUD | itself (current code) | self |
| `backend/app/market/stream.py` (MODIFIED) | route (SSE) | streaming | itself (current code) | self |
| `backend/app/market/seed_prices.py` (MODIFIED) | config/data | batch (static data) | itself (current code) | self |
| `backend/pyproject.toml` (MODIFIED — add httpx dev dep) | config | — | itself (current code) | self |
| `backend/tests/test_main.py` | test | request-response | `backend/tests/market/test_simulator_source.py` (async class-based) | role-match |
| `backend/tests/market/test_stream.py` | test | streaming | `backend/tests/market/test_simulator_source.py` (async lifecycle assertions) + `backend/tests/conftest.py` (fixture shape) | role-match |
| `frontend/package.json` | config | — | none (RESEARCH.md Code Examples) | no analog |
| `frontend/next.config.js` | config | — | none (RESEARCH.md Code Examples) | no analog |
| `frontend/tsconfig.json` | config | — | none (RESEARCH.md Code Examples) | no analog |
| `frontend/postcss.config.mjs` | config | — | none (RESEARCH.md Code Examples) | no analog |
| `frontend/vitest.config.ts` / `vitest.setup.ts` | config | — | none (RESEARCH.md Code Examples) | no analog |
| `frontend/app/layout.tsx` | component (server) | request-response | none (`.tsx` doesn't exist yet) — convention analog: `frontend/lib/types.ts` module docstring header style | role-mismatch / convention-only |
| `frontend/app/page.tsx` | component (client) | event-driven | none — convention analog: `frontend/lib/hooks.ts` (`"use client"`, hook composition) | role-mismatch / convention-only |
| `frontend/app/globals.css` | config (styles) | — | none (RESEARCH.md Code Examples) | no analog |
| `frontend/lib/usePriceStream.ts` (NEW, ⚠️ gitignored dir — see blocker) | hook | streaming (EventSource → context) | `frontend/lib/hooks.ts` (fetch/poll hook shape) + `frontend/lib/usePriceFlash.ts` (timer/ref hook shape) | role-match |
| `frontend/lib/PriceStreamContext.tsx` (NEW, ⚠️ gitignored dir) | provider | event-driven (pub-sub to subscribers) | `frontend/lib/hooks.ts` (`usePortfolio`'s mount/cleanup/ref pattern) | role-match (no existing provider; closest lifecycle shape) |
| `frontend/components/Header.tsx` | component | request-response (derived state) | `frontend/lib/format.ts` (null-safe formatting conventions to call into) | role-mismatch / convention-only |
| `frontend/components/ConnectionDot.tsx` | component | event-driven | `frontend/lib/types.ts` (`ConnectionStatus` union — the type it renders) | role-mismatch / convention-only |
| `frontend/components/Watchlist.tsx` + `WatchlistRow.tsx` | component | streaming (subscribes to context) | `frontend/lib/usePriceFlash.ts` (consumption pattern) + `frontend/lib/positionMath.ts` (derived-value style) | role-mismatch / convention-only |
| `frontend/components/Sparkline.tsx` + `MainChart.tsx` | component | transform (ring buffer → chart) | none — use RESEARCH.md's Recharts `LineChart` example verbatim as structural analog | no analog (library-pattern only) |

## Pattern Assignments

### `backend/app/main.py` (NEW — controller/entrypoint)

**Analogs:** `backend/market_data_demo.py` (lifecycle sequencing) + `backend/app/market/stream.py` (router registration) + `backend/app/market/factory.py` (source selection)

**Lifecycle sequencing pattern** (`backend/market_data_demo.py:207-219, 263-266`):
```python
async def run() -> None:
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.5)
    await source.start(TICKERS)
    ...
    try:
        ...
    finally:
        await source.stop()
```
This is the only place in the codebase that actually calls `.start()`/`.stop()` end to end — `main.py`'s `lifespan` should mirror this `start → yield/run → finally stop` shape, but swap `SimulatorDataSource(...)` direct construction for the factory:

**Factory + explicit ticker list** (`backend/app/market/factory.py:16-31`, `backend/app/market/seed_prices.py` — add `DEFAULT_TICKERS` per RESEARCH.md Pattern proposal):
```python
def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
    if api_key:
        logger.info("Market data source: Massive API (real data)")
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        logger.info("Market data source: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
```

**Router registration + mount ordering** (`backend/app/market/__init__.py:11-23`, `backend/app/market/stream.py:1-13`):
```python
from app.market import PriceCache, create_market_data_source, create_stream_router
```
Import from the `app.market` package root (barrel `__init__.py`), never `app.market.stream` directly — matches CONVENTIONS.md's "Clients import from `app.market`, not `app.market.cache`" rule.

**Logging pattern to reuse** (`backend/app/market/factory.py:5,13`):
```python
import logging
logger = logging.getLogger(__name__)
...
logger.info("Simulator started with %d tickers", len(tickers))  # %-formatting, not f-strings
```

**Health check** — no existing analog (first REST route in the codebase); use RESEARCH.md's Code Examples verbatim:
```python
@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

**Type-hint / docstring conventions to follow** (CONVENTIONS.md, verified against `cache.py`/`stream.py`): `from __future__ import annotations` at top; full type hints on every function; module + function docstrings describing purpose and lifecycle; `| None` not `Optional[...]`.

---

### `backend/app/market/models.py` (MODIFIED — session-anchored change/change_percent)

**Analog:** itself, current code (self-modification)

**Current code being replaced** (`backend/app/market/models.py:9-49`, full file read):
```python
@dataclass(frozen=True, slots=True)
class PriceUpdate:
    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)

    @property
    def change(self) -> float:
        """Absolute price change from previous update."""
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        """Percentage change from previous update."""
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat'."""
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        """Serialize for JSON / SSE transmission."""
        return {
            "ticker": self.ticker, "price": self.price, "previous_price": self.previous_price,
            "timestamp": self.timestamp, "change": self.change,
            "change_percent": self.change_percent, "direction": self.direction,
        }
```
**Convention to preserve exactly:** `@dataclass(frozen=True, slots=True)`, `@property` with no prefix, docstring-per-property, `to_dict()` key set must not change shape (frontend `PriceTick` in `types.ts:7-16` matches it verbatim — do not rename/add/remove keys, only change how `change`/`change_percent` are computed internally per RESEARCH.md Pattern 3, by adding a `session_open_price` field alongside `previous_price`).

---

### `backend/app/market/cache.py` (MODIFIED — thread `_session_open` through `update()`)

**Analog:** itself, current code

**Locked read-modify-write block to extend** (`backend/app/market/cache.py:23-42`):
```python
def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
    """Record a new price for a ticker. Returns the created PriceUpdate.

    Automatically computes direction and change from the previous price.
    If this is the first update for the ticker, previous_price == price (direction='flat').
    """
    with self._lock:
        ts = timestamp or time.time()
        prev = self._prices.get(ticker)
        previous_price = prev.price if prev else price

        update = PriceUpdate(
            ticker=ticker, price=round(price, 2), previous_price=round(previous_price, 2),
            timestamp=ts,
        )
        self._prices[ticker] = update
        self._version += 1
        return update
```
**Pattern to follow:** thread-safety convention is `with self._lock:` wrapping the entire read-modify-write (CONVENTIONS.md "Thread Safety" section) — any new `_session_open: dict[str, float]` state must be read/written inside this same `with self._lock:` block, not a second lock. `remove()` (`cache.py:59-62`) must also clear the ticker's `_session_open` entry so re-adding a ticker resets its session anchor (per RESEARCH.md Pattern 3's "or when re-added after `remove()`" note).

---

### `backend/app/market/stream.py` (MODIFIED — 3 fixes)

**Analog:** itself, current code

**Fix 1 — router singleton** (`backend/app/market/stream.py:17,20`, current bug):
```python
router = APIRouter(prefix="/api/stream", tags=["streaming"])  # module scope — WRONG

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    @router.get("/prices")  # decorates onto the shared singleton
    ...
    return router
```
Move `router = APIRouter(...)` inside the factory function body (ARCHITECTURE.md's documented fix, matches CONVENTIONS.md's "Factory Pattern": "Create sources via factory functions... Returns a NEW instance").

**Fix 2 — version/empty-cache ordering** (`backend/app/market/stream.py:75-83`, current bug):
```python
current_version = price_cache.version
if current_version != last_version:
    last_version = current_version          # ← advances even if prices is empty
    prices = price_cache.get_all()
    if prices:
        data = {ticker: update.to_dict() for ticker, update in prices.items()}
        payload = json.dumps(data)
        yield f"data: {payload}\n\n"
```
Nest so `last_version` only advances inside `if prices:` (RESEARCH.md Pitfall 2's exact fix).

**Fix 3 — keepalive** — add per RESEARCH.md's proposed addition inside `_generate_events()`, using the same `time.monotonic()` + interval-check idiom already used for `asyncio.sleep(interval)` in this function.

**Preserve exactly:** SSE framing (`retry: 1000\n\n`, `data: {json}\n\n`), disconnect handling (`await request.is_disconnected()` + `except asyncio.CancelledError:` + `logger.info(...)` on both connect/disconnect, `stream.py:65-73,86-88`), response headers (`stream.py:41-45`: `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`).

---

### `backend/tests/test_main.py` (NEW)

**Analog:** `backend/tests/market/test_simulator_source.py` (class-based async test shape) + `backend/tests/conftest.py` (fixture convention)

**Class + fixture structure to copy** (`backend/tests/market/test_simulator_source.py:1-16`):
```python
"""Integration tests for SimulatorDataSource."""

import asyncio
import pytest

from app.market.cache import PriceCache
from app.market.simulator import SimulatorDataSource


@pytest.mark.asyncio
class TestSimulatorDataSource:
    """Integration tests for the SimulatorDataSource."""

    async def test_start_populates_cache(self):
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL", "GOOGL"])
        assert cache.get("AAPL") is not None
        await source.stop()
```
Apply the same shape to `TestMain` / `TestHealthEndpoint`: `@pytest.mark.asyncio class Test...:` with one behavior asserted per `async def test_...(self):` method, always paired `start`/`stop` (or app fixture teardown) so state doesn't leak between tests. `conftest.py`'s `event_loop_policy` fixture (`backend/tests/conftest.py:6-11`) is already in scope project-wide — no new fixture needed unless a `TestClient`/`AsyncClient` fixture is shared across multiple test files, in which case add it to `conftest.py` following its existing one-fixture-per-concern style.

---

### `backend/tests/market/test_stream.py` (NEW)

**Analog:** `backend/tests/market/test_simulator_source.py` (async lifecycle assertions: version counter, start/stop idempotency) — RESEARCH.md's httpx `ASGITransport` skeleton supplies the *mechanism* (not in the codebase yet, first use of `httpx.AsyncClient` this project), but structure the test class/method breakdown the way `test_simulator_source.py` does: one `TestSSEStream` class, short single-assertion `async def test_*` methods, `cache.version` used as the change-detection assertion (`test_simulator_source.py:27-38`):
```python
async def test_prices_update_over_time(self):
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.05)
    await source.start(["AAPL"])
    initial_version = cache.version
    await asyncio.sleep(0.3)
    assert cache.version > initial_version
    await source.stop()
```
Use this same "assert version advanced" idiom to test Pitfall 2's fix (empty-cache doesn't advance `last_version`) and Pitfall 1's fix (two `create_stream_router()` calls with different caches don't cross-contaminate — construct two `PriceCache()` instances and two routers, assert each returns only its own ticker).

---

### `backend/app/market/seed_prices.py` (MODIFIED — add `DEFAULT_TICKERS`)

**Analog:** itself, current code

**Existing style to match** (`backend/app/market/seed_prices.py:1-15`):
```python
"""Seed prices and per-ticker parameters for the market simulator."""

SEED_PRICES: dict[str, float] = {
    "AAPL": 190.00, "GOOGL": 175.00, ...
}
```
Add `DEFAULT_TICKERS: list[str] = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]` as a new top-level constant, `UPPER_SNAKE_CASE` per CONVENTIONS.md, with a one-line comment (module already has zero blank-line-separated top-of-file docstring + inline `#` comments per constant block — follow that, don't add a class).

---

### `frontend/lib/usePriceStream.ts` (NEW — ⚠️ see gitignore blocker above)

**Analogs:** `frontend/lib/hooks.ts` (mount/poll/cleanup shape) + `frontend/lib/usePriceFlash.ts` (ref-based timer/state shape)

**Hook skeleton to copy from** (`frontend/lib/hooks.ts:13-47`, `usePortfolio`):
```typescript
"use client";

export function usePortfolio(pollMs = 20000) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => { ... }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    const interval = setInterval(() => void refetch(), pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refetch, pollMs]);

  return { portfolio, loading, error, refetch };
}
```
Adapt this shape for `EventSource` instead of `setInterval`+`fetch`: construct `new EventSource("/api/stream/prices")` inside the `useEffect`, wire `.onopen`/`.onerror`/`.onmessage` to update `connectionStatus` (typed via `ConnectionStatus` from `types.ts:135`) and per-ticker ring buffers, and `.close()` the `EventSource` in the cleanup function (mirrors `clearInterval(interval)`'s cleanup role). Use the same `mountedRef` guard pattern before any `setState` in an async callback.

**Ref-based timer pattern to copy** (`frontend/lib/usePriceFlash.ts:12-35`, full file):
```typescript
"use client";

import { useEffect, useRef, useState } from "react";

export function usePriceFlash(price: number | null | undefined): string {
  const [flashClass, setFlashClass] = useState("");
  const prevRef = useRef<number | null | undefined>(price);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  ...
}
```
Use this exact `useRef<T | null>` + `ReturnType<typeof setTimeout>` idiom for the sparkline ring buffer (`useRef<Map<string, number[]>>` or similar) — this project already established "ref for values that must persist across renders without triggering one" as the pattern; don't reach for a separate state library.

**Type reuse — do not redefine, import from `types.ts`** (`frontend/lib/types.ts:4-19,135`):
```typescript
export type Direction = "up" | "down" | "flat";
export interface PriceTick { ticker: string; price: number; previous_price: number; timestamp: number; change: number; change_percent: number; direction: Direction; }
export type PriceStreamEvent = Record<string, PriceTick>;
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
```

---

### `frontend/lib/PriceStreamContext.tsx` (NEW — ⚠️ see gitignore blocker above)

**Analog:** `frontend/lib/hooks.ts` (no existing Context provider in the codebase — this is a role-match on lifecycle, not an exact analog)

No `createContext`/`Provider` exists yet anywhere in the repo (confirmed: `frontend/lib/` has zero `.tsx` files today). Wrap `usePriceStream()`'s return value in a `PriceStreamContext.Provider` following the file-header comment convention already used across `lib/*.ts` (a top-of-file JSDoc-style comment explaining *why*, e.g. `usePriceFlash.ts:5-11`'s block), and keep the `"use client"` directive as line 1 (present in every existing hook file: `hooks.ts:1`, `usePriceFlash.ts:1`).

---

### `frontend/components/*.tsx` (NEW — Header, ConnectionDot, Watchlist, WatchlistRow, Sparkline, MainChart)

**No component-role analog exists** (zero `.tsx` files in the repo today — confirmed via read of `frontend/` structure). Pull structural shape from RESEARCH.md's Code Examples (Recharts `Sparkline` snippet) and naming/type conventions from `frontend/lib/*.ts`:

**Formatting calls to use, not reimplement** (`frontend/lib/format.ts:5-37`, full file read):
```typescript
export function formatMoney(value: number | null | undefined, opts?: { sign?: boolean }): string { ... }
export function formatPrice(value: number | null | undefined): string { ... }
export function formatPercent(value: number | null | undefined, opts?: { sign?: boolean }): string { ... }
```
Every price/percent/money value rendered in `WatchlistRow.tsx`, `Header.tsx`, `MainChart.tsx` must go through these — they are already null-safe (render `"—"` for `null`/`undefined`/`NaN`), matching the nullable `WatchlistEntry` fields in `types.ts:77-85`. Do not write inline `.toFixed()`/`.toLocaleString()` calls in components.

**Derived-value pattern to copy for live P&L-style calculations** (`frontend/lib/positionMath.ts:18-31`, full file):
```typescript
export function deriveLivePosition(position: Position, livePrice: number | undefined): LivePosition {
  if (livePrice === undefined) {
    return { price: position.current_price, marketValue: position.market_value, ... };
  }
  const marketValue = position.quantity * livePrice;
  ...
}
```
Same "fall back to REST snapshot when no live tick exists yet" idiom applies to `WatchlistRow` — render `WatchlistEntry`'s REST-sourced price until the first SSE tick arrives for that ticker, then switch to the live value; never show a blank/zero price during that gap.

**Sparkline structural pattern** (RESEARCH.md Code Examples, Recharts):
```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data }: { data: { price: number }[] }) {
  return (
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="price" stroke="#209dd7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```
`MainChart.tsx` is the same primitive with `<XAxis>`/`<YAxis>`/`<Tooltip>` added (PLAN.md §10) — do not introduce `lightweight-charts` (RESEARCH.md Alternatives Considered: not installed, avoid new dependency risk).

**CSS flash class contract** (`frontend/app/globals.css` — new, per RESEARCH.md Code Examples — and `usePriceFlash.ts:24`):
```typescript
setFlashClass(price > prev ? "flash-up" : "flash-down");
```
`WatchlistRow.tsx` must apply the class returned by `usePriceFlash(livePrice)` directly to its price cell's `className`, matching the `.flash-up`/`.flash-down` CSS classes defined in `globals.css` (color-mix background + 550ms transition) — do not hand-roll a second animation mechanism.

---

### Config files: `package.json`, `next.config.js`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

**No live analog** — these are the first files of their kind in the repo (frontend scaffold was deliberately stripped per RESEARCH.md's Summary). Use RESEARCH.md's "Code Examples" section verbatim as the source of truth (already version-verified against `frontend/node_modules` on disk this session — HIGH confidence). Do not use the git-history-recovered `tsconfig.json`/`package.json` from `c11222f1^` (RESEARCH.md Secondary Sources) — those pin Next 14.2.11/React 18.3.1, stale relative to what's actually installed (Next 16.3.5/React 19.2.8).

## Shared Patterns

### Backend: Module-level logger + `%`-formatting
**Source:** `backend/app/market/factory.py:5,13`, `backend/app/market/stream.py:15,66,72,87`
**Apply to:** `main.py`, all modified market modules
```python
import logging
logger = logging.getLogger(__name__)
...
logger.info("SSE client connected: %s", client_ip)   # % formatting, never f-strings in log calls
```

### Backend: Barrel-file imports from `app.market`
**Source:** `backend/app/market/__init__.py:11-23`
**Apply to:** `main.py` and any new backend module that consumes market data
```python
from app.market import PriceCache, create_market_data_source, create_stream_router
```
Never `from app.market.cache import PriceCache` from outside the `market` package (CONVENTIONS.md "Barrel Files").

### Backend: `from __future__ import annotations` + full type hints
**Source:** every file in `backend/app/market/*.py` (verified: `models.py:3`, `cache.py:3`, `stream.py:3`, `factory.py:3`)
**Apply to:** `main.py` and all modified/new backend files — always first import line, followed by stdlib, then third-party, then local (CONVENTIONS.md Import Organization).

### Frontend: `"use client"` as line 1 + null-safe formatting via `lib/format.ts`
**Source:** `frontend/lib/hooks.ts:1`, `frontend/lib/usePriceFlash.ts:1`; `frontend/lib/format.ts` (whole file)
**Apply to:** every new hook, context provider, and interactive component (`page.tsx`, `Watchlist.tsx`, `WatchlistRow.tsx`, `Header.tsx`, `ConnectionDot.tsx`, `MainChart.tsx`) — `layout.tsx` is the one exception (server component, no directive, per RESEARCH.md's recommended structure).

### Frontend: `ApiResult<T>` fetch-result discriminated union
**Source:** `frontend/lib/api.ts:19` — `export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };`
**Apply to:** Not directly used by Phase 1 (no `/api/portfolio` or `/api/watchlist` calls yet per RESEARCH.md's structure — Phase 1 is SSE-only), but any Phase 1 code that *does* end up calling `getWatchlist()`/etc. (e.g., if `Header.tsx` needs cash balance context prematurely) must use this existing wrapper, not a new fetch abstraction.

### Backend: Single-writer, lock-protected read-modify-write on shared state
**Source:** `backend/app/market/cache.py:29-42` (ARCHITECTURE.md "Threading Model" + "Single Writer")
**Apply to:** any modification touching `PriceCache.update()`/`remove()` for the `session_open_price` feature — always inside the existing `with self._lock:` block, never a new lock.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/package.json` | config | — | First frontend config file authored this phase; frontend scaffold was deliberately deleted before this project reached this phase (RESEARCH.md Summary) |
| `frontend/next.config.js` | config | — | Same as above |
| `frontend/tsconfig.json` | config | — | Same as above; git-history version at `c11222f1^` exists but is stale (Next 14 vs. installed 16) — do not use as analog |
| `frontend/postcss.config.mjs` | config | — | Tailwind v4 CSS-first config never configured in this repo before |
| `frontend/vitest.config.ts`, `frontend/vitest.setup.ts` | config | — | No test runner config exists yet despite vitest/jsdom being pre-installed |
| `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/globals.css` | component / config | request-response / — | Zero files under `frontend/app/` exist; this is the first Next.js App Router code in the project |
| `frontend/components/*.tsx` (all 6) | component | streaming / transform | Zero `.tsx` component files exist anywhere in the repo; use RESEARCH.md's Recharts example + `frontend/lib/*.ts` conventions (see Pattern Assignments above) as the closest available guidance |

## Metadata

**Analog search scope:** `backend/app/market/*.py` (all 8 modules read in full), `backend/tests/market/*.py` (2 of 6 test modules read: `test_simulator_source.py`, plus `conftest.py`), `backend/market_data_demo.py` (read in full), `frontend/lib/*.ts` (all 6 files read in full), `frontend/` directory tree (confirmed no `.tsx`/`app/`/config files exist on disk yet).
**Files scanned:** 21 target files classified; 12 existing files read as source analogs.
**Pattern extraction date:** 2026-09-17

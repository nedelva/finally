---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
<!-- refreshed: 2026-09-17 -->

# Architecture

**Analysis Date:** 2026-09-17

## System Overview

The FinAlly backend currently implements a **market data subsystem** that streams live prices to clients via SSE (Server-Sent Events). The system is designed with a pluggable data source architecture, allowing prices to come from either a built-in GBM simulator or a real-market API (Massive/Polygon.io) depending on environment configuration.

```text
┌──────────────────────────────────────────────────────┐
│            Market Data Pipeline                       │
│                                                       │
│  ┌─────────────────────┬──────────────────────────┐   │
│  │  Data Source Layer  │                          │   │
│  ├─────────────────────┤                          │   │
│  │ SimulatorDataSource │  GBM-based simulator    │   │
│  │ (default)           │  ~500ms update cycle    │   │
│  └─────────────────────┘                          │   │
│        │                                           │   │
│        │  OR                                       │   │
│        │                                           │   │
│  ┌─────────────────────┐                          │   │
│  │ MassiveDataSource   │  Polygon.io REST poller │   │
│  │ (with API key)      │  ~2-15s polling interval│   │
│  └─────────────────────┘                          │   │
│        │                                           │   │
└────────┼───────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│            PriceCache                                 │
│       (Thread-safe in-memory store)                   │
│    `backend/app/market/cache.py`                      │
│                                                       │
│    - Holds: ticker → PriceUpdate                      │
│    - Version counter for change detection              │
│    - Single writer (async task), many readers         │
└──────────────────────────────────────────────────────┘
         │
         ├──→ SSE Stream Endpoint
         │    `GET /api/stream/prices`
         │    Real-time price pushes
         │
         ├──→ Portfolio Valuation
         │    (future: trade execution)
         │
         └──→ Frontend Dashboard
              (via EventSource API)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **MarketDataSource** (ABC) | Abstract contract for price providers | `backend/app/market/interface.py` |
| **SimulatorDataSource** | GBM-based price generation with correlations | `backend/app/market/simulator.py` |
| **MassiveDataSource** | Polygon.io REST API polling | `backend/app/market/massive_client.py` |
| **PriceCache** | Thread-safe central price store, version tracking | `backend/app/market/cache.py` |
| **PriceUpdate** | Immutable price snapshot with computed deltas | `backend/app/market/models.py` |
| **SSE Stream Router** | FastAPI router factory for `/api/stream/prices` | `backend/app/market/stream.py` |
| **Factory** | Selects simulator or Massive based on env var | `backend/app/market/factory.py` |

## Pattern Overview

**Overall:** Strategy pattern with pluggable data sources

**Key Characteristics:**

- Two implementations of `MarketDataSource` ABC; selection via environment variable (`MASSIVE_API_KEY`)
- All producers write to `PriceCache`; all consumers read from it (no direct coupling)
- Shared data model: `PriceUpdate` immutable dataclass with computed fields (direction, change %, etc.)
- Background task (async) updates cache on a fixed cadence; SSE streams read cache and emit events
- Designed for future multi-user scale: all schema includes `user_id` (currently hardcoded to `"default"`)

## Layers

**Data Source Layer** (`backend/app/market/simulator.py`, `backend/app/market/massive_client.py`):

- Purpose: Generate or fetch prices on a schedule
- Location: Dual implementations per `interface.py` ABC
- Contains: GBM math + state management (simulator) OR REST polling logic (Massive)
- Depends on: `PriceCache` for writes
- Used by: FastAPI app (startup) to initialize background task

**Cache Layer** (`backend/app/market/cache.py`):

- Purpose: Central thread-safe price store; single source of truth
- Location: In-memory dictionary with lock
- Contains: `{ticker: PriceUpdate}`, version counter
- Depends on: Nothing (no imports from market submodules)
- Used by: All producers (write), all consumers (read)

**Presentation Layer** (`backend/app/market/stream.py`):

- Purpose: Expose prices to clients via SSE
- Location: FastAPI router factory
- Contains: `/api/stream/prices` SSE endpoint, async event generator
- Depends on: `PriceCache` (reads only), FastAPI
- Used by: Frontend via `EventSource` API

**Model Layer** (`backend/app/market/models.py`):

- Purpose: Immutable data structures
- Location: Dataclass definitions
- Contains: `PriceUpdate` with computed properties (direction, change, change_percent)
- Depends on: Nothing
- Used by: Everywhere

## Data Flow

### Primary Request Path: Price Streaming to Frontend

1. **Initialization** (`backend/market_data_demo.py`, line 35-45 or future FastAPI app startup):
   - Create `PriceCache()`
   - Call `create_market_data_source(cache)` → returns `SimulatorDataSource` or `MassiveDataSource`
   - Call `await source.start(["AAPL", "GOOGL", ...])` → background task begins producing updates

2. **Continuous Price Update Cycle** (every 500ms for simulator, 2-15s for Massive):
   - Data source's background task calls `cache.update(ticker, price, timestamp)`
   - Cache increments version counter, returns `PriceUpdate` object
   - Cache remains in-memory; no database writes in current implementation

3. **SSE Client Connection** (`backend/app/market/stream.py:26-46`):
   - Client sends `GET /api/stream/prices`
   - Server calls `create_stream_router(price_cache)` → returns router with closure over cache
   - Router's `stream_prices()` handler yields SSE events

4. **SSE Event Generation** (`backend/app/market/stream.py:51-88`):
   - Generator checks `request.is_disconnected()` in loop
   - Polls `price_cache.version` and `price_cache.get_all()`
   - On version change, serializes all tickers to JSON and yields `data: {...}\n\n`
   - Sends retry directive on startup (1-second reconnect delay if connection drops)
   - Yields every 500ms (~lines 85-86)

5. **Frontend Reception**:
   - JavaScript `EventSource` connected to `/api/stream/prices`
   - Parses incoming SSE events as `PriceStreamEvent` (Record<ticker, PriceUpdate>)
   - Updates local state; triggers animations on price changes

**State Management:**

- State lives in `PriceCache` only; no global variables or module-level singletons (except the anti-pattern noted below)
- Async background task writes; multiple async SSE clients read
- Thread-safe via `threading.Lock()` on cache

## Key Abstractions

**MarketDataSource ABC:**

- Purpose: Defines the contract for price producers (start, stop, add_ticker, remove_ticker, get_tickers)
- Examples: `SimulatorDataSource`, `MassiveDataSource`
- Pattern: Strategy; allows swapping implementations without changing consumer code

**PriceUpdate:**

- Purpose: Immutable snapshot of a ticker's price + derived metrics (direction, change %)
- Examples: Created by `cache.update()`, serialized to JSON for SSE/API
- Pattern: Value object / immutable data class; frozen with `@dataclass(frozen=True)`

**PriceCache:**

- Purpose: Central, thread-safe in-memory store for all active tickers
- Examples: Shared by simulator, Massive client, SSE endpoint, future trade execution
- Pattern: Observer/notification via version counter (for detecting updates without polling)

## Entry Points

**Backend Market Data Demo** (`backend/market_data_demo.py`):

- Location: `backend/market_data_demo.py:1-end`
- Triggers: Manual `uv run market_data_demo.py` (terminal demo, NOT the web app)
- Responsibilities: Instantiate cache + simulator, start background task, display live Rich dashboard for 60 seconds or until Ctrl+C

**Test Suite** (`backend/tests/market/`):

- Location: 6 test modules, 73 tests
- Triggers: `uv run pytest` or CI/CD
- Responsibilities: Unit + integration testing of all market data components (84% coverage)

**SSE Router Factory** (`backend/app/market/stream.py:20`):

- Location: `create_stream_router(price_cache) → APIRouter`
- Triggers: Called by FastAPI app startup (not yet implemented in codebase)
- Responsibilities: Returns configured router with `/api/stream/prices` endpoint; awaits host app to mount it

**Market Data Source Factory** (`backend/app/market/factory.py:16`):

- Location: `create_market_data_source(cache) → MarketDataSource`
- Triggers: Called by app startup to decide which data source to use
- Responsibilities: Inspect `MASSIVE_API_KEY` env var; return Massive client or simulator

## Architectural Constraints

- **Threading Model:** `PriceCache` uses `threading.Lock()` (not asyncio-aware). All producers and consumers are async tasks, but no `await` happens inside critical sections. Lock is held only for brief dict operations (typical hold time: <1ms).

- **Global State (Anti-Pattern):** `backend/app/market/stream.py:17` declares `router = APIRouter(...)` at module level. The factory `create_stream_router()` (line 20) decorates onto this singleton. **Calling the factory twice registers handlers twice on the same router, with the second call's `price_cache` closure shadowing the first.** See Anti-Patterns section below.

- **Single Writer:** By design, only one data source (simulator or Massive) writes to a given `PriceCache`. No race conditions between writers by construction.

- **No Persistent State:** Current implementation keeps all prices in memory. No database persistence layer yet (planned in `backend/app/db/`).

- **Market Data Cadence:** Simulator: ~500ms (hardcoded in `GBMSimulator` and `stream.py`). Massive: 2-15 seconds depending on API tier (configurable in `MassiveDataSource`).

## Anti-Patterns

### Module-Level Router Singleton

**What happens:**

```python

# stream.py:17 — module level

router = APIRouter(prefix="/api/stream", ...)

# stream.py:20-48 — factory function

def create_stream_router(price_cache):
    @router.get("/prices")  # Decorates onto the module-level singleton
    async def stream_prices(...):
        ...
    return router  # Returns the shared singleton
```

Calling `create_stream_router(cache1)` then `create_stream_router(cache2)` registers two handlers on the same router. The second call's `price_cache` closure captures `cache2`, but the first handler already closed over `cache1` — they conflict.

**Why it's wrong:**

- Violates the principle of "factory creates new instances"
- Prevents testing multiple cache instances with the same router factory
- Makes dependency injection impossible; claims to "let us inject without globals" while using a global

**Do this instead:**

```python

# stream.py:20

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    """Factory that creates a NEW router each time."""
    router = APIRouter(prefix="/api/stream", tags=["streaming"])  # Construct here
    
    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        return StreamingResponse(...)
    
    return router
```

Move the `router = APIRouter(...)` call inside the factory function.

## Error Handling

**Strategy:** 

- Data sources handle errors gracefully (timeouts, API errors) by catching and logging, then continuing the update loop
- SSE stream detects client disconnect and exits cleanly
- Cache operations are atomic (lock-protected)

**Patterns:**

- Massive client: catch `Exception` on REST call, log, skip update, retry next cycle
- Simulator: no external errors possible (pure math); always generates valid prices
- SSE: catch `asyncio.CancelledError` on stream cancellation, log, exit

## Cross-Cutting Concerns

**Logging:** 

- Each module uses `logging.getLogger(__name__)` (per-module logger)
- Key events logged: data source selection, SSE client connect/disconnect, errors in Massive polling
- No debug logging for every price update (too noisy; would spam logs)

**Validation:**

- `PriceCache.update()` rounds prices to 2 decimals
- Simulator ensures prices stay > $0 (GBM is lognormal; never negative by math)
- Massive client validates API responses (type checking, null checks)

**Concurrency:**

- All async (FastAPI tasks, background simulator task, SSE clients)
- Cache uses `threading.Lock()` for state protection
- No deadlocks: locks are always released (even on exception, via context manager)

---

*Architecture analysis: 2026-09-17*

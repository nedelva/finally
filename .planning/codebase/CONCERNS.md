---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
# Codebase Concerns

**Analysis Date:** 2026-09-17

## Tech Debt

### Dead Code: SSE Router Factory Never Instantiated

**Issue:** `create_stream_router()` (stream.py:20) and all SSE streaming infrastructure is exported but never called anywhere in production code.

**Files:** `backend/app/market/stream.py`, `backend/app/market/__init__.py`

**Impact:** The router is dead code. More critically, the entire architecture described in PLAN.md §8 ("API Endpoints") and §6 ("SSE Streaming") is not yet implemented. The market data module produces prices in-memory; nothing consumes them for portfolio valuation, trade execution, or frontend streaming. The frontend will have no live price feed.

**Fix approach:** The FastAPI application (`app.py` or `main.py`) is missing entirely from `backend/app/`. Build the app, instantiate PriceCache and create_market_data_source, start the data source on app startup, mount the SSE router, and implement all portfolio/trade/watchlist/chat endpoints specified in PLAN.md §8.

---

### Core Dependencies Include Test/Demo Tools

**Issue:** `pyproject.toml:11-12` lists `massive>=1.0.0` and `rich>=13.0.0` as core dependencies.

**Files:** `backend/pyproject.toml:11-12`

**Impact:** 

- `rich` is only used in `market_data_demo.py`, a development utility. It ships in the production Docker image unnecessarily.
- `massive` was marked optional in the original design (lazy imports for simulator-only use) but after fixing the test mocks, it became a hard import at `factory.py:10`. This means the simulator-only path now requires the Massive SDK to be installed, defeating the goal of zero-dependency operation.

**Fix approach:** 

1. Move `rich` to optional dependencies `[demo]` or test deps
2. Restore lazy imports for `massive` so it's only required when `MASSIVE_API_KEY` is set; use `TYPE_CHECKING` or runtime `try/except` on import

---

### Module-Level Router Registration

**Issue:** `stream.py:17` creates a module-level `router = APIRouter(...)`, and `create_stream_router()` decorates routes onto it via closure. If the factory function is called multiple times, the `/prices` route gets registered multiple times on the same router object.

**Files:** `backend/app/market/stream.py:17-48`

**Impact:** In tests or if app initialization is refactored, duplicate route registration could occur, causing confusing FastAPI startup errors or route conflicts.

**Fix approach:** Create the router inside the factory function, not at module level:

```python
def create_stream_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api/stream", tags=["streaming"])
    
    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        ...
    
    return router
```

---

## Known Bugs

### Version Counter Skipped on Empty Cache

**Issue:** `stream.py:76-83` reads and increments the cache version counter *before* checking if there are prices to send:

```python
current_version = price_cache.version
if current_version != last_version:
    last_version = current_version  # ← Bumped even if prices is empty
    prices = price_cache.get_all()
    if prices:  # ← Only sends if non-empty
        ...
```

**Symptoms:** If the cache briefly has 0 tickers (e.g., on startup before seed data or if watchlist is cleared), the version counter advances but no SSE event is sent. Subsequent real price updates will have the same version as the last-sent event, so clients won't re-render the stale display.

**Files:** `backend/app/market/stream.py:76-83`

**Workaround:** None from client side. The SSE connection will eventually receive a newer version when prices return.

**Trigger:** Start the app with an empty watchlist, wait for a price update, or dynamically clear and repopulate the watchlist rapidly.

---

## Performance Bottlenecks

### No SSE Keepalive Under Massive API

**Issue:** `_generate_events()` (stream.py:51-88) sends SSE data only when `price_cache.version` changes. With `MassiveDataSource` polling at `poll_interval=15.0` seconds (default for free tier, massive_client.py:32), a client with no price updates will see no SSE events for up to 15 seconds.

**Files:** `backend/app/market/massive_client.py:32`, `backend/app/market/stream.py:75-83`

**Cause:** Proxies (nginx, CloudFlare, etc.) with shorter idle timeouts (e.g., 10s) will close the connection, forcing the browser to reconnect. The default simulator runs at 500ms intervals, so this is not visible in development.

**Improvement path:** 

1. Send a heartbeat SSE comment (`:keep-alive\n\n`) on a fixed interval (e.g., every 3s) even if prices haven't changed
2. Or reduce polling interval under Massive when known (e.g., paid tier → 5s, free tier → 10s)
3. Detect connection resets in the client and add exponential backoff to reconnection attempts

---

## Test Coverage Gaps

### No SSE Stream Tests

**What's not tested:** The `_generate_events()` generator, version-based change detection, client disconnect handling, and event formatting.

**Files:** `backend/app/market/stream.py`

**Risk:** The SSE endpoint is core to the frontend experience. Without integration tests using an ASGI test client (e.g., `httpx.AsyncClient`), regressions in event delivery, malformed payloads, or disconnect handling will be caught only by E2E tests.

**Priority:** High — this is the primary consumer of PriceCache.

---

### No Concurrent Write Test for PriceCache

**What's not tested:** Thread-safe behavior under concurrent writes. `test_cache.py` exercises single-threaded updates only.

**Files:** `backend/app/market/cache.py`, `backend/tests/market/test_cache.py`

**Risk:** The `_lock` is the core contract of PriceCache (used by both SimulatorDataSource and MassiveDataSource concurrently). A test with multiple threads simultaneously calling `update()` and `get_all()` would empirically verify no data corruption or version counter races.

**Priority:** Medium — the lock implementation looks correct from inspection, but race conditions are hard to catch without tests.

---

### Incomplete Simulator Coverage

**What's not tested:** `GBMSimulator` with the full 10-ticker default watchlist. Current tests use 1-2 tickers. Cholesky decomposition and correlation matrix construction are not exercised at realistic scale.

**Files:** `backend/tests/market/test_simulator.py`, `backend/app/market/simulator.py:154-172`

**Risk:** A correlation matrix constructed from all 10 tickers with sector groupings might fail (e.g., singular matrix, Cholesky decomposition error) if correlation parameters are misconfigured. Current tests won't catch this.

**Priority:** Low — the logic is mathematically sound and the params are in place, but adding a 10-ticker test would close the gap.

---

## Fragile Areas

### Ticker Symbol Normalization Diverges Between Implementations

**Issue:** `MassiveDataSource.add_ticker()` and `remove_ticker()` normalize to uppercase and strip whitespace (massive_client.py:67, 73). `SimulatorDataSource` does not (simulator.py:242-244).

**Files:** `backend/app/market/massive_client.py:66-76`, `backend/app/market/simulator.py:242-249`

**Why fragile:** Switching data sources (simulator → Massive or vice versa) with the same ticker list could cause lookups to fail if a ticker has mixed case or whitespace. Example: user adds `"aapl"` under simulator, switches to Massive, and the ticker is silently renamed to `"AAPL"`, breaking downstream references.

**Safe modification:** Normalize tickers in the abstract `MarketDataSource.add_ticker()` and `remove_ticker()` methods, or document the contract and enforce it in both implementations. Use uppercase + strip as the standard.

**Test coverage:** `test_massive.py` and `test_simulator_source.py` don't test mixed-case or whitespace inputs.

---

### PriceCache.version Property Not Protected by Lock

**Issue:** `cache.py:64-67` reads `self._version` without holding `self._lock`:

```python
@property
def version(self) -> int:
    return self._version  # ← No lock
```

**Files:** `backend/app/market/cache.py:64-67`, `backend/app/market/stream.py:75`

**Why fragile:** On CPython with the GIL, reading a single `int` is atomic. However, this is inconsistent with the rest of the class (all other reads hold the lock). If the project ever runs on a no-GIL Python build (PEP 703, Python 3.13t+), a concurrent update could race with the read, returning a stale version.

**Safe modification:** Acquire the lock:

```python
@property
def version(self) -> int:
    with self._lock:
        return self._version
```

**Test coverage:** No concurrent access test will catch this.

---

## Security Considerations

### No Ticker Symbol Validation

**Issue:** The API accepts any ticker symbol without validation against a known whitelist or format rules.

**Files:** `backend/app/market/simulator.py:242-249`, `backend/app/market/massive_client.py:66-76`, `backend/app/market/interface.py`

**Current mitigation:** The simulator generates default prices for unknown tickers (seed_prices.py:151). Massive API will reject invalid tickers (no data returned). No injection risk because tickers are used only as dictionary keys and API parameters.

**Recommendations:** 

1. Validate ticker format (uppercase, alphanumeric, 1-5 chars) in `add_ticker()`
2. Optionally maintain a whitelist of known symbols and reject others, or permit dynamic addition but log unknown tickers
3. Sanitize ticker input in downstream trade/portfolio code before database queries

---

## Scaling Limits

### No Concurrent Client Limit on SSE

**Issue:** `stream.py:27` creates a new `_generate_events()` generator per SSE client connection with no concurrency limit.

**Files:** `backend/app/market/stream.py:27`

**Current capacity:** Each client connection is a single coroutine holding a reference to the shared `PriceCache`. Memory per client is minimal (one async task + event loop state).

**Limit:** In a single-process uvicorn with default worker count, the OS file descriptor limit and Python task limits (typically ~10k-100k depending on memory) become the constraint. With 10 default tickers and versions shared, one SSE update saturates all connected clients in a single event.

**Scaling path:**

1. Run multiple uvicorn workers behind a load balancer (no shared state issue because PriceCache is in-process)
2. Migrate to a message broker (Redis, RabbitMQ) for price updates and SSE-to-client relay, enabling horizontal scaling
3. Implement client subscription filtering so users only receive prices for tickers in their watchlist

---

## Dependencies at Risk

### Massive SDK Availability and API Stability

**Issue:** The Massive package (`massive>=1.0.0`) is a wrapper around Polygon.io. Dependency on an external package adds risk.

**Impact:** If the package is abandoned or breaks with SDK updates, the real-data path will fail. Simulator-only use works, but production deployments will be blocked.

**Migration plan:** 

1. Stabilize Polygon.io integration by calling their REST API directly (httpx) to reduce the dependency on the `massive` wrapper
2. Implement client-side retry logic and circuit breaker for API errors
3. Maintain simulator as the primary fallback

---

### Missing Environment Setup

**Issue:** `.env.example` does not exist. Users cannot set up `OPENROUTER_API_KEY` and `MASSIVE_API_KEY`.

**Files:** `.env.example` (missing)

**Impact:** Deploying the backend requires guessing environment variable names. Clear documentation is absent.

**Migration plan:** Create `.env.example` with all required and optional env vars:

```
OPENROUTER_API_KEY=your-openrouter-api-key
MASSIVE_API_KEY=
LLM_MOCK=false
```

---

## Missing Critical Features

### No FastAPI Application

**Issue:** The backend lacks the main FastAPI application. No `app.py`, `main.py`, or server entry point exists.

**Files:** `backend/app/` (missing main app file)

**Blocks:** 

- Portfolio endpoints (`/api/portfolio`, `/api/portfolio/trade`, `/api/portfolio/history`)
- Watchlist endpoints (`/api/watchlist`)
- Chat endpoint (`/api/chat`)
- Static file serving for frontend
- Database initialization and migrations
- Health check (`/api/health`)

---

### No Docker Configuration

**Issue:** No `Dockerfile`, `docker-compose.yml`, or deployment scripts exist.

**Files:** `Dockerfile`, `docker-compose.yml`, `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_windows.ps1` (all missing)

**Blocks:** 

- Building the production image (multi-stage Node + Python)
- Running the app with volume-mounted SQLite database
- One-command startup for users (`docker run ...` or shell script)
- E2E testing infrastructure

---

### Specification Mismatch: Daily Change % vs. Tick-to-Tick Change %

**Issue:** `models.py:24-28` calculates `change_percent` as the price change from the immediate previous price (one 500ms tick). PLAN.md §10 specifies "daily change %" in the watchlist display.

**Files:** `backend/app/market/models.py:24-28`, frontend spec (PLAN.md §10)

**Impact:** Frontend watchlist shows percentage swings measured in milliseconds, not intraday performance. A stock up 0.01 in 500ms shows as +0.01%, which doesn't match user expectations for a "daily change" display. Frontend charts and heatmaps will be distorted.

**Fix approach:** 

1. Store `session_open_price` in the cache alongside current price
2. Calculate `change_percent` and `change` from session open (or prior close if after-hours)
3. Recompute on market open/close events or define "session" as a calendar day

---

### Stale Seed Prices

**Issue:** `seed_prices.py:3-15` comment states "as of project creation" with historical prices (NVDA 800, MSFT 420). These are outdated as of 2026-09-17.

**Files:** `backend/app/market/seed_prices.py:1-15`

**Impact:** Simulator starts with prices far from current reality, making the demo less credible. Real-world usage with Massive API will work correctly (live data), but simulator-only deployments will show stale seeds.

**Fix approach:** Update seed prices to current market values or derive them from a live API call on first startup (graceful fallback to hardcoded if unavailable).

---

## Recommendations for Next Phase

1. **Build the FastAPI app** — instantiate PriceCache, market data source, mount SSE router, implement all §8 endpoints
2. **Fix thread-safety**: Add lock to `PriceCache.version` property, add concurrent write test
3. **Refactor stream router**: Move router instantiation into the factory function
4. **Add SSE integration tests**: Use `httpx.AsyncClient` to test event delivery, disconnects, keepalive
5. **Normalize tickers**: Enforce uppercase + trim in abstract interface, add validation test
6. **Restore lazy imports**: Make `massive` optional by restoring lazy/TYPE_CHECKING imports
7. **Create `.env.example`** and deployment infrastructure (Dockerfile, scripts)
8. **Fix change_percent calculation**: Use session-open or prior-close anchor, not tick-to-tick
9. **Update seed prices** to realistic current values

---

*Concerns audit: 2026-09-17*

---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
# External Integrations

**Analysis Date:** 2026-09-17

## APIs & External Services

**Market Data:**

- Massive API (Polygon.io wrapper) - Real-time US stock price snapshots
  - SDK/Client: `massive` package (2.2.0)
  - Auth: `MASSIVE_API_KEY` environment variable
  - Endpoint: `GET /v2/snapshot/locale/us/markets/stocks/tickers`
  - Rate limits: Free tier 5 req/min (polls every 15s), paid tiers configurable (2-5s)
  - Implementation: `app/market/massive_client.py` → `MassiveDataSource` class
  - Fallback: If `MASSIVE_API_KEY` not set or empty, uses built-in GBM simulator instead

## Data Storage

**Databases:**

- Not yet implemented (schema/implementation is aspirational in PLAN.md)
- Future: SQLite at `db/finally.db` (mentioned but not integrated)

**File Storage:**

- Local filesystem only - no cloud storage integration
- Volume mount for persistence: `db/` directory (Docker-ready)

**Caching:**

- In-memory price cache (no external cache)
- `PriceCache` class in `app/market/cache.py` - thread-safe dictionary
- Updated by market data source (simulator or Massive), read by SSE stream

## Authentication & Identity

**Auth Provider:**

- Not yet implemented (mentioned in PLAN.md)
- Future: Single hardcoded user (no multi-user support currently)

## Monitoring & Observability

**Error Tracking:**

- None detected
- Uses Python `logging` module for warnings/errors
- Massive client logs API failures to stderr, continues polling

**Logs:**

- Python standard `logging` library
- Loggers: `app.market.factory`, `app.market.massive_client`, `app.market.simulator`, `app.market.stream`
- Levels: INFO (initialization, polling), DEBUG (price updates), WARNING (API failures), ERROR (fatal failures)

## CI/CD & Deployment

**Hosting:**

- Not yet deployed (local development only)
- Designed for: Docker container, single port 8000
- Stateless FastAPI + shared in-memory price cache

**CI Pipeline:**

- Not configured (no GitHub Actions detected)
- Testing: Run locally via `uv run --extra dev pytest`

## Environment Configuration

**Required env vars:**

- None (all optional for fallback behavior)

**Optional env vars:**

- `MASSIVE_API_KEY` - Polygon.io API key for real market data
  - If set: uses MassiveDataSource (REST API polling)
  - If empty/unset: uses SimulatorDataSource (GBM simulation)
  - Used in: `app/market/factory.py` → `create_market_data_source()`

**Secrets location:**

- `.env` file in project root (gitignored)
- `.env.example` should document required/optional vars (not yet present)

## Webhooks & Callbacks

**Incoming:**

- None detected

**Outgoing:**

- None detected (data flows: Massive API → PriceCache → SSE stream only)

## Real-Time Communication

**SSE Streaming:**

- Endpoint: `GET /api/stream/prices`
- Protocol: Server-Sent Events (text/event-stream)
- Data format: JSON objects with ticker price updates
- Cadence: ~500ms (matches market simulator tick rate)
- Implementation: `app/market/stream.py` → `create_stream_router()`
- Auto-reconnect: EventSource browser API handles retry (1s default)
- No bidirectional channel (server→client only)

---

*Integration audit: 2026-09-17*

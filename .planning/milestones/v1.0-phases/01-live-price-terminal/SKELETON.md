# Walking Skeleton — FinAlly (AI Trading Workstation)

**Phase:** 1
**Generated:** 2026-09-17

## Capability Proven End-to-End

A user opens `http://localhost:8000` in a browser and watches the ten default tickers stream live prices — served by a single process that runs the market-data engine, pushes it over SSE, and serves the compiled frontend from the same origin and port.

This is the Phase-1 special case of a tracer slice: the thinnest path that touches every layer the application will ever have, wired for keeps. The spine it proves is **market-data engine → `PriceCache` → FastAPI → SSE → single-origin static serving → browser render**. Every later phase adds a slice on top of this spine without altering it.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | FastAPI 0.128.7 on uvicorn, managed by uv | Fixed by `planning/PLAN.md` §3. `backend/app/market/` was already written against it (73 passing tests) but had never been mounted — Phase 1 supplies the missing entrypoint. |
| ASGI entrypoint | `app.main:app`, built by a `create_app()` factory | RESEARCH.md Open Question 1 resolved in favour of `main.py` over `server.py` (common FastAPI convention, matches STRUCTURE.md's first guess). The factory exists so tests can build isolated app instances with a controlled static directory. Phase 5's container `CMD` binds to this exact string. |
| Resource lifecycle | `lifespan` async context manager owning `PriceCache` + `create_market_data_source` | `MarketDataSource` documents an explicit start/stop contract (`interface.py`). The `on_event` decorators have been deprecated since long before the pinned FastAPI version. Shutdown is guaranteed, unlike a bare background task. |
| Real-time transport | Server-Sent Events via the existing hand-written `StreamingResponse` | Fixed by `planning/PLAN.md` §3 — one-way push is all this app needs. Note: `fastapi.sse.EventSourceResponse` appears in the live FastAPI docs but does **not** exist in the installed 0.128.7 (RESEARCH.md Pitfall 5) — do not build against it. |
| Frontend framework | Next.js 16.3.5 App Router, static export (`output: 'export'`) | Fixed by `planning/PLAN.md` §3/§10. All configuration was authored in Phase 1 to match the dependency tree already resolved in `frontend/node_modules`; versions are pinned exactly, with no caret ranges. |
| Styling | Tailwind CSS 4.3.3, CSS-first `@theme` config in `app/globals.css` | v4 is CSS-config-first; a `tailwind.config.js` is silently ignored unless explicitly wired via `@config`. Theme tokens and the two price-flash keyframes live in `globals.css`. |
| Charting | Recharts 3.10.1 (SVG) | `planning/PLAN.md` §10 permits Lightweight Charts or Recharts; only Recharts is pre-installed, and it is adequate at 10 tickers × 500ms. Components take optional explicit width/height so they render under jsdom. |
| Stream client | Exactly **one** `EventSource` for the whole app, behind `PriceStreamProvider` | One SSE event carries all ten tickers in a single payload (`stream.py:81`). Per-row connections would deliver ten duplicate copies and burn same-origin connection budget. No component below the provider may open a connection. |
| Client-side history | In-memory ring buffer per ticker, capped at `PRICE_HISTORY_LIMIT` (120 points) | Phase 1 has no history endpoint and no database, so sparkline and chart data is accumulated purely from the stream since page load and is lost on refresh — by design, per `planning/PLAN.md` §2. |
| Reconnection | Native `EventSource` retry, driven by the server's `retry: 1000` directive | Browsers implement this per spec. The client only *tracks* `readyState`/`onopen`/`onerror` to drive the status dot; no backoff loop is hand-written. |
| Static serving | `StaticFiles(directory=..., html=True)` mounted at `/` **last** | Single container, single port (`planning/PLAN.md` §3). Starlette resolves routes in registration order, so a root mount must be registered after every API router or it swallows them. Starlette's own path normalisation is the traversal defence — no manual file-serving route. |
| Static directory resolution | `FINALLY_STATIC_DIR` env var → `backend/static/` → `<repo>/frontend/out/` → skip the mount with a warning | The explicit escape hatch first; `backend/static/` is the container layout `planning/PLAN.md` §11 describes; `frontend/out/` is the dev-checkout fallback so no copy step is needed locally. Skipping (rather than crashing) when absent keeps backend-only test runs and fresh clones bootable. **Phase 5's Dockerfile `COPY` destination binds to this order** — rated `costly` to change, not one-way. |
| Directory layout | `backend/app/` (flat modules + `market/` package, barrel-file imports), `frontend/app/` + `frontend/components/` + `frontend/lib/` | Extends what already exists. CONVENTIONS.md requires importing from `app.market`, never `app.market.cache`. Frontend hooks and shared types stay in `frontend/lib/`; presentational components in `frontend/components/`. |
| Auth | None, anywhere, ever | Single user, hardcoded `user_id="default"` — `planning/PLAN.md` §7, restated in REQUIREMENTS.md § Out of Scope. There is no session, no access boundary, and no login surface in any phase. |
| Deployment target | Single container on port 8000 (built in Phase 5); local full-stack run documented below | `planning/PLAN.md` §3/§11. Phase 1 deliberately exercises the production single-port serving path so every later phase develops against it. |

## Stack Touched in Phase 1

- [x] **Project scaffold** — `frontend/package.json`, `next.config.js`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts` all authored from scratch (none existed); backend already had `pyproject.toml` + `uv.lock`, extended with the `httpx` dev dependency and a pytest marker
- [x] **Routing** — `GET /api/health`, `GET /api/stream/prices` (SSE), and the `StaticFiles` mount at `/`; client-side the app is a single route
- [ ] **Database — deferred to Phase 2, see ROADMAP.md.** Phase 1 has no persistence of any kind. The full `planning/PLAN.md` §7 schema (`users_profile`, `watchlist`, `positions`, `trades`, `portfolio_snapshots`, `chat_messages`) is created in one pass in Phase 2, a boundary the roadmap set deliberately to avoid a second schema migration later. Touching a database here would cross that boundary for no gain — Phase 1's ticker list is a server-side constant (`DEFAULT_TICKERS`) and its price history is a client-side buffer.
- [x] **UI wired to the backend** — the watchlist grid, sparklines, main chart, and connection dot all render from one live `EventSource` against `/api/stream/prices`; clicking a row drives the main chart
- [x] **Deployment — documented local full-stack run command**, identical to what the tracer's automated verify executes:
  ```
  npm --prefix frontend run build
  uv run --directory backend --extra dev uvicorn app.main:app --port 8000
  # open http://localhost:8000
  ```

## Out of Scope (Deferred to Later Slices)

Explicitly not in the skeleton. This list exists so no later phase re-litigates Phase 1's minimalism:

- **All persistence** — SQLite, lazy initialisation, the six-table schema, and seed data (Phase 2)
- **User control of the watchlist** — add and remove tickers, and ticker-format validation/normalisation (Phase 2, WTCH-01/WTCH-02). Phase 1's ten tickers come from the `DEFAULT_TICKERS` constant.
- **Cash balance and portfolio total in the header** — `planning/PLAN.md` §10 lists both, and they are deliberately absent rather than stubbed with a fixed figure (Phase 3, PORT-01)
- **Trading** — the trade bar, market orders, instant fill, positions table, heatmap, P&L chart, and portfolio snapshots (Phase 3)
- **The AI copilot** — chat panel, `POST /api/chat`, LiteLLM/OpenRouter/Cerebras integration, structured outputs, and `LLM_MOCK` (Phase 4)
- **Docker packaging and delivery** — the multi-stage `Dockerfile`, start/stop scripts, named volume, `.env.example`, and the Playwright E2E suite (Phase 5)
- **Server-side price history** — no history endpoint exists; sparkline and chart data is client-only and resets on refresh
- **SSE connection limits** — CONCERNS.md records "No Concurrent Client Limit on SSE" as a knowingly deferred scaling limit for a single-user demo
- **Deferred CONCERNS.md items not assigned to Phase 1** — locking `PriceCache.version`, refreshing the stale seed prices, moving `rich` out of core dependencies, and restoring the lazy `massive` import (the last two are Phase 5 per ROADMAP.md)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Persistent Watchlist:** SQLite with lazy init and the full schema; `GET`/`POST`/`DELETE /api/watchlist`; the Phase 1 hardcoded ticker list is *swapped* for the database-backed one, and watchlist mutations propagate into the running data source via `add_ticker`/`remove_ticker`. The watchlist panel is modified, not rebuilt.
- **Phase 3 — Trading & Portfolio:** `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history`; fill prices read from the same `PriceCache` this skeleton proved; positions table, heatmap, and P&L chart reuse the same Recharts choice and the same stream context for live revaluation. The header's cash and total-value slots are filled here.
- **Phase 4 — AI Copilot:** `POST /api/chat` grounded in the Phase 3 portfolio and the Phase 2 watchlist, reusing the Phase 3 validation path for AI-initiated trades — no second, looser execution route.
- **Phase 5 — One-Command Delivery:** the multi-stage image whose `COPY` destination and `CMD` bind to this skeleton's static-directory resolution order and `app.main:app` entrypoint; idempotent start/stop scripts; the named volume; and the Playwright E2E suite, which owns the true SSE disconnect-and-reconnect scenario that Phase 1 verifies by hand.

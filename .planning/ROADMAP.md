# Roadmap: FinAlly

## Overview

FinAlly starts from a solid but unwired market-data subsystem: a pluggable simulator/Massive price source, a thread-safe `PriceCache`, and an SSE router factory that no FastAPI app has ever mounted. The journey is to turn that dormant engine into the full AI trading workstation described in `planning/PLAN.md`, one user-visible vertical slice at a time. First we stand up the app and make prices visible in a real browser terminal (Phase 1). Then we give the terminal a memory — SQLite plus a watchlist the user actually controls (Phase 2). Then the point of the whole thing: buying, selling, and watching a $10k portfolio move (Phase 3). Then the copilot that can see the portfolio and act on it in natural language (Phase 4). Finally we wrap it in the single `docker run` that makes it a product someone else can start (Phase 5). Known market-data defects from `.planning/codebase/CONCERNS.md` are repaired inside the phase that touches them, never as a standalone cleanup pass.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Live Price Terminal** - Stand up the FastAPI app, mount the existing SSE stream, and serve a dark terminal UI where 10 default tickers stream live (completed 2026-09-18)
- [x] **Phase 2: Persistent Watchlist** - SQLite with lazy init and seed data, plus a watchlist the user can add to, remove from, and reload (completed 2026-09-19)
- [x] **Phase 3: Trading & Portfolio** - Instant-fill market orders against live prices, with positions table, heatmap, P&L chart, and live cash (completed 2026-09-20)
- [x] **Phase 4: AI Copilot** - Chat assistant grounded in the real portfolio that executes trades and watchlist changes on request (completed 2026-09-22)
- [ ] **Phase 5: One-Command Delivery** - Multi-stage Docker image, start/stop scripts, persistent volume, and the Playwright E2E suite

## Phase Details

### Phase 1: Live Price Terminal

**Goal**: The user opens `http://localhost:8000` and watches the 10 default tickers stream live prices in a dark, Bloomberg-style terminal — making the already-built market-data engine visible for the first time
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05
**Success Criteria** (what must be TRUE):

  1. User loads the app at `http://localhost:8000` and sees a watchlist grid of the 10 default tickers whose prices update continuously without any manual refresh
  2. A ticker's price flashes green on an uptick and red on a downtick, fading back to normal within roughly half a second
  3. Each watchlist row carries a sparkline that fills in progressively as prices arrive after load
  4. Clicking a ticker in the watchlist draws a larger price chart for that ticker in the main chart area
  5. The header shows a connection dot that is green while streaming, changes colour when the stream drops, and returns to green by itself once the browser reconnects

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Repair the `.gitignore` rule blocking `frontend/lib/`, author the missing Next.js scaffold, and stand up the Vitest harness

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — TRACER / Walking Skeleton: FastAPI entrypoint, lifespan-managed market data, SSE, single-port static serving, and one shared browser stream

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Backend hardening: the four CONCERNS.md repairs plus the first SSE integration tests
- [x] 01-04-PLAN.md — Watchlist grid with price-flash animation and progressively-filling sparklines

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Header connection dot, click-driven main chart, and end-of-phase browser verification

**UI hint**: yes

**Scope notes** (work with no REQ ID that must land here):

- Create the missing FastAPI entrypoint (`app = FastAPI()`) with a lifespan that builds the `PriceCache`, calls `create_market_data_source`, starts the background task on startup and stops it on shutdown; add `GET /api/health`.
- Serve the Next.js static export from FastAPI via `StaticFiles` — the same single-origin, single-port mechanism Phase 5 will package, so every later phase exercises the production serving path.
- Ticker list for this phase comes from the market module's default seed list; Phase 2 replaces it with the database-backed watchlist.
- CONCERNS.md repairs due here: (a) move `APIRouter(...)` construction inside `create_stream_router()` to kill the module-level singleton; (b) fix the version counter being advanced on an empty cache in `stream.py`, which can suppress later SSE events; (c) re-anchor `PriceUpdate.change` / `change_percent` to a session-open price instead of the previous 500ms tick, so the watchlist shows a daily-style percentage per PLAN.md §10 rather than millisecond noise; (d) add an SSE keepalive comment so slow Massive polling does not idle the connection out.
- Add the missing SSE integration tests (ASGI client): event delivery, version-change detection, client disconnect.

### Phase 2: Persistent Watchlist

**Goal**: The user controls which tickers they watch, and that choice — along with the rest of the app's state — now lives in a real SQLite database instead of memory
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: WTCH-01, WTCH-02
**Success Criteria** (what must be TRUE):

  1. User adds a ticker (e.g. PYPL) through the watchlist control and it appears in the grid and starts streaming prices within seconds
  2. User removes a ticker and it disappears from the grid and stops receiving updates
  3. Reloading the browser shows the user's own watchlist, not the built-in default list
  4. A malformed or empty ticker entry is rejected with a visible message and leaves the watchlist unchanged

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — TRACER: SQLite lazy init with the full PLAN.md §7 schema, `GET /api/watchlist`, a database-driven app lifespan, and a REST-driven watchlist grid

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Add a ticker: `POST /api/watchlist` with format validation, the shared ticker-normalization repair across both data sources, and the add-ticker form

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Remove a ticker: `DELETE /api/watchlist/{ticker}`, the per-row remove affordance, the empty state, and the main-chart selection guard

**Wave 4** *(gap closure — blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Fix watchlist load-state indistinguishability: loading/load-error/empty render precedence in `Watchlist.tsx` (closes UAT gaps G-02-1, G-02-3)

**Wave 5** *(gap closure — blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Fix remove-button hit area/affordance and watchlist-panel scroll/chart-height coupling (closes UAT gaps G-02-4, G-02-5)

**UI hint**: yes

**Scope notes** (work with no REQ ID that must land here):

- Lazy database initialization on first request per PLAN.md §7: create `db/finally.db` if absent and build the full schema — `users_profile`, `watchlist`, `positions`, `trades`, `portfolio_snapshots`, `chat_messages` — all carrying `user_id` defaulting to `"default"`. Seed one profile with `cash_balance=10000.0` and the ten default tickers. The later tables are created here even though Phases 3-4 are the first to write to them; that avoids a second schema pass.
- Implement `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/{ticker}`.
- Swap the Phase 1 hardcoded ticker list for `GET /api/watchlist` — the watchlist panel is modified, not rebuilt.
- Watchlist mutations must propagate to the running data source via `add_ticker` / `remove_ticker` so new tickers stream immediately.
- CONCERNS.md repair due here: normalize tickers (uppercase + strip) in the `MarketDataSource` contract so simulator and Massive agree, and validate ticker format (1-5 alphanumeric characters) before it reaches the database.
- Cash balance display stays out of this phase — it belongs to PORT-01 in Phase 3.

### Phase 3: Trading & Portfolio

**Goal**: The user can buy and sell shares at the live streaming price and watch a $10,000 portfolio respond — cash, holdings, P&L, weight, and value over time
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06
**Success Criteria** (what must be TRUE):

  1. Header shows $10,000 cash on a fresh database, and total portfolio value moves live as streamed prices change
  2. User enters a ticker and quantity in the trade bar and buys: the order fills instantly at the current price with no confirmation dialog, cash drops by exactly the fill amount, and the position appears
  3. User sells: cash rises, the position shrinks or disappears, and an attempt to sell more shares than owned or buy beyond available cash is refused with a visible error and no change to cash or positions
  4. Positions table shows ticker, quantity, average cost, current price, unrealized P&L, and % change for every holding, with price-driven values updating live
  5. Portfolio heatmap sizes each position by weight and colours it green for profit or red for loss, and the P&L chart shows total portfolio value over time, gaining new points as time passes and immediately after each trade

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — TRACER: trade engine (`execute_trade` + `GET /api/portfolio` + `POST /api/portfolio/trade`) and the trade bar, buy and sell end to end

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Header cash balance and live total portfolio value, plus `useLiveTotalValue` and the D-03 fallback under test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Positions table and portfolio heatmap, with click-to-select tiles and the neutral-colour fallback treatment

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — 30-second snapshot writer, `GET /api/portfolio/history`, and the P&L chart

**UI hint**: yes

**Scope notes** (work with no REQ ID that must land here):

- Implement `GET /api/portfolio` (positions, cash, total value, unrealized P&L), `POST /api/portfolio/trade` (`{ticker, quantity, side}`, market order, instant fill, fractional shares, validated against cash and holdings), and `GET /api/portfolio/history`.
- Trade execution reads the fill price from `PriceCache`, writes an append-only `trades` row, and upserts the `positions` row with recomputed average cost.
- Background task writes a `portfolio_snapshots` row every 30 seconds and immediately after each executed trade — both the periodic and the post-trade path are required for PORT-06 to look right.
- This is the heaviest phase; expect `/gsd-plan-phase` to split it into several plans rather than splitting the phase (a presentation-only slice would break the vertical-MVP rule).

### Phase 4: AI Copilot

**Goal**: The user talks to FinAlly in natural language and it answers from their actual portfolio and acts on it — placing trades and editing the watchlist without leaving the conversation
**Depends on**: Phase 3
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):

  1. User sends a message in the chat panel, sees a loading indicator, and receives a conversational reply that references their real cash, holdings, P&L, and current watchlist prices
  2. Asking the assistant to buy or sell executes the trade with no approval step; a confirmation appears inline in the conversation and cash and positions update to match
  3. Asking the assistant to add or remove a ticker changes the watchlist, with the change confirmed inline in the conversation
  4. A request the portfolio cannot support (buying beyond available cash, selling shares not held) produces a conversational explanation of the failure and leaves cash, positions, and watchlist untouched
  5. Reloading the browser restores the prior conversation history

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — TRACER: `POST /api/chat` grounded in the real portfolio, the `app/llm` package behind it, chat-message persistence, and the docked AI Copilot panel

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Action dispatch: watchlist changes then trades, per-action executed/failed reporting, the D-01/D-02 held-position removal guard, and inline confirmation pills

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — `GET /api/chat/history` and panel rehydration so a browser reload restores the conversation

**UI hint**: yes

**Scope notes** (work with no REQ ID that must land here):

- Implement `POST /api/chat`: load portfolio context + watchlist with live prices + recent `chat_messages`, call the model, auto-execute returned actions, persist the exchange, return one complete JSON response (no token streaming).
- LLM access follows the project's `cerebras` skill exactly: LiteLLM `completion` against `openrouter/openai/gpt-oss-120b` with `extra_body={"provider": {"order": ["cerebras"]}}`, structured outputs validated through a Pydantic model matching PLAN.md §9 (`message`, `trades[]`, `watchlist_changes[]`). Requires `litellm` and `pydantic` added to the uv project and `OPENROUTER_API_KEY` loaded from `.env`.
- AI-initiated trades reuse the exact Phase 3 validation path — no second, looser execution route.
- `LLM_MOCK=true` returns deterministic mock responses covering the reply, trade, watchlist-change, and validation-failure cases; Phase 5's E2E suite depends on this existing.
- Malformed or non-conforming model output must degrade into a readable assistant message rather than a 500.

### Phase 5: One-Command Delivery

**Goal**: Someone who has never seen the repo runs one command and gets the whole workstation on port 8000, with their portfolio and history still there after a restart
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: OPS-01, OPS-02
**Success Criteria** (what must be TRUE):

  1. From a clean checkout with a `.env`, the operator runs the provided start script (or the documented `docker run`) and reaches the complete, working application at `http://localhost:8000`
  2. Trades, watchlist edits, and chat history made before stopping the container are all still present after starting it again
  3. Start and stop scripts are safe to run repeatedly — no duplicate containers, no error on a second stop, and stopping never destroys the data volume
  4. The application runs correctly with only `OPENROUTER_API_KEY` set, falling back to the built-in simulator because no Massive key is present

**Plans**: 1/5 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — TRACER: `.dockerignore`, the two-stage `Dockerfile` with build-time path-arithmetic assertions, non-root runtime, and `.env.example` — one `docker run` reaches the working app on port 8000

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-03-PLAN.md — Dependency hygiene: `rich` demoted to a `demo` extra with a re-lock, and the Polygon SDK lazy-imported with its mandatory `test_massive.py` companion fix
- [ ] 05-04-PLAN.md — E2E harness: package-legitimacy gate, `test/` manifest + committed lockfile + sequential Playwright config, the compose harness, and the fresh-start spec proving the gate fails honestly

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 05-02-PLAN.md — Operator lifecycle: four idempotent start/stop scripts, `docker-compose.yml`, README launch paths, and the restart-persistence proof
- [ ] 05-05-PLAN.md — Remaining E2E scenarios: watchlist, trading, portfolio visuals, mocked chat, and SSE reconnect

**Scope notes** (work with no REQ ID that must land here):

- Multi-stage `Dockerfile` per PLAN.md §11: Node 20 builds the frontend static export, Python 3.12 + uv installs the backend from the lockfile and receives the built assets; single uvicorn process on port 8000.
- `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`, all idempotent; named volume mounted at `/app/db`; optional `docker-compose.yml` convenience wrapper.
- Commit `.env.example` (`OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`) — currently missing entirely.
- Playwright E2E suite in `test/` with `docker-compose.test.yml`, run against the container with `LLM_MOCK=true`, covering the PLAN.md §12 scenarios: fresh start with streaming prices and $10k, watchlist add/remove, buy, sell, portfolio visuals, mocked chat with inline trade execution, and SSE reconnect.
- Dependency hygiene from CONCERNS.md so the shipped image is honest: move `rich` out of core dependencies (demo-only) and restore the lazy `massive` import so the simulator path does not require the Polygon SDK.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Live Price Terminal | 5/5 | Complete    | 2026-09-18 |
| 2. Persistent Watchlist | 5/5 | Complete    | 2026-09-19 |
| 3. Trading & Portfolio | 4/4 | Complete    | 2026-09-20 |
| 4. AI Copilot | 3/3 | Complete    | 2026-09-22 |
| 5. One-Command Delivery | 1/5 | In Progress|  |

---
*Roadmap created: 2026-09-17*

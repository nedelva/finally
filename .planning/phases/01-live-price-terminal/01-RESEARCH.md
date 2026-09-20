# Phase 1: Live Price Terminal - Research

**Researched:** 2026-09-17
**Domain:** FastAPI app assembly + SSE streaming fixes (backend) / Next.js static-export terminal UI bootstrap (frontend)
**Confidence:** HIGH (backend — verified against installed packages and existing source); MEDIUM (frontend — verified installed versions, but no frontend code exists yet to ground patterns against)

## Summary

Phase 1 has two halves that must land together: (1) wire the already-built, already-tested market-data engine into a real FastAPI app for the first time, fixing four known defects along the way, and (2) build the Next.js frontend completely from scratch — there is no `package.json`, `next.config.js`, or `tsconfig.json` in `frontend/` today (all three were deliberately deleted in the "Basic starting point" commit). Both halves have a head start: `backend/app/market/` is 100%-implemented and 84%-covered, and `frontend/node_modules/` already contains a fully resolved dependency tree (Next 16.3.5, React 19.2.8, TypeScript 5.9.3, Tailwind CSS 4.3.3, Recharts 3.10.1, Vitest 5.0.1 + Testing Library) — someone ran the installs before the config files were stripped out. `frontend/lib/` also already contains typed API client, hooks, and a price-flash hook that assume conventions (a `ConnectionStatus` union type, an `ApiResult<T>` fetch wrapper) the new components must follow, not reinvent.

The backend's core risk is in the details PLAN.md glosses over: the SSE router is a module-level singleton (breaks on a second `create_stream_router()` call, e.g. in tests), the cache's version counter advances even when the cache is empty (can permanently desync a client), and `PriceUpdate.change_percent` is computed tick-to-tick (over a ~8.5e-8-year `dt`) rather than from a session anchor, which doesn't match PLAN.md §10's "daily change %" watchlist display. All three are fixable with small, well-scoped changes documented below. A `fastapi.frontend()` convenience method appears throughout the *live* fastapi.tiangolo.com docs (scraped via Context7) but does **not exist** in the pinned/installed `fastapi==0.128.7` — verified directly against the installed package. Use the standard `StaticFiles(directory=..., html=True)` mount instead; do not follow that doc snippet.

The frontend's core risk is architectural: 10 tickers stream inside **one** SSE payload per tick, so there must be exactly **one** `EventSource` connection for the whole app (via a context provider), not one per watchlist row or per chart. Sparkline/chart data (PLAN.md's "accumulated from SSE since page load") has no backend-side history endpoint in Phase 1 — it is purely a client-side ring buffer built from the stream, and disappears on refresh (by design; Phase 1 has no database).

**Primary recommendation:** Build `backend/app/main.py` with a `lifespan` that owns `PriceCache` + `create_market_data_source` + a `DEFAULT_TICKERS` constant; fix the three market-module defects in place; and bootstrap the frontend by writing `package.json`/`next.config.js`/`tsconfig.json` to match the versions already sitting in `node_modules` (run `npm install` afterward only to regenerate the lockfile — do not let it re-resolve different versions).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GBM price generation | API / Backend | — | `backend/app/market/simulator.py`, pure in-process compute, already built |
| Price caching + version counter | API / Backend | — | `PriceCache` is the single source of truth all readers poll; must stay in-process for Phase 1 (no DB yet) |
| SSE push (`/api/stream/prices`) | API / Backend | — | `create_stream_router()`; owns the "when do I have new data" decision |
| Default ticker list | API / Backend | — | Phase 1: hardcoded constant in the market module; Phase 2 replaces with DB-backed watchlist (explicitly deferred per ROADMAP.md) |
| Static asset serving (Next export) | API / Backend | — | Single-container, single-port design (PLAN.md §3) — FastAPI `StaticFiles`, no separate CDN tier exists in this project |
| SSE consumption + reconnection status | Browser / Client | — | Native `EventSource`; must be a single shared connection, not per-component |
| Price-flash animation | Browser / Client | — | CSS transition classes driven by `usePriceFlash` (already scaffolded) |
| Sparkline / main-chart history accumulation | Browser / Client | — | No backend history endpoint exists in Phase 1 — client holds a capped ring buffer per ticker in memory only |
| Connection-status dot | Browser / Client | — | Derived from the shared `EventSource`'s `readyState` + `onopen`/`onerror` events |

## Standard Stack

### Core (Backend)

| Library | Version (installed/verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.128.7 [VERIFIED: backend/.venv inspection this session] | Web framework, SSE via `StreamingResponse`, lifespan | Already the project's framework (STACK.md), no alternative considered |
| uvicorn[standard] | 0.40.0 [VERIFIED: backend/.venv inspection this session] | ASGI server | Already in use; `[standard]` extra pulls in `python-dotenv`, `uvloop`, `httptools`, `watchfiles` transitively |
| httpx | 0.28.1 [VERIFIED: backend/.venv inspection this session — present but **not** in `uv.lock`] | ASGI test client for the new SSE integration tests | Official async HTTP client from the Encode org (same as Starlette/Uvicorn); required for the phase's mandated SSE tests |

### Supporting (Backend)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | 2.4.2 [VERIFIED: STACK.md + .venv] | GBM math, already a dependency | No change needed this phase |

### Core (Frontend — none of this exists on disk yet; versions below are what's already resolved in `node_modules`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.5 [VERIFIED: npm registry `npm view next version` + already installed in `frontend/node_modules`] | App Router, static export (`output: 'export'`) | Matches PLAN.md §3/§10 requirement for a static export; already the version resolved in this project's `node_modules` |
| react / react-dom | 19.2.8 [VERIFIED: npm registry + node_modules] | UI runtime | Required peer of Next 16 (`^18.2.0 \|\| ^19.0.0` per installed `next/package.json` peerDependencies) |
| typescript | 5.9.3 [VERIFIED: npm registry + node_modules] | Type checking | Project requires TS per PLAN.md §10; pinned below npm's `latest` (7.0.2) — do not bump without testing, TS 7 is a recent major |
| tailwindcss | 4.3.3 [VERIFIED: npm registry + node_modules] | Dark theme styling | PLAN.md §10 mandates Tailwind; v4 uses CSS-first config (no `tailwind.config.js`), see Architecture Patterns |
| @tailwindcss/postcss | 4.3.3 [VERIFIED: node_modules] | PostCSS plugin for Tailwind v4 | Required companion package for v4's PostCSS integration |
| recharts | 3.10.1 [VERIFIED: npm registry + node_modules] | Sparklines + main chart | PLAN.md §10 says "Lightweight Charts or Recharts" — **only Recharts is pre-installed**; `lightweight-charts` is absent from `node_modules`. Use Recharts to avoid an extra install and dependency-resolution risk. |

### Supporting (Frontend)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| eslint / eslint-config-next | 9.39.5 / 16.3.5 [VERIFIED: node_modules] | Linting | Matches Next 16's flat-config ESLint setup |
| postcss | 8.5.28 [VERIFIED: node_modules] | Required by Tailwind v4 PostCSS plugin | — |
| @types/react, @types/react-dom, @types/node | 19.3.0 / 19.3.0 / 22.20.3 [VERIFIED: node_modules] | TypeScript types | — |
| vitest | 5.0.1 [VERIFIED: node_modules] | Unit test runner (per PLAN.md §12) | Config file doesn't exist yet — see Validation Architecture |
| jsdom | 30.1.0 [VERIFIED: node_modules] | DOM environment for Vitest | — |
| @testing-library/react, @testing-library/jest-dom, @testing-library/user-event | 16.3.3 / 7.0.1 / 14.6.7 [VERIFIED: node_modules] | Component testing | — |
| @vitejs/plugin-react | 6.1.1 [VERIFIED: node_modules] | Vitest/Vite React transform | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts for sparklines/chart | lightweight-charts | PLAN.md names both; lightweight-charts is a canvas-based, finance-purpose-built library with better perf at high tick rates, but it is not installed and would require a fresh `npm install` with unverified version pinning. Recharts (SVG-based) is adequate at 10 tickers × 500ms and is already resolved. |
| Manual reconnect/backoff logic for SSE | Native `EventSource` retry | `EventSource` already retries automatically using the server's `retry: 1000` directive (see `stream.py:62`); don't hand-roll a backoff loop — only track/display status. |
| `tailwind.config.js` (v3-style) | Tailwind v4 CSS-first config | v3-style config files are not part of the resolved v4.3.3 toolchain; v4 configures via `@import "tailwindcss"` + `@theme` in CSS. Writing a `tailwind.config.js` would be silently ignored unless `@config` is used. |

**Installation:**
```bash
# Backend — add the missing test dependency (httpx is installed but absent from uv.lock)
cd backend && uv add --dev httpx

# Frontend — package.json/next.config.js/tsconfig.json must be authored first (see Code Examples),
# THEN run npm install to regenerate package-lock.json against the already-resolved node_modules.
cd frontend && npm install
```

**Version verification:** All frontend versions above were confirmed two ways: (1) already present in `frontend/node_modules/*/package.json` on disk, and (2) `npm view <pkg> version` against the live registry returning the same or a newer value (network `npm view` calls were run this session — `npm view next version` → `16.3.5`; `npm view tailwindcss version` → `4.3.3`; `npm view recharts version` → `3.10.1`; `npm view typescript version` → `7.0.2` latest, confirming `5.9.3` is an intentionally older pin, not stale/wrong). Backend versions confirmed via direct inspection of `backend/.venv` this session.

## Package Legitimacy Audit

| Package | Registry | Age / Maintainer | Verdict | Disposition |
|---------|----------|------|---------|-------------|
| next, react, react-dom | npm | Vercel / Meta — years-old, billions of weekly downloads | OK | Approved — already installed |
| typescript | npm | Microsoft | OK | Approved — already installed |
| tailwindcss, @tailwindcss/postcss | npm | Tailwind Labs | OK | Approved — already installed |
| recharts, react-is | npm | recharts org, long-standing (since 2016) | OK | Approved — already installed |
| eslint, eslint-config-next | npm | OpenJS Foundation / Vercel | OK | Approved — already installed |
| vitest, @vitejs/plugin-react, jsdom, @testing-library/* | npm | vitest-dev / testing-library orgs | OK | Approved — already installed |
| httpx | **PyPI** | Encode org (same maintainers as Starlette/Uvicorn) | OK | Approved — install via `uv add --dev httpx`, **not** `npm install httpx` |

**Cross-ecosystem warning:** `npm view httpx` resolves to an unrelated JS package (`httpx@3.0.1`, a thin `http`/`https` wrapper by a different maintainer) — **not** the Python HTTP client needed here. Confirmed by direct registry lookup this session. Install the Python `httpx` exclusively via `uv add --dev httpx` inside `backend/`.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────── Browser ───────────────────────────────┐
│                                                                        │
│  EventSource (ONE connection, app-wide)                               │
│   GET /api/stream/prices  ──────────────────────────────────┐         │
│         │ onopen → "connected"                              │         │
│         │ onerror → "reconnecting" / "disconnected"         │         │
│         ▼                                                   │         │
│  PriceStreamContext (holds: latest ticks, per-ticker ring    │         │
│  buffer for sparklines/chart, connectionStatus)              │         │
│         │                                                   │         │
│    ┌────┴─────┬───────────────┬───────────────┐              │        │
│    ▼          ▼               ▼               ▼              │        │
│ Watchlist   Sparkline      MainChart        Header            │        │
│ row (×10)  (per row,      (selected        (connection        │        │
│ price-flash  Recharts     ticker,           dot + status)     │        │
│ via CSS      LineChart,   Recharts                             │        │
│              no axes)     LineChart w/                         │        │
│                            axes+tooltip)                        │        │
└────────────────────────────────────────────────────────────────┘         │
                          ▲ HTTP GET (static export, same origin)          │
┌─────────────────────────┴──────────────────────────────────────┴──────┐
│                    FastAPI app (backend/app/main.py)                  │
│                                                                        │
│  lifespan(app):                                                       │
│    price_cache = PriceCache()                                         │
│    source = create_market_data_source(price_cache)                   │
│    await source.start(DEFAULT_TICKERS)   ── on startup                │
│    yield                                                              │
│    await source.stop()                   ── on shutdown               │
│                                                                        │
│  app.include_router(create_stream_router(price_cache))  ← /api/stream/*│
│  app.get("/api/health")                                               │
│  app.mount("/", StaticFiles(directory="static", html=True))  ← LAST   │
│           ▲                                                            │
│           └── built by `npm run build` in frontend/, copied in         │
└─────────────────────────────────────────────────────────────────────┘
```

A reader can trace the primary use case end to end: browser opens one `EventSource` → FastAPI's SSE generator reads `PriceCache.get_all()` on every version bump → JSON payload for all 10 tickers arrives client-side → the context distributes it to every subscribed component → sparklines/chart append to their ring buffers, watchlist rows flash, header dot reflects `readyState`.

### Recommended Project Structure

```
backend/app/
├── main.py                 # NEW — FastAPI() + lifespan + router mounts + StaticFiles
├── market/
│   ├── models.py            # MODIFIED — add session_open_price anchor (see Pitfall 3)
│   ├── cache.py              # MODIFIED — track session_open_price per ticker
│   ├── stream.py              # MODIFIED — fix router singleton, empty-cache bug, add keepalive
│   └── seed_prices.py          # MODIFIED — add explicit DEFAULT_TICKERS: list[str]
backend/tests/
├── test_main.py             # NEW — health check, static file serving
└── market/
    └── test_stream.py        # NEW — SSE integration tests (httpx ASGI client)

frontend/
├── package.json              # NEW
├── next.config.js            # NEW — output: 'export'
├── tsconfig.json              # NEW
├── postcss.config.mjs          # NEW — Tailwind v4 plugin
├── vitest.config.ts             # NEW
├── vitest.setup.ts                # NEW — jest-dom matchers
├── app/
│   ├── layout.tsx              # NEW — server component, imports globals.css
│   ├── page.tsx                 # NEW — client component, top-level layout
│   └── globals.css               # NEW — Tailwind v4 import + dark theme tokens + flash keyframes
├── components/
│   ├── Header.tsx                # NEW — cash placeholder, connection dot
│   ├── ConnectionDot.tsx           # NEW
│   ├── Watchlist.tsx                # NEW — grid of 10 rows
│   ├── WatchlistRow.tsx              # NEW — price + flash + sparkline, onClick → select
│   ├── Sparkline.tsx                  # NEW — minimal Recharts LineChart
│   └── MainChart.tsx                   # NEW — Recharts LineChart w/ axes for selected ticker
└── lib/
    ├── types.ts                # EXISTING — reuse ConnectionStatus, PriceTick, PriceStreamEvent as-is
    ├── api.ts                   # EXISTING — not used by Phase 1 (no portfolio/watchlist endpoints yet)
    ├── usePriceFlash.ts           # EXISTING — reuse verbatim
    ├── usePriceStream.ts            # NEW — owns the single EventSource + ring buffers
    └── PriceStreamContext.tsx         # NEW — React context wrapping usePriceStream
```

### Pattern 1: FastAPI lifespan owning the market-data source

**What:** Use an `@asynccontextmanager` lifespan, not `@app.on_event("startup")` (deprecated), to build `PriceCache`, start the data source, and guarantee `stop()` on shutdown.
**When to use:** Always for resources with an explicit start/stop lifecycle (exactly `MarketDataSource`'s documented contract in `interface.py:15-22`).
**Example:**
```python
# Source: https://fastapi.tiangolo.com/advanced/events (Context7, official docs) — pattern adapted
# to this project's PriceCache/MarketDataSource contract (backend/app/market/interface.py:15-22)
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.market.seed_prices import DEFAULT_TICKERS  # proposed new constant

@asynccontextmanager
async def lifespan(app: FastAPI):
    price_cache = PriceCache()
    source = create_market_data_source(price_cache)
    await source.start(DEFAULT_TICKERS)
    app.state.price_cache = price_cache
    app.state.market_source = source
    yield
    await source.stop()

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: StaticFiles mount ordering (SPA catch-all)

**What:** Include all API routers before mounting `StaticFiles(html=True)` at `"/"`. Starlette resolves routes in registration order; a mount at `/` matches everything by prefix, so it must be registered last to act as a fallback, not a black hole.
**When to use:** Any single-port app serving both an API and a static SPA — this is exactly PLAN.md §3's "single container, single port" design.
**Example:**
```python
# Source: verified against installed starlette.staticfiles.StaticFiles signature this session
# (backend/.venv/.../starlette/staticfiles.py) — `html=True` serves index.html for directory
# requests and 404.html as a fallback. This is the correct primitive; do NOT use the
# `app.frontend(...)` method shown on fastapi.tiangolo.com/reference/fastapi and
# fastapi.tiangolo.com/tutorial/frontend — that method does not exist on the installed
# fastapi==0.128.7 FastAPI instance (`hasattr(FastAPI(), "frontend")` → False, checked this
# session). It may be a very recent/unreleased doc addition; do not build against it.
from fastapi.staticfiles import StaticFiles

app.include_router(create_stream_router(price_cache))  # /api/stream/* registered FIRST

@app.get("/api/health")
async def health():
    return {"status": "ok"}

app.mount("/", StaticFiles(directory="static", html=True), name="static")  # LAST
```

### Pattern 3: Session-anchored `change`/`change_percent` alongside tick-to-tick `direction`

**What:** `PriceUpdate` currently computes `change`/`change_percent`/`direction` all from the same `previous_price` — the immediately prior ~500ms tick (`backend/app/market/models.py:18-28`, verbatim: `"""Percentage change from previous update."""`). PLAN.md §10 wants a "daily change %" in the watchlist, and MKT-02 wants a per-tick flash on "uptick"/"downtick". These are two different anchors and must not share one field.
**When to use:** This phase, per ROADMAP.md scope note (c) and CONCERNS.md's "Specification Mismatch" entry.
**Design (proposed — not yet in the codebase):**
```python
# Proposed change to backend/app/market/models.py — keeps previous_price (tick-to-tick,
# drives `direction`/flash) and adds session_open_price (drives change/change_percent).
@dataclass(frozen=True, slots=True)
class PriceUpdate:
    ticker: str
    price: float
    previous_price: float        # prior ~500ms tick — drives `direction` (flash trigger)
    session_open_price: float    # first price recorded for this ticker this process run
    timestamp: float = field(default_factory=time.time)

    @property
    def change(self) -> float:
        return round(self.price - self.session_open_price, 4)

    @property
    def change_percent(self) -> float:
        if self.session_open_price == 0:
            return 0.0
        return round((self.price - self.session_open_price) / self.session_open_price * 100, 4)

    @property
    def direction(self) -> str:
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"
```
`PriceCache.update()` needs a `_session_open: dict[str, float]` set once per ticker (first `update()` call for that ticker, or when re-added after `remove()`), threaded through the same lock already held in `update()` (`cache.py:29-42`).

**`to_dict()`'s output shape (`ticker`, `price`, `previous_price`, `timestamp`, `change`, `change_percent`, `direction`) does not need to change** — it already matches `frontend/lib/types.ts`'s `PriceTick` interface verbatim (`types.ts:6-16`: `ticker: string; price: number; previous_price: number; timestamp: number; change: number; change_percent: number; direction: Direction;`). No frontend type changes required.

### Anti-Patterns to Avoid

- **One `EventSource` per watchlist row:** The SSE payload already contains all 10 tickers per event (`stream.py:81`: `data = {ticker: update.to_dict() for ticker, update in prices.items()}`). Opening 10 connections would 10x the browser's connection count against a same-origin per-host limit and deliver 10 duplicate copies of the same payload. Use one shared connection via context/provider.
- **Reconstructing the router singleton pattern anywhere else:** `stream.py:17` currently declares `router = APIRouter(...)` at module scope; any new router factory added this phase (there shouldn't be one) must build the `APIRouter()` instance *inside* the factory function, matching the fix already required for `create_stream_router`.
- **Trusting the fastapi.tiangolo.com `app.frontend()` / `fastapi.sse.EventSourceResponse` snippets:** Both appeared in this session's Context7 doc fetch against the *live* docs site, and neither exists on the installed `fastapi==0.128.7` (`hasattr(app, "frontend")` → `False`; no `fastapi/sse.py` module in the installed package — both checked directly against `backend/.venv` this session). The docs site may be tracking an unreleased/main-branch version. Use the verified `StaticFiles(html=True)` mount and the existing hand-written `StreamingResponse(text/event-stream)` pattern already in `stream.py` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE reconnection/backoff | Custom polling + exponential backoff loop | Native `EventSource` (already sends `retry: 1000\n\n` per `stream.py:62`) | Browsers implement this correctly per spec; only track `readyState`/`onopen`/`onerror` for the status dot |
| Sparkline/price chart rendering | Hand-rolled `<canvas>` or SVG polyline drawing | Recharts `LineChart` (already installed, 3.10.1) | Recharts handles scaling, resizing (`ResponsiveContainer`), and is already resolved in `node_modules` — no new install risk |
| ASGI streaming test harness | Raw socket / manual ASGI scope simulation | `httpx.AsyncClient(transport=httpx.ASGITransport(app=app))` with `client.stream(...)` | Official Encode-maintained pattern for testing ASGI apps without a running server; already installed in `.venv` |
| Tailwind theme config | `tailwind.config.js` (v3-style JS config) | Tailwind v4's CSS-first `@theme` block inside `globals.css` | v4.3.3 is CSS-config-first; a `tailwind.config.js` is silently ignored unless explicitly wired via `@config`, which adds complexity for no benefit here |

**Key insight:** Almost everything Phase 1 needs on the frontend side already ships in the dependency tree that's sitting in `node_modules` right now. The work is authoring the missing config/source files to match what's already resolved — not picking new libraries.

## Common Pitfalls

### Pitfall 1: Module-level SSE router singleton
**What goes wrong:** Calling `create_stream_router(cache)` twice (e.g., once in the app, once in a test) registers the `/prices` handler twice on the same shared `router` object; the second call's closure silently wins for behavior, but FastAPI logs duplicate route registration.
**Why it happens:** `router = APIRouter(prefix="/api/stream", tags=["streaming"])` is declared at module scope in `stream.py:17`, and `create_stream_router` decorates onto it via closure rather than constructing a fresh router.
**How to avoid:** Move `router = APIRouter(...)` inside `create_stream_router()` (per ROADMAP.md scope note (a) and CONCERNS.md's documented fix).
**Warning signs:** FastAPI startup logs about duplicate routes, or tests that construct the router more than once interfering with each other.

### Pitfall 2: Version counter advances on an empty cache
**What goes wrong:** `stream.py:76-83` bumps `last_version` before checking whether `prices` is non-empty. If the cache is briefly empty at startup (before `source.start()` seeds it), the SSE loop "consumes" that version bump without sending data — any later update reuses a version number the client already believes it has seen only if it also happens to still equal `last_version`, but more subtly: a legitimate zero-ticker moment causes silent event loss for that cycle.
**Why it happens:** The version-check and the emptiness-check are two separate `if`s instead of one gated check.
**How to avoid:** Only advance `last_version` inside the `if prices:` branch:
```python
current_version = price_cache.version
if current_version != last_version:
    prices = price_cache.get_all()
    if prices:
        last_version = current_version
        data = {ticker: update.to_dict() for ticker, update in prices.items()}
        yield f"data: {json.dumps(data)}\n\n"
```
**Warning signs:** A client that never receives a first paint despite the server being "connected", specifically on a slow-starting `MarketDataSource` (not observable with the simulator's synchronous seed-on-`start()` behavior, per `simulator.py:224-228`, but real under any source with async startup latency).

### Pitfall 3: Tick-to-tick vs. session-anchored % change
**What goes wrong:** With `GBMSimulator.DEFAULT_DT ≈ 8.48e-8` (`simulator.py:48`), each 500ms tick's price move has roughly a $0.01–$0.02 standard deviation on a ~$200 stock (back-of-envelope from `sigma * sqrt(dt) * price`). `change_percent` computed from `previous_price` alone (as it is today) reports millisecond-scale noise, not the "daily change %" PLAN.md §10 describes for the watchlist.
**Why it happens:** One field (`previous_price`) was overloaded to serve both the flash-trigger (`direction`) and the display percentage (`change_percent`).
**How to avoid:** Split the anchors as shown in Architecture Pattern 3 above — `previous_price` for `direction`, a new `session_open_price` for `change`/`change_percent`.
**Note (ASSUMED — flag for confirmation):** "Session" is defined here as *since the ticker was added to this running process's cache*, not a calendar trading day — there's no real market calendar in a demo that runs continuously. This is a reasonable MVP interpretation but is an assumption, not a spec-mandated definition; PLAN.md never resolves it (CONCERNS.md explicitly lists "define 'session' as a calendar day" as an open option). See Assumptions Log.

### Pitfall 4: Sub-cent moves occasionally round to an identical price ("flat" ticks)
**What goes wrong:** `PriceCache.update()` rounds to 2 decimals (`cache.py:36-37`). For low-volatility tickers (JPM `sigma=0.18`, V `sigma=0.17`, per `seed_prices.py:28-29`), a meaningful fraction of ticks will round to the exact same price as the previous tick, producing `direction == "flat"` and no CSS flash for that tick.
**Why it happens:** This is inherent to modeling sub-cent GBM moves at cent-level display precision — not a bug, but a real observable behavior.
**How to avoid:** Don't write E2E/UAT checks that assume *every* 500ms tick flashes every ticker; assert that flashes occur *over a window* (e.g., "at least one flash within 5 seconds"), not on every single event.
**Warning signs:** A flaky E2E test asserting a flash on the very next SSE event after page load.

### Pitfall 5: `app.frontend()` and `fastapi.sse.EventSourceResponse` are not real on the installed version
**What goes wrong:** Both appear as canonical patterns when querying the live fastapi.tiangolo.com docs (via Context7) for "mount static SPA" and "server-sent events" respectively. Building against either will fail: `AttributeError: 'FastAPI' object has no attribute 'frontend'`, and `ModuleNotFoundError: No module named 'fastapi.sse'`.
**Why it happens:** The hosted docs site appears to already document upcoming/unreleased FastAPI functionality ahead of the `0.128.7` release pinned in this project.
**How to avoid:** Verified this session — `hasattr(FastAPI(), "frontend")` → `False`; no `sse` submodule under the installed `fastapi` package. Use `StaticFiles(html=True)` (Pattern 2) and the existing hand-written `StreamingResponse(..., media_type="text/event-stream")` pattern already in `stream.py` (Pattern already proven — 73 passing tests exercise the rest of the market module against this FastAPI version).
**Warning signs:** Any task description or generated code that imports `fastapi.sse` or calls `app.frontend(...)` — reject it, it will not run against this project's pinned FastAPI.

### Pitfall 6: `httpx` is installed but not in `uv.lock`
**What goes wrong:** `backend/.venv` currently has `httpx==0.28.1` (verified this session), but grepping `uv.lock` for it finds nothing — it isn't a tracked dependency of anything in `pyproject.toml`. A fresh `uv sync` (as CI or a clean clone would run) will **not** install it, and the new SSE integration tests (mandated by this phase) will fail to import.
**Why it happens:** It's likely a stray leftover from an earlier, differently-configured environment, not something `uv` resolved.
**How to avoid:** Run `uv add --dev httpx` from `backend/` so it's captured in both `pyproject.toml`'s `dev` extra and `uv.lock`.
**Warning signs:** Tests pass locally but fail in a clean CI checkout with `ModuleNotFoundError: No module named 'httpx'`.

### Pitfall 7: Dev Python is 3.13, Docker's Stage 2 targets 3.12-slim
**What goes wrong:** `backend/.venv` was built against Python 3.13 (`.venv/lib/python3.13/...`), while PLAN.md §11 specifies "Stage 2: Python 3.12 slim" for the production image, and `pyproject.toml` only requires `>=3.12`.
**Why it happens:** Local `uv sync` picked up whatever Python 3.13 was on the machine; this is allowed by the `>=3.12` constraint but not what ships.
**How to avoid:** Don't use any Python 3.13-only syntax/stdlib additions in Phase 1 code. Not a blocker for Phase 1 (Docker packaging is Phase 5), but worth keeping in mind since Phase 1's new code (`main.py`, model changes) will be the first server code to run in prod.

## Code Examples

### FastAPI health check (new)
```python
# backend/app/main.py — proposed
@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

### Explicit default ticker list (new — closes an implicit-ordering gap)
```python
# backend/app/market/seed_prices.py — proposed addition
# No DEFAULT_TICKERS constant exists yet anywhere in the codebase (confirmed via grep this
# session). The 10-ticker order the app should seed with today only exists implicitly as
# SEED_PRICES's dict insertion order (seed_prices.py:5-14) — make it an explicit, named list
# so nothing downstream depends on dict key ordering by accident.
DEFAULT_TICKERS: list[str] = [
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX",
]
```

### SSE keepalive comment (new — CONCERNS.md fix (d))
```python
# backend/app/market/stream.py — proposed addition inside _generate_events()
# SSE comment lines (":" prefix) are ignored by EventSource but keep proxies/load balancers
# from treating an idle connection as dead. Needed most under MassiveDataSource's 15s poll
# interval (massive_client.py:32); harmless under the simulator's 500ms cadence.
last_keepalive = time.monotonic()
KEEPALIVE_INTERVAL = 15.0
...
if time.monotonic() - last_keepalive > KEEPALIVE_INTERVAL:
    yield ": keepalive\n\n"
    last_keepalive = time.monotonic()
```

### SSE integration test skeleton (new — mandated by this phase's scope notes)
```python
# backend/tests/market/test_stream.py — proposed
# Pattern: httpx.AsyncClient over ASGITransport, no running server needed.
# httpx must be added via `uv add --dev httpx` first (see Pitfall 6).
import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from app.market.cache import PriceCache
from app.market.stream import create_stream_router


@pytest.mark.asyncio
class TestSSEStream:
    async def test_event_delivery(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        app = FastAPI()
        app.include_router(create_stream_router(cache))
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            async with client.stream("GET", "/api/stream/prices") as response:
                assert response.status_code == 200
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        assert "AAPL" in line
                        break

    async def test_client_disconnect_stops_generator(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        app = FastAPI()
        app.include_router(create_stream_router(cache))
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            async with client.stream("GET", "/api/stream/prices") as response:
                async for _ in response.aiter_lines():
                    break  # exiting the `async with` triggers client disconnect
        # No assertion needed beyond "this doesn't hang or raise" —
        # the generator must observe request.is_disconnected() and exit cleanly.
```

### Frontend config files (new — none of these exist on disk today)

```json
// frontend/package.json — proposed, versions match what's already in node_modules
{
  "name": "finally-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "16.3.5",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "recharts": "3.10.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/node": "22.20.3",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "eslint": "9.39.5",
    "eslint-config-next": "16.3.5",
    "jsdom": "30.1.0",
    "postcss": "8.5.28",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "typescript": "5.9.3",
    "vitest": "5.0.1"
  }
}
```

```js
// frontend/next.config.js — proposed
// Source: https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/single-page-applications.mdx (Context7)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true, // pairs with StaticFiles(html=True)'s directory→index.html resolution
};
module.exports = nextConfig;
```

```json
// frontend/tsconfig.json — proposed, adapted from the pre-deletion version recovered from
// git history (git show c11222f1^:frontend/tsconfig.json) with `types` trimmed since vitest
// globals are configured via vitest.config.ts instead in this rebuild
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```js
// frontend/postcss.config.mjs — proposed (Tailwind v4 CSS-first setup)
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

```css
/* frontend/app/globals.css — proposed skeleton */
@import "tailwindcss";

@theme {
  --color-bg: #0d1117;
  --color-accent-yellow: #ecad0a;
  --color-primary-blue: #209dd7;
  --color-secondary-purple: #753991;
}

.flash-up {
  background-color: color-mix(in srgb, #16a34a 35%, transparent);
  transition: background-color 550ms ease-out;
}
.flash-down {
  background-color: color-mix(in srgb, #dc2626 35%, transparent);
  transition: background-color 550ms ease-out;
}
```

### Minimal sparkline (Recharts) — pattern only, not project-specific data yet
```tsx
// Source: https://github.com/recharts/recharts (Context7) — LineChart basic pattern,
// adapted to a no-axis/no-tooltip sparkline shape
import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data }: { data: { price: number }[] }) {
  return (
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="price"
            stroke="#209dd7"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@app.on_event("startup")` / `("shutdown")` | `lifespan` async context manager | Deprecated since FastAPI ~0.93 (well before the pinned 0.128.7) | Use `lifespan=` on `FastAPI(...)`, not the decorator form |
| `tailwind.config.js` (v3) | CSS-first `@theme` config (v4) | Tailwind v4 (installed: 4.3.3) | No JS config file needed; theme tokens live in `globals.css` |

**Deprecated/outdated:** None else specific to this phase's scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Session" for `session_open_price` means "since the ticker was added to the running process's cache," not a calendar trading day | Pitfall 3 / Pattern 3 | If the user actually wants a real daily-open anchor that resets at midnight/market-open, the chosen anchor would show ever-larger drift the longer the container runs uninterrupted — low functional risk for an MVP demo, but worth a one-line confirmation during `/gsd-discuss-phase` |
| A2 | Recharts (not lightweight-charts) is the right chart library for this phase | Standard Stack / Alternatives Considered | If a later phase's heatmap/P&L chart (Phase 3) turns out to need lightweight-charts-specific features, switching charting libraries mid-project costs a rewrite of Phase 1's sparkline/chart components — low risk since Recharts is a general-purpose library and PLAN.md explicitly names it as an acceptable choice |
| A3 | `trailingSlash: true` in `next.config.js` is the right pairing for `StaticFiles(html=True)` | Code Examples | Phase 1 only has one route (`/`), so this has no observable effect yet; if additional static pages are added later without re-verifying, trailing-slash mismatches could 404 |

## Open Questions

1. **Where exactly does `main.py` live — `backend/app/main.py` or `backend/app/server.py`?**
   - What we know: STRUCTURE.md lists `main.py` first as the likely convention; `app/market/__init__.py`'s docstring and every other module already treats `app.market` as the import root (`from app.market import ...`).
   - What's unclear: No file exists yet to confirm; either name works with `uvicorn app.main:app` or `uvicorn app.server:app`.
   - Recommendation: Use `backend/app/main.py` (matches the more common FastAPI convention and STRUCTURE.md's stated first guess); Phase 5's Dockerfile `CMD` must reference whichever name is chosen.

2. **Does the frontend need a `next dev` + backend proxy workflow for iterative development, or is build-then-serve-via-FastAPI sufficient for Phase 1?**
   - What we know: Next's own docs (Context7, `v16.1.6/docs/.../config.ts`) confirm `rewrites()` only *warns* (doesn't error) when combined with `output: 'export'` during `next build`; a separate docs page's wording on `next dev` + unsupported-features is ambiguous about whether rewrites work in dev mode when `output: 'export'` is set.
   - What's unclear: Whether a `rewrites()`-based dev proxy to `localhost:8000` will actually function in `next dev` given that ambiguity — evidence conflicts and neither claim was falsified by direct testing this session.
   - Recommendation: Don't build a task around the rewrites proxy. Default workflow: `npm run build` (produces `frontend/out/`) → copy/symlink into wherever `backend/app/main.py` expects its `static` directory → `uvicorn app.main:app --reload`. This matches the single-port production path Phase 5 will package anyway (per ROADMAP.md's explicit rationale for doing this in Phase 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| uv | Backend dependency management, running tests | ✓ [VERIFIED this session] | 0.9.13 | — |
| Python (via uv-managed venv) | Backend runtime | ✓ [VERIFIED this session] | 3.13 (`.venv`); `pyproject.toml` requires `>=3.12` | Docker Stage 2 (Phase 5) targets 3.12-slim explicitly — no fallback needed, just don't use 3.13-only syntax (Pitfall 7) |
| Node.js | Frontend build/dev | ✓ [VERIFIED this session] | v24.21.0 | Next 16's installed `engines` field requires `>=20.9.0` — satisfied |
| npm | Frontend package management | ✓ [VERIFIED this session] | 11.19.0 | — |
| Docker | Not needed this phase | — | — | Phase 5 concern |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — everything required for Phase 1 is present, though `httpx` (Python) needs to be formally added to `pyproject.toml`/`uv.lock` (Pitfall 6), and all frontend config files need to be authored (not "missing" as a dependency, but as source files).

## Validation Architecture

### Test Framework — Backend
| Property | Value |
|----------|-------|
| Framework | pytest 8.3+ with pytest-asyncio (`asyncio_mode = "auto"`), per `backend/pyproject.toml:30-36` |
| Config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd backend && uv run --extra dev pytest tests/market/test_stream.py tests/test_main.py -v` |
| Full suite command | `cd backend && uv run --extra dev pytest --cov=app -v` |

### Test Framework — Frontend
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 + @testing-library/react 16.3.3 + jsdom 30.1.0 (all installed, **no config file exists yet**) |
| Config file | none — see Wave 0 Gaps |
| Quick run command | `cd frontend && npm run test -- --run <file>` (once `vitest.config.ts` exists) |
| Full suite command | `cd frontend && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MKT-01 | Watchlist grid streams 10 tickers via SSE without manual refresh | integration (backend) + component (frontend) | `uv run --extra dev pytest tests/market/test_stream.py -v` ; `npm run test -- --run Watchlist` | ❌ Wave 0 (both) |
| MKT-02 | Price flash green/red, fades ~500ms | unit (frontend hook, already exists) | `npm run test -- --run usePriceFlash` | ❌ Wave 0 (hook exists at `frontend/lib/usePriceFlash.ts`, no test file yet) |
| MKT-03 | Sparkline fills in progressively from SSE since load | component (frontend) | `npm run test -- --run Sparkline` | ❌ Wave 0 |
| MKT-04 | Click ticker → larger chart in main area | component (frontend) | `npm run test -- --run MainChart` | ❌ Wave 0 |
| MKT-05 | Connection dot reflects SSE state, auto-recovers | component (frontend) + manual/E2E-adjacent | `npm run test -- --run ConnectionDot` | ❌ Wave 0 — true disconnect/reconnect end-to-end is realistically manual-verify or deferred to Phase 5's Playwright suite (PLAN.md §12 explicitly lists "SSE resilience: disconnect and verify reconnection" as an E2E scenario, not a unit test) |

### Sampling Rate
- **Per task commit:** targeted quick-run command for the file(s) touched (backend or frontend, as applicable)
- **Per wave merge:** full suite for whichever side (backend/frontend) the wave touched
- **Phase gate:** both full suites green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/market/test_stream.py` — covers MKT-01 (SSE delivery), CONCERNS.md's version-change-detection and disconnect gaps
- [ ] `backend/tests/test_main.py` — covers `/api/health` and static-file serving
- [ ] `frontend/vitest.config.ts` + `frontend/vitest.setup.ts` — no test config exists despite vitest/jsdom/testing-library all being installed
- [ ] `frontend/__tests__/usePriceFlash.test.ts` — the hook already exists in source but has zero test coverage today
- [ ] Framework install: none — vitest/testing-library are already in `node_modules`; only config files are missing

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Out of scope for the whole project — single hardcoded `user_id="default"`, no login (PLAN.md §7, confirmed in REQUIREMENTS.md Out of Scope) |
| V3 Session Management | No | No sessions exist |
| V4 Access Control | No | No access boundaries in a single-user app |
| V5 Input Validation | Marginal | Phase 1's only user-facing surface is `GET` requests with no body/params (SSE stream, health check); the ticker list is a hardcoded server-side constant this phase, not user input — no validation code needed yet (arrives in Phase 2 per CONCERNS.md's ticker-format-validation item) |
| V6 Cryptography | No | No secrets handled by any code written this phase (the existing `MASSIVE_API_KEY` read in `factory.py` predates this phase and is unchanged) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `StaticFiles` | Tampering / Information Disclosure | Starlette's `StaticFiles.lookup_path` already normalizes/validates paths and rejects traversal attempts (verified via installed `starlette.staticfiles` source this session) — no custom sanitization needed, just don't build a competing manual file-serving route |
| Unbounded SSE connections (resource exhaustion) | Denial of Service | Not fixed this phase — CONCERNS.md already documents "No Concurrent Client Limit on SSE" as a known, deferred scaling limit for a single-user demo app; note it, don't block on it |

## Sources

### Primary (HIGH confidence)
- `/vercel/next.js/v16.1.6` (Context7) — static export config, unsupported-features list, rewrites+export interaction
- `/websites/fastapi_tiangolo` (Context7) — lifespan pattern, StaticFiles reference, SSE tutorial page (partially contradicted by direct installed-package inspection — see Pitfall 5)
- `/recharts/recharts` (Context7) — LineChart/AreaChart patterns
- Direct inspection of `backend/.venv` and `frontend/node_modules` this session (fastapi/starlette/httpx versions and APIs; next/react/tailwind/recharts/vitest versions)
- `backend/app/market/*.py` — read in full this session (models.py, cache.py, stream.py, interface.py, factory.py, seed_prices.py, simulator.py excerpt)
- `frontend/lib/*.ts` — read in full this session (types.ts, api.ts, hooks.ts, usePriceFlash.ts, positionMath.ts, format.ts)
- `npm view <pkg> version` against the live npm registry this session (next, react, tailwindcss, recharts, typescript, vitest, jsdom, @testing-library/react)

### Secondary (MEDIUM confidence)
- Git history recovery of the pre-deletion `frontend/tsconfig.json`/`package.json` (`git show c11222f1^:frontend/...`) — useful as a structural reference, not treated as current since dependency versions there are stale (Next 14.2.11, React 18.3.1) vs. what's actually installed now

### Tertiary (LOW confidence)
- Back-of-envelope GBM per-tick volatility estimate in Pitfall 4 — order-of-magnitude reasoning from `simulator.py`'s documented `DEFAULT_DT` and `seed_prices.py`'s `sigma` values, not empirically measured by running the simulator this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version claim verified against either an installed package on disk or a live registry lookup this session
- Architecture: HIGH (backend, working from fully-read source) / MEDIUM (frontend, since no frontend source exists yet to verify patterns against — recommendations are grounded in the existing `frontend/lib/*.ts` conventions and verified library APIs, but unexercised)
- Pitfalls: HIGH — 5 of 7 pitfalls are drawn directly from CONCERNS.md (already audited against source) or from direct verification against installed packages this session; 2 (session-anchor definition, sub-cent rounding magnitude) are reasoned/flagged as assumptions

**Research date:** 2026-09-17
**Valid until:** 2026-10-01 (30 days — dependency versions and FastAPI's live-docs-vs-installed-version gap should be re-checked if this phase's execution slips past that window)

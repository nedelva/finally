---
phase: 01-live-price-terminal
plan: 02
subsystem: fullstack
tags: [fastapi, sse, lifespan, staticfiles, uvicorn, react, eventsource, tdd]

requires:
  - phase: 01-live-price-terminal
    provides: "Buildable Next.js scaffold, frontend/lib/ trackable (from 01-01)"
provides:
  - "backend/app/main.py: create_app() factory, lifespan-managed market data source, /api/health, StaticFiles mount"
  - "app.market.DEFAULT_TICKERS: explicit ten-ticker default list, no longer implied by dict order"
  - "frontend/lib/usePriceStream.ts: single shared EventSource, capped per-ticker history, connection status"
  - "frontend/lib/PriceStreamContext.tsx: the one place the whole app reads the price stream from"
  - "frontend/app/page.tsx rendering live prices under the provider, disclosing simulated data"
affects: [01-03, 01-04, 01-05]

actuals:
  tokens: 7615
  tasks: 2
  commits: 3
  plan_head_before: a49ce9b8ea290a4bd50c4cdf5bef99ba50ad4d0e

tech-stack:
  added: [httpx@0.28.1 (backend dev), uvicorn (test-only real-server pattern)]
  patterns:
    - "FastAPI lifespan owning PriceCache + MarketDataSource, mirroring market_data_demo.py's start/run/stop shape"
    - "StaticFiles(html=True) mounted last, after every API router, so registration order doesn't swallow API routes"
    - "Static directory resolution: FINALLY_STATIC_DIR env var -> backend/static -> frontend/out -> skip with a warning"
    - "React: single EventSource behind a context provider, capped ring-buffer history per ticker"

key-files:
  created:
    - backend/app/main.py
    - backend/tests/test_main.py
    - frontend/lib/usePriceStream.ts
    - frontend/lib/PriceStreamContext.tsx
    - frontend/__tests__/usePriceStream.test.tsx
  modified:
    - backend/app/market/seed_prices.py
    - backend/app/market/__init__.py
    - backend/pyproject.toml
    - backend/uv.lock
    - frontend/app/page.tsx

key-decisions:
  - "SSE integration test drives the module-level app.main:app singleton through a real, bound uvicorn server (127.0.0.1, port 0) instead of httpx.ASGITransport or Starlette's TestClient — both of those transports fully drain an ASGI app's response body before returning anything, which deadlocks against this endpoint's disconnect-only generator; a real socket streams incrementally like a browser EventSource would"
  - "The same SSE test intentionally reuses app.main's own module-level app object rather than building a second app via create_app() — stream.py's pre-existing module-level APIRouter singleton (CONCERNS.md, fixed in 01-03) means a second create_app() call in the same process would register a duplicate /prices handler that Starlette's first-match dispatch would shadow, permanently routing to an unstarted, empty price_cache"
  - "TDD RED phase used a deliberate status-only stub of usePriceStream.ts (not a missing file) so the test suite loads and fails on real behavioural assertions rather than a module-resolution error, which the project's INVALID_RED guidance treats as illegitimate for greenfield code"

patterns-established:
  - "Real end-to-end SSE test pattern: uvicorn.Server bound to an OS-assigned port, driven as an asyncio task, torn down via should_exit + awaiting the task — the reusable escape hatch whenever a test needs a truly streaming ASGI response instead of a buffered one"

requirements-completed: []

coverage:
  - id: D1
    description: "backend/app/main.py assembles PriceCache + market data source + SSE router + health + static mount into one FastAPI app, driven by a lifespan"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_main.py::TestLifespanSSE::test_first_frame_contains_all_default_tickers"
        status: pass
      - kind: unit
        ref: "backend/tests/test_main.py::TestHealthEndpoint, TestStaticServing (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "app.market.DEFAULT_TICKERS is an explicit, ordered ten-ticker constant, re-exported from the app.market barrel"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "backend/tests/test_main.py::TestLifespanSSE::test_first_frame_contains_all_default_tickers (asserts the SSE frame's key set equals set(DEFAULT_TICKERS))"
        status: pass
    human_judgment: false
  - id: D3
    description: "usePriceStream.ts holds a single shared EventSource with capped, append-only per-ticker history and connection-status transitions"
    requirement: "MKT-01, MKT-03, MKT-05"
    verification:
      - kind: unit
        ref: "frontend/__tests__/usePriceStream.test.tsx (12 tests covering all 9 plan behaviours)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PriceStreamContext.tsx is the sole distribution point for the stream; page.tsx renders live prices through it and discloses simulated data"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "grep -q usePriceStreamContext/formatPrice/formatPercent frontend/app/page.tsx; grep -q 'Simulated market data' frontend/out/index.html"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual/terminal aesthetic of the live-updating table (this plan's deliberately plain placeholder, replaced by 01-04's real watchlist grid)"
    verification: []
    human_judgment: true
    rationale: "This plan's page.tsx is an intentionally plain table per the plan's own scope note (\"Keep this table deliberately plain; plan 01-04 replaces it\") — no automated check can distinguish intentional minimalism from an unfinished UI, so a human should confirm the plain table is expected at this stage, not judge its final look"

duration: ~28min
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 2: Live Prices on One Port Summary

**Mounted the previously-dead-code market-data engine into a real FastAPI app for the first time (lifespan-managed source, `/api/health`, last-registered `StaticFiles` mount) and gave the frontend its first live data via a single shared `EventSource` behind a React context, proven end to end by a real bound uvicorn server rather than a buffered ASGI test transport.**

## Performance
- **Duration:** ~28min
- **Started:** 2026-09-17T20:20:40Z (approx, per prior commit)
- **Completed:** 2026-09-17T20:46:13Z
- **Tasks:** 2 completed
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- `backend/app/main.py` is the project's first FastAPI application: a `create_app()` factory with a `lifespan` that starts/stops the existing, 84%-covered `market/` subsystem, mounts the pre-existing SSE router, exposes `GET /api/health`, and serves the built Next.js export from a resolvable static directory — registered last so it never swallows API routes
- Closed a real implicit-ordering gap: `app.market.DEFAULT_TICKERS` is now an explicit, ordered ten-ticker list, re-exported from the `app.market` barrel, instead of being defined only by `SEED_PRICES` dict insertion order
- Proved the full spine — market engine → `PriceCache` → FastAPI → SSE → single-origin static serving — with an automated test that drives the actual `app.main:app` object through a real, bound uvicorn server and asserts a real `data:` frame with all ten default tickers and the exact seven-key `PriceTick` shape
- `frontend/lib/usePriceStream.ts` gives the browser its first live data: one shared `EventSource`, a capped 120-point append-only history per ticker, and status transitions (`connecting`/`connected`/`reconnecting`) driven by native `EventSource` retry — no hand-rolled backoff
- `frontend/lib/PriceStreamContext.tsx` is now the only sanctioned way any component reads the stream; `frontend/app/page.tsx` renders live prices through it and discloses "Simulated market data"
- Full TDD cycle for the frontend hook: 12 tests covering all 9 plan-specified behaviours (single connection, StrictMode remount safety, status transitions, tick/history population, duplicate-price retention, history cap + eviction, malformed-JSON resilience)

## Task Commits
1. **Task 1: End-to-end "live prices on one port"** - `762d54e` (feat)
2. **Task 2 RED: failing usePriceStream test** - `6419a0a` (test)
3. **Task 2 GREEN: usePriceStream + context + page** - `64ff673` (feat)
**Plan metadata:** pending (docs: complete plan) — committed after this SUMMARY
_Note: Task 2's TDD cycle produced two commits (test → feat); no REFACTOR commit was needed, the GREEN implementation needed no follow-up cleanup._

## Files Created/Modified
- `backend/app/main.py` - `create_app()` factory, `resolve_static_dir()`, lifespan, health endpoint, static mount; `app = create_app()` at module scope for `uvicorn app.main:app`
- `backend/app/market/seed_prices.py` - Added `DEFAULT_TICKERS: list[str]`
- `backend/app/market/__init__.py` - Re-exported `DEFAULT_TICKERS`, updated docstring and `__all__`
- `backend/pyproject.toml` / `backend/uv.lock` - Added `httpx` to the `dev` extra; registered the `requires_frontend_build` pytest marker
- `backend/tests/test_main.py` - Health, static (present/absent/real export), and a real-server SSE integration test
- `frontend/lib/usePriceStream.ts` - The single shared `EventSource` hook
- `frontend/lib/PriceStreamContext.tsx` - Provider/consumer pair distributing one stream
- `frontend/__tests__/usePriceStream.test.tsx` - 12 tests, fake `EventSource` double
- `frontend/app/page.tsx` - Converted to render live prices under `PriceStreamProvider`

## Decisions Made
See `key-decisions` in frontmatter above — both concern how the backend SSE integration test was actually made to work against a real, non-terminating stream and around a pre-existing router-singleton defect it is not this plan's job to fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's specified SSE test transport (`httpx.ASGITransport`) deadlocks against a disconnect-only generator**
- **Found during:** Task 1, first run of `backend/tests/test_main.py`
- **Issue:** The plan's action block explicitly recommended `httpx.AsyncClient` over `httpx.ASGITransport`, entering the lifespan via `app.router.lifespan_context(app)`. Empirically, both `httpx.ASGITransport.handle_async_request` and Starlette's `TestClient` (`_TestClientTransport.handle_request`) fully drain an ASGI app's response body — waiting for a `more_body: False` message — before returning anything to the caller. `stream.py`'s SSE generator only terminates on client disconnect, so it never sends `more_body: False`; both transports hang forever entering `client.stream(...)`, before any line is ever read, making the plan's "bound the read with a timeout" instruction ineffective (the hang is upstream of the read loop).
- **Fix:** Bound a real `uvicorn.Server` to `127.0.0.1` on an OS-assigned port (`port=0`), ran it as an `asyncio.create_task`, and connected with a real-socket `httpx.AsyncClient` (no `ASGITransport`). A genuine socket streams bytes incrementally as a browser's `EventSource` would, so `aiter_lines()` yields the `retry:` line and then the `data:` frame without waiting for the stream to end. Server torn down via `should_exit = True` + awaiting the task.
- **Files modified:** `backend/tests/test_main.py`
- **Verification:** `uv run --directory backend --extra dev pytest tests/test_main.py -v` → 5 passed; full suite → 78 passed
- **Commit:** `762d54e`

**2. [Rule 1 - Bug] A second `create_app()` call in the same test process silently routes to the wrong `PriceCache`**
- **Found during:** Task 1, debugging deviation #1 above
- **Issue:** While tracing the deadlock, instrumenting `_generate_events` revealed that even after switching to a real server, `price_cache.version` read as `0` (empty) at request time, despite the test's own `create_app()` call populating a `PriceCache` with `version == 10` immediately after `source.start()`. Root cause: `backend/app/market/stream.py:17` declares `router = APIRouter(...)` at *module* scope (the exact defect CONCERNS.md documents and plan 01-03 owns). `create_stream_router()` decorates `@router.get("/prices")` onto that shared singleton on every call. `backend/app/main.py`'s own `app = create_app()` at module scope means simply *importing* `app.main` (as the test file does) registers the first `/prices` handler, closed over that module-level app's own, never-started `price_cache`. Any subsequent `create_app()` call in the test (needed to isolate `static_dir` per test) registers a *second* handler for the same path on the same shared router; `app.include_router(router)` copies every route present on the singleton at call time onto the new app, and Starlette dispatches by first-registration order — so every test-built app's `/api/stream/prices` route silently resolved to the very first (unstarted, empty) `price_cache`, not its own.
- **Fix:** Rather than building a fresh `create_app()` instance for the SSE test, drive `app.main`'s own module-level `app` object directly (`from app.main import app as module_app`) — the one whose registration is always first, and which is also the literal object `uvicorn app.main:app` serves in production, making this the more faithful test regardless. Did **not** touch `stream.py`'s router construction — that repair is explicitly plan 01-03's, per this plan's own `read_first` note and the phase's threat/pattern docs.
- **Files modified:** `backend/tests/test_main.py`
- **Verification:** Confirmed via `id(price_cache)` tracing that the module-level app's cache (populated, version 10) is the one the real request reaches; `test_first_frame_contains_all_default_tickers` passes reliably across repeated runs and after the other three tests in the file (which each call `create_app()` again) have already run
- **Commit:** `762d54e`

**3. [Note, not a rule-triggered deviation] TDD RED phase used a stub implementation, not a missing file**
- **Found during:** Task 2, before writing the RED test
- **Issue:** `usePriceStream.ts` is genuinely new code (unlike 01-01's `usePriceFlash.ts`, which was pre-existing). A literal "test-first, no implementation file" RED would make Vitest report a module-resolution failure for the whole test file — effectively zero tests collected, which the project's own INVALID_RED guidance treats as illegitimate (masks whether the test logic itself is meaningful).
- **Resolution:** Authored a minimal, correctly-shaped stub (`usePriceStream` returning a static `{ticks: {}, history: {}, tickers: [], status: "connecting"}`, no `EventSource` constructed) so the test suite loads and executes for real. 11 of 12 tests failed on genuine behavioural assertions (`Cannot read properties of undefined (reading 'fireMessage')` because no `EventSource` instance existed to interact with); 1 passed trivially (`status` is `"connecting"` before any event, which the stub also satisfies). GREEN then replaced the stub body entirely with the real implementation.
- **Verification:** `npm --prefix frontend run test -- usePriceStream` at RED: 11 failed, 1 passed, no import/collection errors; at GREEN: 12 passed
- **Committed in:** `6419a0a` (RED), `64ff673` (GREEN)

---
**Total deviations:** 2 auto-fixed (Rule 1 — both bugs in the test's own approach, discovered while proving Task 1's mandated acceptance criterion), 1 documented TDD-flow note (plan-anticipated tension between "test-first" and "avoid INVALID_RED" for greenfield code, resolved via a stub).
**Impact on plan:** None on scope or architecture — `backend/app/market/stream.py`, `cache.py`, and `models.py` were not modified, exactly as the plan requires; the router-singleton defect uncovered here is the same one CONCERNS.md already tracks for plan 01-03 to fix, not a new one.

## Issues Encountered
None beyond the deviations documented above. The router-singleton defect (deviation #2) is real production behavior worth flagging forward: it is dormant in production (only one `create_app()` call ever happens, at `uvicorn app.main:app` import time) but will bite any *future* test file that also calls `create_app()` more than once in the same pytest session and exercises `/api/stream/prices` on a non-first instance — plan 01-03's fix (move `router = APIRouter(...)` inside `create_stream_router()`) removes this trap entirely.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full spine (engine → cache → FastAPI → SSE → static serving → browser) is proven end to end; plan 01-03 can now fix `stream.py`/`cache.py`/`models.py` (router singleton, empty-cache version bug, session-anchored `change_percent`) against a real, already-working host application instead of dead code.
- `frontend/lib/usePriceStream.ts` and `PriceStreamContext.tsx` are the stable API surface plans 01-04 (watchlist grid, sparklines, main chart) and 01-05 (header, connection dot) build on — per the plan's own scope note, only `page.tsx`'s plain table is expected to be replaced, not the hook or context.
- `uv run --directory backend --extra dev pytest -q` reports 78 passed (73 pre-existing + 5 new); `npm --prefix frontend run test` reports 19 passed (7 pre-existing + 12 new); both `typecheck` and `build` are green.
- No blockers for 01-03 or 01-04.

---
*Phase: 01-live-price-terminal*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 5 created files verified present on disk (`backend/app/main.py`, `backend/tests/test_main.py`, `frontend/lib/usePriceStream.ts`, `frontend/lib/PriceStreamContext.tsx`, `frontend/__tests__/usePriceStream.test.tsx`). All 3 commits (`762d54e`, `6419a0a`, `64ff673`) verified present in git history.

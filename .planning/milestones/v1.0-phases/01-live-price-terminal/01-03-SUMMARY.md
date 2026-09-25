---
phase: 01-live-price-terminal
plan: 03
subsystem: api/backend
tags: [fastapi, sse, pytest, tdd, uvicorn, dataclasses]

requires:
  - phase: 01-live-price-terminal
    provides: "FastAPI app mounting create_stream_router (from 01-02)"
provides:
  - "create_stream_router() builds a fresh APIRouter per call — two calls never share route registrations or price caches"
  - "SSE generator only advances its version bookkeeping once a read actually produces prices, so an empty cache read can never swallow the version generation that would have delivered the first real frame"
  - "SSE generator emits a colon-prefixed keepalive comment after keepalive_interval seconds of silence, configurable via new keyword-only interval/keepalive_interval params on create_stream_router"
  - "backend/tests/market/test_stream.py: first-ever SSE integration coverage (7 tests) via a real, OS-assigned-port uvicorn server, plus a hand-written fake-request test for the disconnect path"
  - "PriceUpdate.session_open_price: a second, independent anchor — change/change_percent read from it; direction still reads previous_price, so the tick flash and the session percentage never share a field"
  - "PriceCache threads a per-ticker session-open dict through its existing lock; remove() clears the entry so a re-added ticker gets a fresh anchor"
affects: [01-04, 01-05]

actuals:
  tokens: 6540
  tasks: 2
  commits: 4
  plan_head_before: 9872379bfe087d190f0a48220ee8d0f2d3108ab1

tech-stack:
  added: []
  patterns:
    - "Router-per-call factory: APIRouter() constructed inside create_stream_router(), not at module scope"
    - "SSE tests against an endless generator use a real uvicorn.Server bound to an OS-assigned port + real-socket httpx.AsyncClient, never httpx.ASGITransport/TestClient — both fully drain the response body before returning anything and deadlock on this generator (re-confirmed empirically this session, consistent with 01-02-SUMMARY.md's identical finding for test_main.py)"
    - "Disconnect-path testing drives the module-private async generator directly with a hand-written fake request double, sidestepping ASGITransport's unreliable http.disconnect propagation entirely"
    - "Version-gate-on-non-empty-read: only record a cache's version as 'seen' after a read that actually produced data"
    - "Dual-anchor price model: previous_price (tick-to-tick, drives direction) vs session_open_price (drives change/change_percent), both threaded through one lock in PriceCache.update()"

key-files:
  created:
    - backend/tests/market/test_stream.py
  modified:
    - backend/app/market/stream.py
    - backend/app/market/models.py
    - backend/app/market/cache.py
    - backend/tests/market/test_models.py
    - backend/tests/market/test_cache.py

key-decisions:
  - "Used a real, OS-assigned-port uvicorn.Server (not httpx.ASGITransport) for every streaming test in test_stream.py except the disconnect test, after empirically reproducing the exact deadlock 01-02-SUMMARY.md documented for the same never-terminating generator — confirmed via a standalone repro script that ASGITransport hangs entering client.stream(...)'s __aenter__ itself, before any line is ever read"
  - "Confirmed the empty-cache version-gating defect's specific failure mode (get_all() called exactly once, no data frame ever arrives) via a direct _generate_events() invocation before touching stream.py, per the plan's explicit instruction to verify that test is red 'for that reason' rather than for an incidental TypeError"
  - "'Session' remains process-lifetime (since the ticker's first update in this running PriceCache), not a calendar day — the assumption RESEARCH.md's Assumptions Log (A1) flagged and left unconfirmed; not resolved by this plan, carried forward as-is"

patterns-established:
  - "Any future test against stream.py's SSE generator must use the real-bound-server pattern in test_stream.py::_running_app, not ASGITransport/TestClient"

requirements-completed: []

coverage:
  - id: D1
    description: "create_stream_router() builds a fresh router per call, gates version bookkeeping on non-empty reads, and emits keepalive comments during silence"
    requirement: "MKT-01"
    verification:
      - kind: integration
        ref: "backend/tests/market/test_stream.py::TestSSEStream (7 tests: retry-directive-first, event delivery, router isolation x2, empty-cache version gating, keepalive, disconnect)"
        status: pass
      - kind: integration
        ref: "backend/tests/test_main.py::TestLifespanSSE::test_first_frame_contains_all_default_tickers (unmodified call site, still green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PriceUpdate.change/change_percent are anchored to session_open_price; direction stays anchored to previous_price; to_dict() keeps its exact seven-key shape"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_models.py::TestPriceUpdate (13 tests, including the disagreeing-anchors case and an explicit to_dict() key-set assertion)"
        status: pass
      - kind: unit
        ref: "backend/tests/market/test_cache.py::TestPriceCache (16 tests, including session-anchor lifecycle: holds across updates, resets on remove+re-add, independent per ticker)"
        status: pass
      - kind: integration
        ref: "uv run --extra dev python -c \"...\" printing sorted(to_dict().keys()) == the seven expected names"
        status: pass
    human_judgment: false

duration: ~13min
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 3: Market-Data Defect Repair Summary

**Per-call SSE router construction with an emptiness-gated version counter and keepalive comments, plus a session-anchored change/change_percent split from the tick-anchored direction — all four ROADMAP.md-assigned market-data defects closed with the subsystem's first SSE integration tests.**

## Performance
- **Duration:** ~13min
- **Started:** 2026-09-17T20:49:47Z (approx, per prior plan's session record)
- **Completed:** 2026-09-17T21:02:17Z
- **Tasks:** 2 completed
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `backend/app/market/stream.py`'s three defects are repaired: `create_stream_router()` now builds a fresh `APIRouter` per call instead of decorating a module-level singleton; the generator's last-seen-version bookkeeping only advances inside the non-empty-prices branch, so an empty cache read can never swallow the version generation that would have delivered the first real frame; and a colon-prefixed keepalive comment now fires after a configurable interval of genuine silence.
- `backend/tests/market/test_stream.py` gives the SSE generator integration coverage for the first time (7 tests): retry-directive ordering, event delivery, router-per-call isolation with no cross-contamination, the empty-cache version-gating fix, keepalive emission, and clean client-disconnect handling.
- Re-discovered and worked around the same `httpx.ASGITransport` deadlock 01-02 already documented for this exact never-terminating generator — confirmed empirically via a standalone repro before writing a single streaming test, then used the same real-bound-uvicorn-server pattern 01-02 established.
- `PriceUpdate` now carries two independent anchors: `previous_price` for `direction` (the MKT-02 tick flash) and a new `session_open_price` for `change`/`change_percent` (the PLAN.md §10 watchlist percentage) — closing the "one field serves two purposes" spec mismatch CONCERNS.md documented, with `to_dict()`'s seven-key shape unchanged so no frontend type changes are required.
- `PriceCache` threads a private per-ticker session-open dict through its existing lock in `update()`, and `remove()` discards the entry so a re-added ticker gets a fresh anchor from its new arrival price.

## Task Commits
1. **Task 1: Cover the SSE generator, then repair its three defects** - `77b9469` (test, RED) → `c538774` (feat, GREEN)
2. **Task 2: Re-anchor change/change_percent to the session open** - `9603bfc` (test, RED) → `95b473e` (feat, GREEN)

No REFACTOR commits were needed for either task — both GREEN implementations needed no follow-up cleanup.

**Plan metadata:** pending (docs: complete plan) — committed after this SUMMARY.

## Files Created/Modified
- `backend/tests/market/test_stream.py` - New: 7 SSE integration tests, a `_running_app` real-uvicorn-server helper, a `_StubCache` test double for the empty-cache defect, and a `_FakeRequest` double for the disconnect path
- `backend/app/market/stream.py` - Router constructed per call; version bookkeeping gated on non-empty reads; keyword-only `interval`/`keepalive_interval` params with unchanged defaults; keepalive comment emission
- `backend/app/market/models.py` - Added required `session_open_price` field; `change`/`change_percent` now read from it; `direction` untouched
- `backend/app/market/cache.py` - Added private `_session_open` dict, threaded through the existing lock in `update()`; `remove()` clears the entry
- `backend/tests/market/test_models.py` - All 11 original constructions updated with `session_open_price`; added the disagreeing-anchors test and an explicit seven-key `to_dict()` assertion
- `backend/tests/market/test_cache.py` - Re-reasoned (not rewritten) the two pre-existing change assertions per the plan's own note; added three new session-lifecycle tests

## Decisions Made
See `key-decisions` in frontmatter above — both concern how the SSE tests were actually made to work against a real, non-terminating generator, and the confirmation methodology for the empty-cache defect's specific failure mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's suggested SSE test transport (`httpx.ASGITransport`) deadlocks entering `client.stream(...)` for every streaming read, not just the disconnect path**
- **Found during:** Task 1, before writing any test against the real router
- **Issue:** The plan's action block says to "keep the transport-based path for the delivery, router-isolation, and keepalive tests, where it works correctly," reserving only the disconnect test for a direct-generator approach. A standalone repro script (`AsyncClient(transport=ASGITransport(app=app))` streaming from a router built over a populated cache) hung inside `client.stream(...)`'s `__aenter__` itself — before any line, even the retry directive, was ever read — and only resolved via `asyncio.timeout` cancellation. This is the identical failure mode `01-02-SUMMARY.md` already documented for this same generator in `test_main.py` (both `ASGITransport` and Starlette's `TestClient` fully drain an ASGI app's response body before returning anything; this generator only completes on disconnect, so both deadlock on any test that doesn't immediately disconnect).
- **Fix:** Used the same real-bound-`uvicorn.Server` + real-socket `httpx.AsyncClient` pattern `test_main.py::TestLifespanSSE` already established, for every streaming test (delivery, both isolation checks, empty-cache gating, keepalive). Only the disconnect test uses the plan's suggested direct-generator-with-fake-request approach, exactly as the plan specifies for that one case.
- **Files modified:** `backend/tests/market/test_stream.py`
- **Verification:** All 7 tests pass; `uv run --directory backend --extra dev pytest tests/market/test_stream.py -v` completes in 1.65s (well inside the 60s ceiling)
- **Commit:** `77b9469`

**2. [Rule 3 - Blocking] Task 2's new required `session_open_price` field broke Task 1's already-committed empty-cache stub test**
- **Found during:** Task 2, immediately after adding the field to `PriceUpdate`
- **Issue:** `test_stream.py::test_empty_cache_version_gating_delivers_once_populated` (committed in Task 1) constructs a `PriceUpdate` directly with the pre-Task-2 four-argument shape; once `models.py` gained a required `session_open_price` field, that construction site raised `TypeError: missing 1 required positional argument`.
- **Fix:** Added `session_open_price=190.00` to that one construction site. Not new behavior — a direct, unavoidable consequence of Task 2's interface change to a type Task 1's test already used.
- **Files modified:** `backend/tests/market/test_stream.py`
- **Verification:** Full backend suite green (89 tests) after the fix
- **Commit:** `95b473e` (bundled with the GREEN implementation commit, since it's a compatibility fix for the new field, not new test coverage)

---
**Total deviations:** 2 auto-fixed (1 Rule 1 — test transport choice, discovered before any test could pass; 1 Rule 3 — a cross-task interface break, fixed within the same task that caused it).
**Impact on plan:** None on scope or architecture. `stream.py`'s three defects, and `models.py`/`cache.py`'s session-anchor split, are exactly what the plan specifies; both deviations are in test-file mechanics, not production behavior.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four market-data repairs ROADMAP.md assigns to this phase are done: router singleton, empty-cache version gating, no SSE keepalive, and the daily-vs-tick-to-tick `change_percent` spec mismatch.
- `backend/app/main.py` is unmodified and still boots; its single-argument `create_stream_router(price_cache)` call site keeps working against the new keyword-only `interval`/`keepalive_interval` defaults.
- `uv run --directory backend --extra dev pytest -q -m "not requires_frontend_build"` reports 89 passed, 1 deselected (90 total collected); this plan added 12 tests net (7 new in `test_stream.py`, 3 new session-lifecycle tests in `test_cache.py`, 2 net new in `test_models.py` after accounting for the renamed zero-session-open test); ruff is clean on all changed files.
- `frontend/lib/types.ts`'s `PriceTick` contract is unaffected — `to_dict()`'s seven-key shape and key names are byte-for-byte identical to before this plan; only the computed values of `change`/`change_percent` changed.
- MKT-01 remains blocked pending 01-04/01-05 (frontend watchlist grid, header/connection dot) per `requirements ready-ids` — this plan's backend repairs are a prerequisite, not the full requirement.
- No blockers for 01-04, which runs next on this same working tree.

---
*Phase: 01-live-price-terminal*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 7 files verified present on disk (`backend/tests/market/test_stream.py`, `backend/app/market/stream.py`, `backend/app/market/models.py`, `backend/app/market/cache.py`, `backend/tests/market/test_models.py`, `backend/tests/market/test_cache.py`, this SUMMARY). All 4 commits (`77b9469`, `c538774`, `9603bfc`, `95b473e`) verified present in git history.

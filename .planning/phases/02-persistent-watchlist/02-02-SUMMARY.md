---
phase: 02-persistent-watchlist
plan: 02
subsystem: watchlist
tags: [fastapi, sqlite, pydantic, react, tdd, market-data]

requires:
  - phase: 02-persistent-watchlist/02-01
    provides: SQLite schema + init_db(), GET /api/watchlist, app/api/watchlist.py router factory, app/market/ticker.py normalize_ticker()/is_valid_ticker_format(), FakeMarketDataSource test double, useWatchlist() hook wired into Watchlist.tsx
provides:
  - "POST /api/watchlist — validates, persists, and notifies the market source (201/400/409)"
  - "add_watchlist_ticker() repository function with UNIQUE-constraint -> ValueError translation"
  - "Ticker normalization at every MarketDataSource entry point in both SimulatorDataSource and MassiveDataSource (CONCERNS.md repair)"
  - "Add-ticker form in the watchlist panel: client-side empty-input rejection, in-flight disabled/'Adding…' state, verbatim server-error rendering, post-success refetch"
affects: [02-03-remove-ticker, phase-04-llm-chat]

actuals:
  tokens: 7440
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "RED/GREEN as separate commits per task: a repository-level RED test needs the target function to exist for collection, so the RED commit adds a `raise NotImplementedError` stub (+ barrel export) rather than leaving the import unresolved — the test then fails on the stub's exception, not at collection time"
    - "API-level RED tests need no stub at all: POSTing to a route that isn't registered yet returns 405, which is itself a genuine assertion failure on the named behavior (asserting 201, getting 405)"
    - "Panel border/background classes moved from <table> to a wrapper <div> — a <form> cannot be a child of <table> before <thead>, so the add-ticker form and the table are now siblings inside one bordered panel"

key-files:
  created:
    - backend/tests/db/test_repository.py
  modified:
    - backend/app/db/repository.py
    - backend/app/db/__init__.py
    - backend/app/api/watchlist.py
    - backend/app/market/simulator.py
    - backend/app/market/massive_client.py
    - backend/tests/api/test_watchlist.py
    - backend/tests/market/test_simulator_source.py
    - backend/tests/market/test_massive.py
    - frontend/components/Watchlist.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "Repository-level RED tests use a `raise NotImplementedError` stub (added in the RED commit) rather than leaving add_watchlist_ticker undefined — an undefined import would fail at collection time (INVALID_RED per this project's TDD gate), while the stub lets the named test fail on the actual planned-behavior assertion"
  - "The malformed-ticker error echoes the user's raw (pre-normalization) input, not the normalized value — matches 02-RESEARCH.md's assumption A2 ('echoing back exactly what the user typed reads more naturally'), made deliberately per the plan's instruction"
  - "For an empty/whitespace-only POST body (`{\"ticker\": \"\"}` / `{\"ticker\": \"   \"}`), the raw value is still echoed through the same malformed-format error string even though the UI-SPEC's dedicated 'Enter a ticker symbol to add it.' copy is explicitly client-side-only with no server-side equivalent specified — the resulting message reads slightly awkwardly (leading/no visible token before 'isn't a valid ticker'), but the plan's acceptance criteria only require an `error` key with a human-readable string, and the client-side check already prevents this path from being reachable through the actual form"
  - "Watchlist.tsx's panel border/background classes moved from the <table> element to a new wrapper <div> — a <form> is not valid HTML as a direct child of <table> before <thead>, so the add-ticker form had to become a sibling of the table rather than a row inside it; verified against all three pre-existing Watchlist-level test assertions (row counts, price-cell content), none of which depend on where the border classes live"
  - "The inline error paragraph (`watchlist-add-error`) always renders in the DOM (empty when there is no error, styled `empty:hidden` for a real browser), rather than being conditionally mounted — this makes 'error slot is empty after a successful add' a `toHaveTextContent('')` assertion instead of an existence check, and avoids a flash-of-missing-element on the very first error"

requirements-completed: [WTCH-01]

coverage:
  - id: D1
    description: "POST /api/watchlist adds a valid new ticker (also lowercase/whitespace-padded), persists exactly one row, and notifies the market source exactly once"
    requirement: WTCH-01
    verification:
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestAddWatchlist (5 add-path tests)"
        status: pass
      - kind: unit
        ref: "backend/tests/db/test_repository.py::TestAddWatchlistTicker (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A duplicate ticker returns 409, the row count is unchanged, and the market source is not notified"
    requirement: WTCH-01
    verification:
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestAddWatchlist (3 duplicate-path tests) + test_repository.py's duplicate ValueError tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "Over-length, non-alphanumeric, empty, and whitespace-only tickers each return 400 with an error key, leave the row count unchanged, and do not notify the market source"
    requirement: WTCH-01
    verification:
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestAddWatchlist (6 malformed-path tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both SimulatorDataSource and MassiveDataSource normalize tickers at every MarketDataSource entry point (start/add_ticker/remove_ticker), keying identically regardless of case or padding"
    verification:
      - kind: unit
        ref: "backend/tests/market/test_simulator_source.py + test_massive.py, -k normal (5 tests total)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The add-ticker form: renders with exact placeholder/label copy, rejects empty/whitespace-only input client-side with no network call, shows the server error verbatim on failure, disables input+button with 'Adding…' while in flight, and clears input+error on success (calling refetch exactly once)"
    requirement: WTCH-01
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::describe('Watchlist add-ticker form') (7 tests)"
        status: pass
      - kind: unit
        ref: "npm --prefix frontend run typecheck"
        status: pass
    human_judgment: false
  - id: D6
    description: "No client-side maxLength cap on the ticker input, so an over-length entry actually reaches the server and exercises the 400 rejection path (ROADMAP success criterion 4)"
    verification:
      - kind: automated_ui
        ref: "grep check: ! grep -qE 'maxLength[[:space:]]*=' frontend/components/Watchlist.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "User visually sees the add-ticker button read 'Adding…' with purple styling, the inline error render below the form (not a toast), and the new row appear in the grid after a successful add — actual rendered appearance in a browser"
    verification: []
    human_judgment: true
    rationale: "Requires visually observing the running app in a browser, which this executor cannot do; the Vitest-level assertions on disabled/text-content state and the Next.js production build (which succeeded and exported index.html) support the assumption but do not substitute for a human's visual confirmation of styling and layout in the actual rendered UI."

duration: ~13min
completed: 2026-09-18
status: complete
---

# Phase 02 Plan 02: Add-Ticker Summary

**`POST /api/watchlist` (validate → persist → notify), shared ticker normalization repaired across both `MarketDataSource` implementations, and an add-ticker form wired end-to-end in the watchlist panel — all three tasks built RED-then-GREEN with separate commits per phase.**

## Performance
- **Duration:** ~13min
- **Started:** 2026-09-18T07:27:21Z (approx, right after 02-01's completion commit)
- **Completed:** 2026-09-18T07:39:44Z
- **Tasks:** 3 completed
- **Files modified:** 11 (1 created, 10 modified)

## Accomplishments
- `POST /api/watchlist` now validates (normalize → 1-5 alphanumeric format gate), persists via a new `add_watchlist_ticker()` repository function inside an explicit transaction, and notifies the running market data source — with strict load-bearing ordering so no rejected or duplicate ticker ever reaches the database or the market source
- Repaired the CONCERNS.md "ticker normalization diverges" finding: `SimulatorDataSource` previously normalized nowhere, `MassiveDataSource` normalized inline in two of its three entry points — both now route every ticker through the shared `normalize_ticker()` helper at `start`/`add_ticker`/`remove_ticker`
- The watchlist panel gained its first interactive control: a `<form>` (input + purple "Add Ticker" submit button) that rejects empty input client-side, shows an in-flight "Adding…" disabled state, renders the server's error string verbatim on failure, and clears itself + triggers a `GET /api/watchlist` refetch on success

## Task Commits
1. **Task 1 RED: failing tests for POST /api/watchlist** - `481be86` (test)
2. **Task 1 GREEN: implement POST /api/watchlist** - `651688b` (feat)
3. **Task 2 RED: failing tests for ticker normalization** - `b569d50` (test)
4. **Task 2 GREEN: normalize tickers at every entry point** - `ea18e27` (feat)
5. **Task 3 RED: failing tests for the add-ticker form** - `dc323b4` (test)
6. **Task 3 GREEN: add-ticker form in the watchlist panel** - `3b0620c` (feat)

## Files Created/Modified
- `backend/app/db/repository.py` - `add_watchlist_ticker(ticker) -> dict`: bound-parameter INSERT inside `with conn:`, translates `sqlite3.IntegrityError` into `ValueError` naming the ticker
- `backend/app/db/__init__.py` - barrel export gains `add_watchlist_ticker`
- `backend/app/api/watchlist.py` - `WatchlistAddRequest` pydantic model + `POST /watchlist` route (normalize → format-gate → persist → notify → 201/400/409)
- `backend/app/market/simulator.py` - `SimulatorDataSource.start/add_ticker/remove_ticker` now normalize via the shared helper
- `backend/app/market/massive_client.py` - inline `.upper().strip()` replaced by `normalize_ticker()`; `start()` now normalizes too (previously didn't)
- `backend/tests/db/test_repository.py` - new file: 4 tests covering insert shape, row count, duplicate `ValueError`
- `backend/tests/api/test_watchlist.py` - `TestAddWatchlist`: 14 tests (add/duplicate/malformed × status, persistence, notification)
- `backend/tests/market/test_simulator_source.py` - 3 new `normal`-named tests
- `backend/tests/market/test_massive.py` - 1 new `normal`-named test (`start()`'s gap)
- `frontend/components/Watchlist.tsx` - wrapper `<div>` (panel classes moved off `<table>`), new `<form>` above the table, local `useState` for input/submitting/error, `addWatchlistTicker()` + `refetch()` wiring
- `frontend/__tests__/Watchlist.test.tsx` - second `vi.mock` (`@/lib/api`), hoisted `refetch` in `mockUseWatchlist`, new `describe("Watchlist add-ticker form")` block (7 tests)

## Decisions Made
- Repository-level RED tests needed `add_watchlist_ticker` to exist for pytest collection to succeed at all; rather than leave the import unresolved (an `INVALID_RED` per this project's TDD gate — collection failures don't count), the RED commit added a `raise NotImplementedError` stub plus its barrel export, so the named tests fail on the stub's exception (the planned behavior not yet existing), not on a collection-wide `ImportError`. API-level RED tests needed no such scaffolding: POSTing to an unregistered route returns 405, a genuine assertion failure on the named behavior with zero production-code changes.
- Malformed-ticker error messages echo the user's raw, pre-normalization input (per 02-RESEARCH.md's assumption A2) — including for the empty/whitespace-only case, where the UI-SPEC's dedicated client-side-only copy ("Enter a ticker symbol to add it.") has no server-side equivalent specified. The resulting server-side message for that edge case reads a little awkwardly, but it satisfies the plan's actual acceptance criterion (an `error` key with a human-readable string) and the form's own client-side check means this path is never reachable through normal UI use.
- `Watchlist.tsx`'s bordered-panel classes moved from the `<table>` element to a new wrapper `<div>`, because HTML does not permit a `<form>` as a child of `<table>` before `<thead>`. Verified this doesn't perturb any of 02-01's three pre-existing `Watchlist`-level test assertions (row-role counts, price-cell text content) — none depend on which element carries the border/background classes.
- The inline error paragraph always renders in the DOM (empty string when there's no error), rather than being conditionally mounted only when an error exists — makes "cleared after success" a content assertion rather than an existence check, and gives the element a stable mount point per the UI-SPEC's "persists until next submit or successful add" framing.

## Deviations from Plan

None — plan executed exactly as written for the files in its own `files_modified` list. The RED-phase repository stub (a small addition to `repository.py`/`__init__.py` inside the test commit) is a TDD-mechanics choice within Task 1's own scope, not a deviation from the plan's described behavior — the GREEN commit fully implements the function per the plan's `<action>` text.

### TDD Gate Compliance

All three tasks carried `tdd="true"`. `workflow.tdd_mode` is `false` for this project (strict gate-blocking enforcement is off), but this plan followed the full RED→GREEN discipline with separate commits for every task — improving on 02-01's Task 3, which combined RED and GREEN into a single commit (documented as a gap in that plan's own SUMMARY). For each task: the RED commit's named tests were run and confirmed to fail on the planned-behavior assertion (405 for API-level tests against an unregistered route; `NotImplementedError`/missing-element failures for repository- and frontend-level tests) before the GREEN commit was written; the GREEN commit's tests were then run and confirmed to pass. No REFACTOR commits were needed — each GREEN implementation was clean on first pass (ruff/typecheck both clean, no follow-up cleanup identified).

---
**Total deviations:** 0 auto-fixes, 0 process deviations.
**Impact on plan:** None — this plan improves on the prior plan's documented TDD commit-cadence gap rather than repeating it.

## Issues Encountered

None. All automated `<verify>` commands in all three tasks passed on first run after the GREEN implementation. The plan-level `<verification>` block (full backend suite: 119 passed; full frontend suite: 63 passed across 6 files; both ruff and typecheck clean) also passed cleanly with no follow-up fixes needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-03 (remove ticker, WTCH-02) can build directly on this plan's pattern: `remove_watchlist_ticker()` in `repository.py` (404-on-absent instead of 409-on-duplicate), `DELETE /api/watchlist/{ticker}` on the same router, and the per-row remove affordance in `WatchlistRow.tsx` per the UI-SPEC's already-approved `data-testid="remove-{ticker}"` / `aria-label` spec.
- 02-03 must also add `frontend/app/page.tsx`'s `selectedTicker`-reset-on-removal guard (02-RESEARCH.md Pattern 4) — this plan's add-ticker form makes the watchlist grow but does not yet make it shrink through any UI action, so that guard remains correctly inert until 02-03 ships the remove button.
- WTCH-01 is functionally complete after this plan: a user can add a ticker through the UI, watch it validated, persisted, and streamed within seconds, with malformed/duplicate/empty input all rejected with a visible message and no state change.
- No blockers.

---
*Phase: 02-persistent-watchlist*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 11 claimed key-files verified present on disk; all 6 claimed commit hashes (`481be86`, `651688b`, `b569d50`, `ea18e27`, `dc323b4`, `3b0620c`) verified present in git history.

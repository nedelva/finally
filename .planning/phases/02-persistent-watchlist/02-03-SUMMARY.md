---
phase: 02-persistent-watchlist
plan: 03
subsystem: watchlist
tags: [fastapi, sqlite, react, tdd, market-data, accessibility]

requires:
  - phase: 02-persistent-watchlist/02-01
    provides: SQLite schema + init_db(), GET /api/watchlist, app/api/watchlist.py router factory, app/market/ticker.py normalize_ticker(), FakeMarketDataSource test double
  - phase: 02-persistent-watchlist/02-02
    provides: POST /api/watchlist (add), add_watchlist_ticker() repository pattern, add-ticker form in Watchlist.tsx, ticker normalization at every MarketDataSource entry point
provides:
  - "DELETE /api/watchlist/{ticker} — validates presence, deletes the watchlist row only, notifies the market source, returns 204/404"
  - "remove_watchlist_ticker() repository function returning bool via cursor.rowcount"
  - "Per-row remove affordance (× button) in WatchlistRow.tsx with stopPropagation guarding the row's click-to-chart selection"
  - "Watchlist empty state (\"Watchlist is empty\") replacing the table when the grid has zero entries, add-ticker form still visible"
  - "page.tsx selection guard: the main chart never stays pointed at a ticker that has left the watchlist"
affects: [phase-03-portfolio, phase-04-llm-chat]

actuals:
  tokens: 6681
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "DELETE route mirrors the POST handler's ordering: normalize -> delete (no notify on a no-op absent delete) -> notify the market source -> 204/404"
    - "Repository absence-as-bool convention extended to delete: remove_watchlist_ticker() reads cursor.rowcount rather than raising, matching add_watchlist_ticker()'s ValueError-on-duplicate as the paired 'route decides the status code' contract"
    - "A second, independent useWatchlist() call in page.tsx's Terminal() (not threaded through props/context) — both the grid and the chart-selection guard read the same REST-backed list without a shared provider, since the underlying hook is cheap and self-contained"
    - "Failed DELETE reuses the existing add-ticker inline error slot (watchlist-add-error) rather than inventing a second error-rendering mechanism — resolves the plan's own backstop item"

key-files:
  created: []
  modified:
    - backend/app/db/repository.py
    - backend/app/db/__init__.py
    - backend/app/api/watchlist.py
    - backend/tests/db/test_repository.py
    - backend/tests/api/test_watchlist.py
    - frontend/components/WatchlistRow.tsx
    - frontend/components/Watchlist.tsx
    - frontend/app/page.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "The empty state replaces the entire <table> element (header included), not just <tbody> — 'in place of the table body' interpreted as replacing the list rendering wholesale, since no test or UI-SPEC line requires the header row to persist with zero data rows, and a header with five unlabeled/blank cells over nothing adds no value"
  - "A failed DELETE reuses the add-ticker form's existing inline error paragraph (watchlist-add-error) rather than a new error slot — the plan's own must_haves flagged this as an undesigned backstop item and instructed reuse of what already exists"
  - "page.tsx's new effect derives watchlistTickers via a fresh .map() every render (not memoized) — the effect's guard (selectedTicker set AND not in the list) is idempotent, so a changing array reference on unrelated re-renders causes no observable loop or extra state changes; memoizing was not required by the plan and would add complexity for no behavior change at this scale"

requirements-completed: [WTCH-02]

coverage:
  - id: D1
    description: "DELETE /api/watchlist/{ticker} removes exactly one watchlist row, notifies the market source, and returns 204 with no body; an absent/already-removed ticker returns 404 with an error key and changes nothing (repeat-delete safety)"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestRemoveWatchlist (9 tests)"
        status: pass
      - kind: unit
        ref: "backend/tests/db/test_repository.py::TestRemoveWatchlistTicker (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A lowercase path segment (DELETE /api/watchlist/pypl) resolves to and removes the uppercase ticker"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestRemoveWatchlist::test_remove_lowercase_path_segment_removes_the_uppercase_ticker"
        status: pass
    human_judgment: false
  - id: D3
    description: "Removing a ticker never touches positions, trades, portfolio_snapshots, or chat_messages — the DELETE statement targets the watchlist table only"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestRemoveWatchlist::test_remove_does_not_touch_positions_trades_snapshots_or_chat_messages"
        status: pass
      - kind: unit
        ref: "uv run --directory backend --extra dev ruff check --select S608 app/db/repository.py"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each watchlist row renders a remove button (data-testid=remove-{ticker}, aria-label='Remove {ticker} from watchlist'); clicking it calls removeWatchlistTicker then refetch, and does NOT fire the row's onSelect (stopPropagation)"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::describe('WatchlistRow remove affordance') (4 tests) + describe('Watchlist remove wiring') (2 tests)"
        status: pass
      - kind: unit
        ref: "grep check: stopPropagation present in WatchlistRow.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "An emptied watchlist (0 entries) renders the 'Watchlist is empty' / 'Add a ticker above to start streaming its price.' copy in place of the table, with the add-ticker form still visible above it"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::describe('Watchlist')::'renders the empty state and keeps the add-ticker form visible when there are no entries'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The main chart's selection moves off a ticker that leaves the watchlist (to the first remaining ticker, or undefined if none remain) and does not move when the selected ticker is still present — page.tsx's second effect, independent from the existing SSE-driven auto-select effect"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::describe('Page selection guard on watchlist removal') (3 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "User visually sees the × glyph rendered in the down-red color, the empty-state copy centered and legible, and a click on the glyph removing the row with no visible flash/flicker or accidental chart selection — actual rendered appearance and interaction feel in a browser"
    verification: []
    human_judgment: true
    rationale: "Requires visually observing the running app in a browser, which this executor cannot do; the Vitest-level assertions on DOM structure, stopPropagation, and the successful Next.js production build support the assumption but do not substitute for a human's visual/interaction confirmation."

duration: ~20min
completed: 2026-09-18
status: complete
---

# Phase 02 Plan 03: Remove-Ticker Summary

**`DELETE /api/watchlist/{ticker}` (204/404, watchlist-table-only deletion), a stopPropagation-guarded per-row `×` remove button, a "Watchlist is empty" state, and a `page.tsx` selection guard that moves the main chart off a ticker the moment it leaves the watchlist — closing the last open loop from the tracer.**

## Performance
- **Duration:** ~20min
- **Started:** 2026-09-18 (immediately after 02-02's completion)
- **Completed:** 2026-09-18
- **Tasks:** 2 completed
- **Files modified:** 9 (0 created, 9 modified)

## Accomplishments
- `DELETE /api/watchlist/{ticker}` mirrors the `POST` handler's load-bearing ordering (normalize -> delete -> notify) so a rejected/no-op delete never reaches the market source; `remove_watchlist_ticker()` targets the `watchlist` table exclusively, verified by an explicit test that `positions`/`trades`/`portfolio_snapshots`/`chat_messages` all remain at zero rows after a removal
- The watchlist grid gained its first destructive action: a fifth per-row cell with a `×` button that removes immediately (no confirmation dialog, per the app-wide zero-friction philosophy), guarded by `event.stopPropagation()` so it never also fires the row's existing click-to-chart selection
- An emptied watchlist now explains itself (`"Watchlist is empty" / "Add a ticker above to start streaming its price."`) instead of rendering a table with no rows, and `page.tsx` gained a second, independent effect that moves the chart's selection off a ticker the instant it leaves the watchlist — closing the gap 02-01 and 02-02 both deliberately left inert until this plan

## Task Commits
1. **Task 1 RED: failing tests for DELETE /api/watchlist/{ticker}** - `125d097` (test)
2. **Task 1 GREEN: implement DELETE /api/watchlist/{ticker}** - `d75febe` (feat)
3. **Task 2 RED: failing tests for the remove affordance and selection guard** - `565acaf` (test)
4. **Task 2 GREEN: per-row remove affordance, empty state, and selection guard** - `babcf00` (feat)

## Files Created/Modified
- `backend/app/db/repository.py` - `remove_watchlist_ticker(ticker) -> bool`: bound-parameter `DELETE` inside `with conn:`, returns `cursor.rowcount > 0`
- `backend/app/db/__init__.py` - barrel export gains `remove_watchlist_ticker`
- `backend/app/api/watchlist.py` - `DELETE /watchlist/{ticker}` route (normalize -> delete -> 404-with-error-key or notify+204)
- `backend/tests/db/test_repository.py` - `TestRemoveWatchlistTicker` (4 tests)
- `backend/tests/api/test_watchlist.py` - `TestRemoveWatchlist` (9 tests: 204 happy path, lowercase normalization, 404 absent, repeat-delete safety, other-tables-untouched)
- `frontend/components/WatchlistRow.tsx` - `WatchlistRowProps.onRemove`; fifth `<td>` with a `stopPropagation`-guarded `×` button (`data-testid="remove-{ticker}"`, `aria-label="Remove {ticker} from watchlist"`)
- `frontend/components/Watchlist.tsx` - fifth (unlabeled) `<th>`; `handleRemove()` wired to `removeWatchlistTicker()` -> `refetch()`, reusing the existing inline error slot on failure; empty-state branch (`data-testid="watchlist-empty"`) replacing the table when `watchlist.length === 0`
- `frontend/app/page.tsx` - `Terminal()` calls `useWatchlist()` and gains a second `useEffect` that clears/moves a selection no longer present in the watchlist, independent of the existing SSE-driven auto-select effect
- `frontend/__tests__/Watchlist.test.tsx` - `removeWatchlistTicker` added to the `@/lib/api` mock; new describe blocks: `WatchlistRow remove affordance` (4), `Watchlist` gains 2 (five-header-cells, empty-state), `Watchlist remove wiring` (2), `Page selection guard on watchlist removal` (3)

## Decisions Made
- The empty state replaces the whole `<table>` (including the header row), not just `<tbody>` — the plan's "in place of the table body" phrasing doesn't require preserving five now-meaningless header cells over zero rows, and no test or UI-SPEC line depends on the header surviving into the empty state.
- A failed `DELETE` reuses the add-ticker form's existing `watchlist-add-error` paragraph rather than introducing a second error-rendering mechanism — directly resolves the plan's own flagged backstop item ("no UI treatment specified for a failed DELETE... do not invent a new error-rendering mechanism").
- `page.tsx`'s new effect derives `watchlistTickers` via a fresh `.map()` on every render rather than memoizing it. The effect's own guard (`selectedTicker` set AND not present in the list) is idempotent, so a changing array reference on an unrelated re-render triggers the effect body but never produces an observable state change or render loop — memoizing would add a `useMemo` for no behavior difference at this scale.

## Deviations from Plan

None — plan executed exactly as written for the files in its own `files_modified` list. Both tasks followed the full RED-then-GREEN discipline with separate commits (extending 02-02's improvement over 02-01's Task 3 gap).

### TDD Gate Compliance

Both tasks carried `tdd="true"`. `workflow.tdd_mode` is `false` for this project (strict gate-blocking enforcement is off), but this plan followed the full RED->GREEN discipline with separate commits for both tasks, matching 02-02's standard. For Task 1: the RED commit's API-level tests intentionally failed because the route didn't exist yet (falling through to Starlette's generic 404, distinct from the route's own `{"error": ...}` 404 body), and the repository-level tests failed on a `raise NotImplementedError` stub — 10 of 13 new tests failed on the target behavior pre-GREEN; the remaining 3 ("does not change/notify/touch other tables") passed vacuously since nothing existed yet to change, which is expected and consistent with 02-02's own documented pattern for "no-op" assertions. For Task 2: 9 of 11 new tests failed pre-GREEN (missing button, missing empty state, missing selection guard); the 2 that passed vacuously ("still fires onSelect when clicking elsewhere" and "does not change the selection when the ticker is still present") assert unchanged pre-existing behavior. Both RED states were confirmed via an actual pytest/vitest run before writing any implementation, and both GREEN states were confirmed via a full re-run after.

---
**Total deviations:** 0 auto-fixes, 0 process deviations.
**Impact on plan:** None.

## Issues Encountered

None. All automated `<verify>` commands in both tasks passed on first run after the GREEN implementation. The plan-level `<verification>` block (full backend suite: 132 passed; full frontend suite: 74 passed across 6 files; both ruff and typecheck clean; production build succeeded and exported `index.html` containing "FinAlly") also passed cleanly with no follow-up fixes needed. No REFACTOR commits were needed — both GREEN implementations were clean on first pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WTCH-02 is complete: a user can remove a ticker through the UI, the row disappears immediately, the ticker stops streaming, and the main chart never stays frozen on a ticker that has left the watchlist.
- With 02-01, 02-02, and 02-03 all landed, all four of Phase 02's ROADMAP success criteria hold: (1) a user can add a ticker and see it stream within seconds, (2) removing a ticker makes it disappear and stop updating, (3) a page reload shows the user's own persisted watchlist, and (4) malformed/duplicate/empty input is rejected with a visible message and no state change.
- **Phase 02 is complete pending orchestrator-level verification** (`/gsd-verify-work`). This is the last plan in the phase — no further plans are queued under `02-persistent-watchlist`.
- No blockers. Phase 3 (portfolio) can build directly on the now-complete watchlist CRUD surface and the `positions`/`trades`/`portfolio_snapshots` tables already created (empty, untouched) by 02-01's schema.

---
*Phase: 02-persistent-watchlist*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 9 claimed key-files verified present on disk; all 4 claimed commit hashes (`125d097`, `d75febe`, `565acaf`, `babcf00`) verified present in git history.

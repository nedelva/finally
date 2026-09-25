---
phase: 02-persistent-watchlist
plan: 04
subsystem: ui
tags: [react, vitest, watchlist, error-handling, gap-closure]

# Dependency graph
requires:
  - phase: 02-persistent-watchlist
    provides: "Watchlist.tsx component and useWatchlist() hook (plans 02-01/02-02/02-03)"
provides:
  - "Watchlist.tsx renders three visually distinct load states (loading, load-error, genuine-empty) ahead of the populated table"
  - "Regression coverage proving the hook's load-error slot and the component's local add/remove-error slot never collide"
affects: [frontend-watchlist, uat-phase-02]

# Actuals (#2632)
actuals:
  tokens: 2323
  tasks: 1
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared <thead> JSX extracted into a local `tableHead` variable so two render branches (loading, populated) stay byte-identical instead of drifting apart"
    - "Hook value renamed at destructure site (`error: loadError`) to avoid colliding with a pre-existing same-named local state variable"

key-files:
  created: []
  modified:
    - frontend/components/Watchlist.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "loadError takes precedence over a populated table on a failed refetch (deliberate trade-off recorded in the plan's own <objective>, not an oversight)"
  - "No REFACTOR commit — the GREEN implementation was already minimal and matched the plan's action text exactly, nothing to clean up"

patterns-established:
  - "3/4-way load-state precedence (loading -> loadError -> empty -> populated) as the template for future hook-backed list components in this codebase"

requirements-completed: [WTCH-01, WTCH-02]

coverage:
  - id: D1
    description: "Loading state shows the table shell (thead + panel) immediately with a single full-width loading row, no skeleton swap, no layout jump"
    requirement: WTCH-01
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx#shows the table shell with a loading row, and hides both empty and load-error states, while the initial fetch is in flight"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed initial GET /api/watchlist surfaces the hook's error verbatim in a dedicated watchlist-load-error slot, distinct from the genuine-empty state"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx#shows the hook's error verbatim in its own slot, hiding the empty state, when the initial fetch fails"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed refetch over a previously-populated watchlist shows load-error ahead of the stale populated table (declared precedence trade-off)"
    requirement: WTCH-02
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx#shows the load-error state ahead of a populated table when a later refetch fails with stale data present"
        status: pass
    human_judgment: false
  - id: D4
    description: "'Watchlist is empty' still renders only on genuine empty (loading false, error null, zero entries) — regression guard"
    requirement: WTCH-01
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx#still renders the genuine empty state when loading is false and there is no load error"
        status: pass
    human_judgment: false
  - id: D5
    description: "The hook's load-error slot is never cleared by, or bled into by, the component's local add-ticker error slot"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx#does not clear the hook's load-error slot when a successful add-ticker submit clears the local add-error slot"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-19
status: complete
---

# Phase 02 Plan 04: Watchlist Load-State Precedence Summary

**Watchlist.tsx now reads `loading`/`error` from `useWatchlist()` and renders three distinct states (loading, load-error, genuine-empty) instead of silently collapsing every non-populated case into the same empty-state copy.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-19T12:10:00Z
- **Completed:** 2026-09-19T12:35:00Z
- **Tasks:** 1 (TDD task: RED + GREEN, no REFACTOR needed)
- **Files modified:** 2

## Accomplishments
- Closed G-02-1: reloading with a healthy backend now shows the table shell (header, borders) from first paint via a shared `tableHead` extraction, with a single `watchlist-loading` row inside the same table — no skeleton swap, no layout jump
- Closed G-02-3: a failed initial (or subsequent) `GET /api/watchlist` now surfaces the hook's verbatim error message in a dedicated `watchlist-load-error` slot, instead of rendering byte-identically to a genuine empty watchlist
- Added 4 new regression tests plus extended `mockUseWatchlist()` with a backward-compatible `overrides` parameter; full frontend suite (81 tests, 6 files) passes

## Task Commits

TDD task, RED then GREEN (no REFACTOR — implementation matched the plan's action text with nothing to clean up):

1. **Task 1 RED: add failing coverage** - `e561c96` (test)
2. **Task 1 GREEN: implement 4-way precedence** - `57a30a6` (feat)

**Plan metadata:** committed as part of this SUMMARY (worktree mode — STATE.md/ROADMAP.md updated centrally by the orchestrator after merge)

## Files Created/Modified
- `frontend/components/Watchlist.tsx` - Destructures `loading`/`error: loadError` from `useWatchlist()`; extracts shared `<thead>` into `tableHead`; replaces the 2-way empty/populated branch with a 4-way `loading -> loadError -> empty -> populated` precedence
- `frontend/__tests__/Watchlist.test.tsx` - `mockUseWatchlist()` gains an optional third `overrides: { loading?, error? }` parameter (default `{}`, preserving existing call sites byte-for-byte); adds loading/load-error/stale-data-precedence/regression/error-independence test cases

## Decisions Made
- `loadError` deliberately takes precedence over a populated table on a failed `refetch()` — this is the plan's own declared trade-off (see PLAN.md `<objective>`), not something decided ad hoc during execution. A "keep stale data, show error as a toast" alternative was explicitly out of scope.
- No REFACTOR commit: the GREEN implementation (destructure rename + `tableHead` extraction + 4-way ternary chain) was already minimal and required no cleanup pass.

## Deviations from Plan

None - plan executed exactly as written. `frontend/lib/hooks.ts` diff is empty, confirming the scope boundary held.

## Issues Encountered
- The worktree had no `frontend/node_modules` installed (worktrees don't share gitignored install state with the main checkout). Ran `npm ci` in `frontend/` before the first test run — not a plan deviation, just environment setup required to execute the plan's own `<verify>` commands.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- G-02-1 and G-02-3 are closed; Watchlist.tsx's three load states are ready for the UAT re-check described in the plan's `<verification>` section (manual reload-against-healthy-backend and kill-backend-and-reload checks)
- No blockers for phase verification

---
*Phase: 02-persistent-watchlist*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: frontend/components/Watchlist.tsx
- FOUND: frontend/__tests__/Watchlist.test.tsx
- FOUND commit: e561c96 (RED)
- FOUND commit: 57a30a6 (GREEN)

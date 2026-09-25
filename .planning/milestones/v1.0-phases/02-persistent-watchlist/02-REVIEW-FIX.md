---
phase: 02-persistent-watchlist
fixed_at: 2026-09-18T11:30:43Z
review_path: .planning/phases/02-persistent-watchlist/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-09-18T11:30:43Z
**Source review:** .planning/phases/02-persistent-watchlist/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 4
- Fixed: 4
- Skipped: 0

All four in-scope findings (1 critical, 3 warnings) applied cleanly against
the current source and matched the review's description of the code. Info
findings (IN-01, IN-02, IN-03) are out of scope for this fix pass
(`fix_scope: critical_warning`).

## Fixed Issues

### CR-01: Selection-guard effects in page.tsx can enter a permanent ping-pong loop when the watchlist becomes empty

**Files modified:** `frontend/app/page.tsx`, `frontend/__tests__/Watchlist.test.tsx`
**Commit:** `bb74452`
**Applied fix:** Merged the two separate `useEffect`s into a single effect that derives the target selection from both the SSE-derived `tickers` set (monotonically grows) and the REST-derived `watchlist` set (can shrink to empty) in one pass, per the review's suggested shape. The new guard checks watchlist membership directly, so "no valid selection" can never re-trigger a selection of a ticker outside the current watchlist — breaking the ping-pong cycle. Also extended `Watchlist.test.tsx` with a new regression test that fires an SSE tick (via `FakeEventSource.fireMessage`) before removing the last watchlist entry — reproducing the exact interaction the review identified as untested by the pre-existing "watchlist becomes empty" test (which never emitted an SSE tick, so it couldn't reach the ping-pong state). A regressed version of the fix would throw React's "Maximum update depth exceeded" in this test rather than settle into the empty state.

### WR-01: Watchlist route handlers don't handle market-source notify failures, risking DB/cache desync

**Files modified:** `backend/app/api/watchlist.py`, `backend/tests/api/conftest.py`, `backend/tests/api/test_watchlist.py`
**Commit:** `9deca82` (fix), `ad52443` (tests)
**Applied fix:** Wrapped both `market_source.add_ticker()` and `market_source.remove_ticker()` calls in `try/except Exception`, per option (b) in the review's fix suggestion: log the failure (`logger.exception`) and still return the success response (201 / 204), since the DB write/delete has already committed by that point. Documented in the exception-handler comments that the price stream self-heals on the next process restart (lifespan reads tickers straight from the DB). Added a `fail_notify` flag to the existing `FakeMarketDataSource` test double plus a `failing_market_source`/`client_with_failing_notify` fixture pair, and four new tests asserting the add/remove routes still return success and still persist/delete the row when the market-source notify call raises.

### WR-02: Keyboard activation of the remove button also fires row selection

**Files modified:** `frontend/components/WatchlistRow.tsx`, `frontend/__tests__/Watchlist.test.tsx`
**Commit:** `f9a4e7f`
**Applied fix:** Added an `onKeyDown` handler to the remove `<button>` that calls `event.stopPropagation()`, mirroring the existing `onClick` handler's `stopPropagation()` — exactly the review's suggested fix. This stops the `<tr>`'s delegated-bubbling `onKeyDown` (Enter/Space → `select()`) from also firing when a keyboard user activates the nested remove button. Added a regression test that focuses the remove button and presses Enter, asserting `onRemove` fires and `onSelect` does not.

### WR-03: `GBMSimulator.add_ticker` can leave `_cholesky` dimension out of sync with `_tickers`, silently halting all price updates

**Files modified:** `backend/app/market/simulator.py`, `backend/tests/market/test_simulator.py`
**Commit:** `70072a5`
**Applied fix:** Guarded `_rebuild_cholesky()`'s `np.linalg.cholesky(corr)` call with `try/except np.linalg.LinAlgError`, falling back to `self._cholesky = None` (uncorrelated draws) on failure and logging a warning — per the review's suggested fix, applied at the `_rebuild_cholesky` call site itself (the single choke point for both `add_ticker` and `remove_ticker`) rather than only in `add_ticker`, since `remove_ticker` calls the same rebuild and was equally exposed. Added two regression tests: one monkeypatching `np.linalg.cholesky` to always raise, asserting `_cholesky` falls back to `None` without propagating and `step()` still returns prices for every ticker; a second asserting repeated `step()` calls after a failed rebuild keep producing valid prices for every ticker across multiple ticks (the bug's original symptom — price updates silently halting) rather than raising a shape-mismatch.

## Verification

- **Backend:** `cd backend && uv run pytest -q` — 139 passed (0 failed), run in the main checkout after the worktree's commits were fast-forwarded in. (The worktree itself had no `frontend/out` build artifact, so one static-serving test that depends on it was skipped there; it passed once re-run in the main checkout, which does have the artifact.)
- **Backend lint:** `uv run ruff check` on all touched files — all checks passed.
- **Frontend:** `cd frontend && npm test` — 76 passed (0 failed), run in the main checkout (the worktree had no `node_modules`, per the review-fixer's isolation policy — gates were deferred to the main checkout after fast-forward rather than installing dependencies into the throwaway worktree).
- **Frontend build:** `cd frontend && npm run build` — compiled successfully, TypeScript check passed, static export generated.
- Per-fix verification while committing (inside the isolated worktree) used Tier 1 (re-read) plus Tier 2 where tooling was available in that environment: Python syntax (`ast.parse`) for all backend edits, and a full `uv sync --extra dev` + `uv run pytest`/`ruff check` pass scoped to the touched backend test modules (both passed before each backend commit). Frontend edits used Tier 1 only inside the worktree (no `node_modules` there); the full frontend test/build gates above are the first point those changes were exercised by tooling, and they passed cleanly.

## Skipped Issues

None — all four in-scope findings were fixed.

---

_Fixed: 2026-09-18T11:30:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

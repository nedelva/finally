---
phase: 03-trading-portfolio
fixed_at: 2026-09-20T19:05:00Z
review_path: .planning/phases/03-trading-portfolio/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-09-20T19:05:00Z
**Source review:** .planning/phases/03-trading-portfolio/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 3
- Fixed: 3
- Skipped: 0

**Verification environment:** `workflow.use_worktrees=false` for this run — all edits, syntax checks, and test runs happened directly in the main checkout on branch `my-finally-gsd` (no isolated worktree).

Each finding below was verified by direct reproduction, not just by re-reading the diff: the reported bug was reproduced against the pre-fix code (confirmed to fail/misbehave exactly as REVIEW.md described), then re-run against the post-fix code (confirmed to pass), for all three findings — matching the review's own reproduction-first methodology.

## Fixed Issues

### CR-01: `NaN` trade quantity bypasses all validation and crashes the trade endpoint

**Files modified:** `backend/app/db/repository.py`, `backend/tests/db/test_repository.py`, `backend/tests/api/test_portfolio.py`
**Commit:** `3983916`
**Applied fix:** Added `import math` and changed `execute_trade`'s quantity guard from `if quantity <= 0` to `if not math.isfinite(quantity) or quantity <= 0`, per the review's suggested fix — this rejects `NaN`/`Infinity`/`-Infinity` as an ordinary `ValueError` (caught by the route's existing `except ValueError` -> 400 handling) instead of letting a `NaN` reach the `UPDATE users_profile` write and raise an unhandled `sqlite3.IntegrityError`.

Added regression tests:
- `TestExecuteTrade::test_non_finite_quantity_raises_before_any_write` (repository level, parametrized over `nan`/`inf`/`-inf`)
- `TestBuyTrade::test_buy_non_finite_quantity_returns_400_not_an_unhandled_500` (API level, posts the exact raw-JSON repro from the review: `{"ticker":"AAPL","side":"buy","quantity":NaN}`, parametrized over `NaN`/`Infinity`/`-Infinity`)

**Reproduction confirmed:** Ran the new tests against the pre-fix code (`git stash` on `repository.py` only) — both failed with `sqlite3.IntegrityError: NOT NULL constraint failed: users_profile.cash_balance`, exactly matching the review's reported crash. Re-ran against the fix — both pass, with the endpoint returning `400 {"success": false, "error": ...}`.

**Test results:** Backend suite 183/183 passing (177 pre-existing + 6 new). `ruff check` clean.

### WR-01: `execute_trade` has a read-then-write race across concurrent trades

**Files modified:** `backend/app/db/repository.py`, `backend/tests/db/test_repository.py`
**Commit:** `47b7e7f`
**Applied fix:** Added `conn.execute("BEGIN IMMEDIATE")` as the first statement inside `execute_trade`'s `with conn:` block, before any `SELECT`. This acquires SQLite's write lock up front instead of relying on the implicit deferred-transaction behavior (which only opens a transaction before the first write) — a second concurrent `execute_trade` call now blocks at its own `BEGIN IMMEDIATE` until the first transaction commits, so its subsequent reads observe the first trade's already-written balance rather than a stale one.

Added a deterministic regression test, `TestExecuteTrade::test_concurrent_buys_do_not_lose_an_update`: it monkeypatches `repository.get_connection` with a two-thread `threading.Barrier` so both `execute_trade` calls open their connections before either proceeds — forcing the exact interleaving the review described — then asserts the final cash balance reflects both trades (no lost update).

**Reproduction confirmed:** Ran the new test (and a standalone scratch reproduction using the same barrier technique) against the pre-fix code — both showed the lost update exactly as predicted: two concurrent buys of 5 shares at $1000 each against a $10,000 balance left final cash at `$5,000.00` instead of the correct `$0.00`. Re-ran against the fix — final cash is `$0.00`, matching expectations. Re-ran the new test 5x in a row post-fix with no flakiness (the barrier makes the interleaving deterministic, not scheduler-dependent).

**Note for reviewer:** This is a concurrency/locking fix. It has been verified deterministically (both the failure mode and its resolution were reproduced directly, not inferred), but `BEGIN IMMEDIATE`'s broader interaction with the rest of the write surface (e.g. lock contention under real concurrent load, no explicit timeout configured beyond SQLite's default `busy_timeout`) has not been load-tested. Recommend a quick human sanity check before considering this fully closed.

**Test results:** Backend suite 184/184 passing (183 + 1 new). `ruff check` clean.

### WR-02: `PnLChart` renders garbage dates on its X-axis and tooltip

**Files modified:** `frontend/components/PnLChart.tsx`, `frontend/__tests__/PnLChart.test.tsx`
**Commit:** `ae81833`
**Applied fix:** In `buildData()`, changed both `timestamp: Date.parse(snapshot.recorded_at)` and `timestamp: Date.now()` to divide by `1000`, converting milliseconds to Unix seconds — matching `formatClock`'s numeric contract (the same contract `MainChart.tsx`'s `PriceTick.timestamp` already honors).

Added regression test: `"renders the axis tick for the true recorded time, not a scale-mismatched date (WR-02)"`, asserting the rendered X-axis tick text matches the snapshot's true local time. Deliberately used a non-round timestamp (`13:37:42.123`, not a whole minute/second) — an exact-midnight timestamp was tried first and found to coincidentally render the same `hour:minute` text whether or not the fix was applied (a modular-arithmetic fluke of `toLocaleTimeString`'s date-dropping format), which would have made the test vacuous; the non-round timestamp reliably distinguishes the two.

**Reproduction confirmed:** Ran the new test against the pre-fix code (`git stash` on `PnLChart.tsx` only) — failed, rendering `10:22 PM` instead of the expected `02:37 PM` (a ~7h50m discrepancy from the x1000 scale error). Re-ran against the fix — passes.

**Test results:** Frontend suite 137/137 passing (136 pre-existing + 1 new). `tsc --noEmit` clean.

## Skipped Issues

None — all in-scope findings were fixed.

## Out of Scope (not attempted this run)

Per `fix_scope: critical_warning`, the three **Info**-level findings (IN-01 stale docstring, IN-02 emptied-watchlist fallback, IN-03 rounding-precision inconsistency) were left untouched.

---

_Fixed: 2026-09-20T19:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---
phase: 01-live-price-terminal
fixed_at: 2026-09-18T00:00:00Z
review_path: /Users/valeriu/AICourses/finally/.planning/phases/01-live-price-terminal/01-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 3
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-18T00:00:00Z
**Source review:** /Users/valeriu/AICourses/finally/.planning/phases/01-live-price-terminal/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (critical/warning scope; 0 Critical, 4 Warning; Info findings out of scope for this run)
- Fixed: 3
- Skipped: 1

**Verification environment:** Fixes applied and committed in an isolated git worktree (`.claude/worktrees/rf-01-57834-1789691293`, branch `gsd-reviewfix/01-57834`), per `workflow.use_worktrees=true`. Backend fixes (WR-02, WR-04) were verified with `uv run --extra dev pytest` in that worktree — real Tier 2 execution. Frontend fixes (WR-01) were verified Tier 1 only (re-read of modified source/test files, confirming correctness and structural consistency by reading the components under test); `frontend/node_modules` is not present in the worktree (worktrees are created without it by design), so `vitest`/`tsc` were never executed against the frontend changes. This should be confirmed by the verifier phase or a manual `npm test` run in the main checkout.

## Fixed Issues

### WR-01: `role="button"` on `<tr>` invalidates its own `aria-selected` and strips native table semantics

**Files modified:** `frontend/components/WatchlistRow.tsx`, `frontend/__tests__/Watchlist.test.tsx`, `frontend/__tests__/MainChart.test.tsx`
**Commit:** b2a0aca
**Applied fix:** Removed `role="button"` from the watchlist row `<tr>`, restoring its native/implicit `row` role while keeping `tabIndex={0}`, `aria-selected`, and the existing click/keydown handlers for keyboard activation (WAI-ARIA selectable-row pattern). Updated the two tests that previously codified the defect: `Watchlist.test.tsx` now asserts `getAllByRole("row")` returns `1 + tickers.length` (header + all body rows, confirmed by reading `Watchlist.tsx`'s render structure — exactly one `<thead><tr>` and one `<tr>` per ticker, no extra rows), and `MainChart.test.tsx` now asserts the row has no `role` attribute and is a native `<tr>` element instead of asserting `role="button"`. Searched all test files (`grep -rn 'ByRole|"role"'`) to confirm no other test depended on the removed button role.

### WR-02: `timestamp or time.time()` silently discards an explicit zero timestamp

**Files modified:** `backend/app/market/cache.py`
**Commit:** db5168c
**Applied fix:** Changed `ts = timestamp or time.time()` to `ts = timestamp if timestamp is not None else time.time()` in `PriceCache.update()`, so an explicit `timestamp=0.0` (Unix epoch) is preserved instead of being silently overwritten. Verified with `uv run --extra dev pytest tests/market/test_cache.py -q` — 16/16 passed.

### WR-04: Stale comment in `test_main.py` documents a router-singleton defect that `stream.py` no longer has

**Files modified:** `backend/tests/test_main.py`
**Commit:** 2c850ad
**Applied fix:** Removed the stale first justification in `TestLifespanSSE`'s docstring (the module-level-router-singleton claim, which `backend/app/market/stream.py` and `test_stream.py::test_router_isolation_distinct_objects_and_routes` prove is no longer true), keeping only the still-accurate `ASGITransport`/`TestClient` response-draining deadlock rationale as the sole justification for driving the real bound-server `module_app`. Verified with `uv run --extra dev pytest tests/test_main.py -q` — the target `TestLifespanSSE::test_first_frame_contains_all_default_tickers` test passed (4/5 passed overall; the one failure, `TestStaticServing::test_serves_real_frontend_export`, is a pre-existing, unrelated failure caused by `frontend/out/` not being built in this worktree — not touched by this fix).

## Skipped Issues

### WR-03: `api.ts`, `hooks.ts`, and `positionMath.ts` are dead code — no callers, no tests, anywhere in the tree

**File:** `frontend/lib/api.ts`, `frontend/lib/hooks.ts`, `frontend/lib/positionMath.ts`
**Reason:** Both fix options in REVIEW.md exceed what a fixer agent should apply unilaterally: (a) deleting the three files removes phase-1 deliverables authored by another agent, for a Warning with zero runtime impact — REVIEW.md itself notes they're intended for a later phase (Phase 3+ per PLAN.md), so removal is a scope decision for the orchestrator/human, not an autonomous code-fix edit; (b) authoring three new companion test suites is unsafe to do blind — `frontend/node_modules` is absent in the isolated worktree used for these fixes (worktrees are created without it by design), so any new test code would be committed without ever being executed once, which is worse than the dead code it would be documenting. Recommend a human decide between "defer/remove now" and "keep as scaffolding + add tests in a properly provisioned environment" before this finding is resolved.
**Original issue:** `frontend/lib/api.ts`, `hooks.ts`, and `positionMath.ts` implement a REST client, data hooks, and P&L math for portfolio/trading/chat endpoints that belong to later phases per PLAN.md. Zero imports anywhere in the current tree, no test coverage, and `hooks.ts` has three `eslint-disable-next-line react-hooks/set-state-in-effect` suppressions that no test exercises — creates silent bit-rot risk if the shapes drift before these files are wired in.

---

_Fixed: 2026-09-18T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

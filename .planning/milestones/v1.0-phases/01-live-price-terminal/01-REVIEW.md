---
phase: 01-live-price-terminal
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - frontend/package.json
  - frontend/package-lock.json
  - frontend/next.config.js
  - frontend/tsconfig.json
  - frontend/postcss.config.mjs
  - frontend/app/layout.tsx
  - frontend/app/page.tsx
  - frontend/app/globals.css
  - frontend/vitest.config.ts
  - frontend/vitest.setup.ts
  - frontend/__tests__/usePriceFlash.test.ts
  - .gitignore
  - backend/app/main.py
  - backend/tests/test_main.py
  - frontend/lib/usePriceStream.ts
  - frontend/lib/PriceStreamContext.tsx
  - frontend/__tests__/usePriceStream.test.tsx
  - backend/app/market/seed_prices.py
  - backend/app/market/__init__.py
  - backend/pyproject.toml
  - backend/uv.lock
  - backend/tests/market/test_stream.py
  - backend/app/market/stream.py
  - backend/app/market/models.py
  - backend/app/market/cache.py
  - backend/tests/market/test_models.py
  - backend/tests/market/test_cache.py
  - frontend/components/Watchlist.tsx
  - frontend/components/WatchlistRow.tsx
  - frontend/components/Sparkline.tsx
  - frontend/__tests__/Watchlist.test.tsx
  - frontend/__tests__/Sparkline.test.tsx
  - frontend/components/ConnectionDot.tsx
  - frontend/components/Header.tsx
  - frontend/components/MainChart.tsx
  - frontend/__tests__/ConnectionDot.test.tsx
  - frontend/__tests__/MainChart.test.tsx
  - frontend/lib/api.ts
  - frontend/lib/format.ts
  - frontend/lib/hooks.ts
  - frontend/lib/positionMath.ts
  - frontend/lib/types.ts
  - frontend/lib/usePriceFlash.ts
  - frontend/next-env.d.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

Reviewed the live-price-terminal phase: the FastAPI app entrypoint and SSE-facing market-data core (`stream.py`, `cache.py`, `models.py`, `seed_prices.py`), the frontend SSE hook/context, watchlist/sparkline/chart components, and supporting lib/format/type code, plus each area's test suite. Pattern scans for hardcoded secrets, `eval`/`innerHTML`, empty catch blocks, and debug artifacts came back clean.

The implementation is generally solid: the SSE generator correctly handles version-gated delivery, client disconnect, and keepalives; `PriceCache` is properly lock-protected; the frontend's single-EventSource-per-app architecture is well enforced via context; null/undefined price states are handled defensively throughout the formatters and flash hook. No security vulnerabilities, crashes, or data-loss risks were found — no Critical findings.

Four issues are worth fixing: an ARIA-invalid `role="button"` on a `<tr>` that strips native table semantics from every watchlist row (confirms the concern flagged in the prior audit), a `timestamp or time.time()` falsy-zero bug in `PriceCache.update()`, three fully-unused/untested library modules (`api.ts`, `hooks.ts`, `positionMath.ts`) shipped as dead code with no callers anywhere in the tree, and a stale code comment in `test_main.py` that documents a router-singleton defect which has already been fixed in `stream.py` (contradicted by `stream.py`'s own isolation test).

## Warnings

### WR-01: `role="button"` on `<tr>` invalidates its own `aria-selected` and strips native table semantics

**File:** `frontend/components/WatchlistRow.tsx:60-70`
**Issue:** Each watchlist body row is rendered as:
```tsx
<tr
  data-testid={`row-${ticker}`}
  role="button"
  tabIndex={0}
  aria-selected={selected}
  onClick={select}
  onKeyDown={handleKeyDown}
  ...
>
```
Overriding a `<tr>`'s implicit `row` role with `role="button"` removes it from the accessibility tree's table structure — assistive tech no longer associates the element's cells with the table's column headers, and a screen reader announces it as a generic clickable widget instead of "row N of 10, Symbol column: AAPL, Price column: ...". Independently, `aria-selected` is only a defined state for roles `row`, `option`, `tab`, `gridcell`, `columnheader`, `rowheader`, and `treeitem` per the WAI-ARIA spec — it is **not** a supported property of `role="button"`, so `aria-selected` on this element is invalid ARIA usage that accessibility linters (`jsx-a11y/role-supports-aria-props`) and validators (axe-core) will flag. This is compounded by the header row (`Watchlist.tsx`) keeping its native `row` role, so the table has inconsistent role semantics between `<thead>` and `<tbody>`.

`frontend/__tests__/Watchlist.test.tsx:195-200` and `frontend/__tests__/MainChart.test.tsx:64-70` both assert on this behavior (`role="button"`, `getAllByRole("button")`), so the tests currently codify the defect rather than catch it.

**Fix:** Keep the row's native/`row` semantics and drop `role="button"`; `aria-selected` is valid on `role="row"` so it can be applied directly (or left implicit). Retain `tabIndex={0}` and the existing click/keydown handlers for keyboard activation — WAI-ARIA's selectable-row pattern for tables/grids uses exactly this shape:
```tsx
<tr
  data-testid={`row-${ticker}`}
  tabIndex={0}
  aria-selected={selected}
  onClick={select}
  onKeyDown={handleKeyDown}
  ...
>
```
Update the two tests above to query by `data-testid` (or `getAllByRole("row")`) instead of `role="button"`.

### WR-02: `timestamp or time.time()` silently discards an explicit zero timestamp

**File:** `backend/app/market/cache.py:35`
**Issue:**
```python
ts = timestamp or time.time()
```
`timestamp` is typed `float | None`. Using `or` instead of an explicit `is None` check means a caller that legitimately passes `timestamp=0.0` (Unix epoch) has that value silently discarded and replaced by the current wall-clock time — `0.0` is falsy in Python. This contradicts the docstring's implied contract ("if timestamp is None, compute the current time") and is a classic falsy-value bug. Practical likelihood is low today (no current caller passes 0.0), but it's a latent correctness trap for any future caller (e.g., a backtest/replay data source seeding historical epoch-relative timestamps).

**Fix:**
```python
ts = timestamp if timestamp is not None else time.time()
```

### WR-03: `api.ts`, `hooks.ts`, and `positionMath.ts` are dead code — no callers, no tests, anywhere in the tree

**File:** `frontend/lib/api.ts`, `frontend/lib/hooks.ts`, `frontend/lib/positionMath.ts`
**Issue:** These three modules implement a REST client (`getPortfolio`, `postTrade`, `addWatchlistTicker`, `postChatMessage`, ...), React data hooks (`usePortfolio`, `usePortfolioHistory`, `useWatchlist`), and P&L derivation math (`deriveLivePosition`) for portfolio/trading/chat endpoints that per `PLAN.md` belong to later phases (Phase 3+). A repo-wide grep confirms zero imports of any of the three files from any component, page, or test in the current tree, and there is no `__tests__` file exercising any of their exports — `frontend/lib/hooks.ts` even has three separate `// eslint-disable-next-line react-hooks/set-state-in-effect` suppressions that no test ever exercises to confirm the suppressed behavior is actually safe. Shipping untested, uncalled surface area this early creates silent bit-rot risk: if `Position`/`Portfolio`/`ChatResponse` shapes drift once the backend for those phases is built, nothing in CI will catch it until a future phase wires these files in.

**Fix:** Either (a) defer adding these files until the phase that consumes them (matches the plan's phase boundaries and keeps phase 1's file set congruent with phase 1's actual UI), or (b) if they're intentionally pre-built scaffolding, add a companion test file per module now (mirroring the pattern already used for every other `lib/*.ts` file in this phase) so drift is caught immediately, and note the "not yet wired up" status in a module comment.

### WR-04: Stale comment in `test_main.py` documents a router-singleton defect that `stream.py` no longer has

**File:** `backend/tests/test_main.py:85-98`
**Issue:** `TestLifespanSSE`'s docstring justifies driving the real `uvicorn`-bound `module_app` (instead of a fresh `create_app()`) partly because:
> `create_stream_router()` decorates its `/prices` handler onto a *module-level* `APIRouter` singleton in `stream.py` ... Building a second, throwaway app via `create_app()` in this same process registers a second handler on that shared router ... (not touched here).

This is no longer true of the current `backend/app/market/stream.py`: `router = APIRouter(...)` is declared **inside** `create_stream_router()` (line 31), so every call constructs an independent router instance — there is no module-level singleton to collide on. `backend/tests/market/test_stream.py::test_router_isolation_distinct_objects_and_routes` directly proves this (`assert router_a is not router_b`). The comment's second justification (real-socket `AsyncClient` needed because `ASGITransport`/`TestClient` fully drain the response body before returning, deadlocking against this endless generator) remains valid and is sufficient on its own — but the stale first justification, left uncorrected, misrepresents the current architecture and could mislead a future maintainer into believing a live bug still exists (or into reintroducing a module-level router "fix" that isn't needed).

**Fix:** Remove or correct the stale first justification in the docstring; keep the still-accurate ASGITransport-deadlock rationale as the sole reason for the real-server test shape.

## Info

### IN-01: `WatchlistRow`'s keyboard handler binds `Space` scroll-prevention to the whole row without an explicit interactive-element check

**File:** `frontend/components/WatchlistRow.tsx:52-57`
**Issue:** `handleKeyDown` calls `event.preventDefault()` on both `Enter` and `Space` for any focus on the `<tr>`. This is correct given the row is (currently) the sole focusable/interactive unit, but it's tightly coupled to the `role="button"` decision flagged in WR-01 — if WR-01's fix changes the row to `role="row"` with children eventually gaining their own interactive controls (e.g., a per-row watchlist "remove" button in a later phase), this handler will need to stop intercepting `Space`/`Enter` when the event target isn't the row itself (`event.target === event.currentTarget`), or nested controls will lose their native activation behavior.

**Fix:** No action needed now; flagging as a forward-looking note to revisit alongside WR-01 once interactive children are added to a row.

### IN-02: `PriceCache.update()`'s session-open reset comment could drift from `remove()`'s actual behavior undetected

**File:** `backend/app/market/cache.py:67-76`
**Issue:** `remove()`'s docstring and behavior (pop both `_prices` and `_session_open`) are correctly tested (`test_session_open_resets_after_remove_and_readd`), but nothing enforces that the two dicts (`_prices`, `_session_open`) stay in lockstep as the class grows — e.g., a future contributor adding a new per-ticker dict (say, a high/low-of-day tracker) could easily forget to also clear it in `remove()`, and no structural test would catch the omission since each new dict would need its own dedicated test.

**Fix:** Consider consolidating per-ticker mutable state into a single internal dict-of-structs (or a small dataclass) keyed by ticker, so `remove()` becomes a single `pop` regardless of how many fields are tracked per ticker. Not required for this phase's correctness — noted for maintainability as the cache's per-ticker state grows.

---

_Reviewed: 2026-09-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

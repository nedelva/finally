---
phase: 02-persistent-watchlist
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - .gitignore
  - backend/app/api/__init__.py
  - backend/app/api/watchlist.py
  - backend/app/db/__init__.py
  - backend/app/db/connection.py
  - backend/app/db/init.py
  - backend/app/db/repository.py
  - backend/app/db/schema.py
  - backend/app/main.py
  - backend/app/market/__init__.py
  - backend/app/market/massive_client.py
  - backend/app/market/simulator.py
  - backend/app/market/ticker.py
  - backend/tests/api/__init__.py
  - backend/tests/api/conftest.py
  - backend/tests/api/test_watchlist.py
  - backend/tests/conftest.py
  - backend/tests/db/__init__.py
  - backend/tests/db/conftest.py
  - backend/tests/db/test_init.py
  - backend/tests/db/test_repository.py
  - backend/tests/market/test_massive.py
  - backend/tests/market/test_simulator_source.py
  - db/.gitkeep
  - frontend/__tests__/Watchlist.test.tsx
  - frontend/app/page.tsx
  - frontend/components/Watchlist.tsx
  - frontend/components/WatchlistRow.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the persistent-watchlist phase: the new `app/db` persistence layer (schema, connection, lazy init, repository), the `app/api/watchlist.py` CRUD router, `app/main.py`'s lifespan wiring, the `normalize_ticker`/`is_valid_ticker_format` helper now shared across both market data sources, and the frontend watchlist grid (add/remove UI, `page.tsx` selection-guard effects).

The backend persistence and API layer is solid: every SQL statement is parameterized, duplicate/absent-row handling is correct and well-tested, normalization is centralized and consistently applied before both DB writes and market-source notification, and the test suites (`test_watchlist.py`, `test_repository.py`, `test_init.py`) exercise the CRUD surface thoroughly including case-normalization and idempotency.

One critical, reproducible bug was found in the new frontend selection-guard logic in `page.tsx`: removing the last ticker from an otherwise-nonempty watchlist enters the two selection effects into a permanent ping-pong loop. The existing test for "watchlist becomes empty" doesn't catch it because it never emits an SSE tick, so the specific interaction between the (monotonically-growing) SSE ticker set and the (shrinkable) REST watchlist set is never exercised. Additional warnings cover a keyboard-accessibility gap in the new remove button, and unguarded failure propagation from the market-source notify step in both watchlist route handlers.

## Critical Issues

### CR-01: Selection-guard effects in page.tsx can enter a permanent ping-pong loop when the watchlist becomes empty

**File:** `frontend/app/page.tsx:19-39`
**Issue:**
Two `useEffect`s manage `selectedTicker`:

```tsx
useEffect(() => {
  if (!selectedTicker && tickers.length > 0) {
    setSelectedTicker(tickers[0]);
  }
}, [selectedTicker, tickers]);

const watchlistTickers = watchlist.map((entry) => entry.ticker);
useEffect(() => {
  if (selectedTicker && !watchlistTickers.includes(selectedTicker)) {
    setSelectedTicker(watchlistTickers[0]);
  }
}, [selectedTicker, watchlistTickers]);
```

The comment above the second effect claims the two guards "are mutually exclusive by design," but that's only true within a single render — across renders they are not. `tickers` (from `usePriceStreamContext()` / `usePriceStream.ts:91-95`) is a `Set`-backed accumulator that **only ever grows** (confirmed in `usePriceStream.ts`: `setTickers((prev) => { const merged = new Set(prev); ... })`, no removal branch — this is explicitly called out in this same file's and `Watchlist.tsx`'s own comments). `watchlist`/`watchlistTickers` comes from `useWatchlist()` (REST) and **can shrink to empty**.

Reachable sequence:
1. User has one ticker (e.g. AAPL) in the watchlist; it has streamed at least one price tick, so `tickers = ["AAPL"]`.
2. User removes it. `useWatchlist()` refetches → `watchlist = []` → `watchlistTickers = []`. `tickers` is untouched (still `["AAPL"]"`, since the SSE-derived set never shrinks).
3. Effect 2 fires (`selectedTicker` = "AAPL", not in `[]`) → `setSelectedTicker(watchlistTickers[0])` = `setSelectedTicker(undefined)`.
4. Re-render: `selectedTicker` is now falsy. Effect 1 fires (`!selectedTicker && tickers.length > 0`, since `tickers = ["AAPL"]`) → `setSelectedTicker("AAPL")`.
5. Re-render: `selectedTicker` = "AAPL" again, still not in the (still-empty) `watchlistTickers` → effect 2 fires again → back to step 3.

This repeats indefinitely — the chart selection never settles, the effects keep re-firing on every render, and the "watchlist is empty" UI never reaches a stable state. The existing regression test (`Watchlist.test.tsx`, "clears the selection when the watchlist becomes empty") does not catch this because it never calls `source.fireMessage(...)`, so `tickers` stays `[]` throughout and effect 1's guard is never true — the exact interaction that causes the loop in real usage (where the ticker has already streamed a price) is untested.

**Fix:** Guard effect 1 against re-selecting a ticker that isn't in the current watchlist, or merge the two effects into one that derives the target from both sources with matching precedence, e.g.:

```tsx
useEffect(() => {
  const validSelection = selectedTicker && watchlistTickers.includes(selectedTicker);
  if (validSelection) return;
  const fallback = watchlistTickers.find((t) => tickers.includes(t)) ?? watchlistTickers[0];
  setSelectedTicker(fallback);
}, [selectedTicker, watchlistTickers, tickers]);
```
(or equivalent — the key requirement is that "no valid selection" must never be able to re-trigger a selection of a ticker outside the current watchlist).

## Warnings

### WR-01: Watchlist route handlers don't handle market-source notify failures, risking DB/cache desync

**File:** `backend/app/api/watchlist.py:102-110, 123-131`
**Issue:** In both `POST /api/watchlist` and `DELETE /api/watchlist/{ticker}`, the DB write/delete is committed first, then the market source is notified with no try/except:

```python
result = await asyncio.to_thread(add_watchlist_ticker, normalized)
...
await request.app.state.market_source.add_ticker(normalized)   # unguarded
return JSONResponse(status_code=201, content=result)
```
```python
removed = await asyncio.to_thread(remove_watchlist_ticker, normalized)
...
await request.app.state.market_source.remove_ticker(normalized)  # unguarded
return Response(status_code=204)
```

If the notify call raises (see WR-03 below for one concrete way `SimulatorDataSource.add_ticker` can raise), the DB has already been committed but the response becomes an unhandled 500, and the ticker is left in the watchlist with no corresponding entry in the price cache/market source — it will show a permanently null price in `GET /api/watchlist` until the app restarts (the next lifespan boot reads tickers straight from the DB, so a restart self-heals, but the running process does not).

**Fix:** Wrap the notify call and either (a) roll back the DB write/delete on failure so the two stay consistent, or (b) catch and log the notify failure while still returning success, documenting that the price stream will pick up the ticker on next restart. Either is preferable to letting the exception surface as an unhandled 500 after the DB mutation already succeeded.

### WR-02: Keyboard activation of the remove button also fires row selection

**File:** `frontend/components/WatchlistRow.tsx:55-68, 97-107`
**Issue:** The `<tr>` has `tabIndex={0}` and an `onKeyDown` handler that calls `select()` on Enter/Space:

```tsx
const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
};
```

The nested remove `<button>` only stops propagation on its **click** handler:

```tsx
const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
  event.stopPropagation();
  onRemove?.(ticker);
};
```

When a keyboard user tabs to the remove button and presses Enter/Space, the browser fires a `keydown` on the button first, which bubbles up through the DOM to the `<tr>`'s `onKeyDown` (React attaches this via delegated bubbling, and nothing here stops that propagation) — so `select()` fires — and separately the browser's native button-activation fires a synthesized `click`, invoking `handleRemoveClick`/`onRemove`. Both `onSelect(ticker)` and `onRemove(ticker)` end up called for a single keyboard activation of the remove control. The existing test suite only exercises the remove button via `user.click(...)` (mouse), so this path is untested.

**Fix:** Stop propagation on the button's `onKeyDown` too (or move the row-selection keydown handling off the `<tr>` and onto a dedicated "cell"/wrapper that excludes the remove button), e.g.:
```tsx
<button
  ...
  onClick={handleRemoveClick}
  onKeyDown={(e) => e.stopPropagation()}
>
```

### WR-03: `GBMSimulator.add_ticker` can leave `_cholesky` dimension out of sync with `_tickers`, silently halting all price updates

**File:** `backend/app/market/simulator.py:121-126, 155-173, 264-274`
**Issue:** `add_ticker()` mutates simulator state (appends to `_tickers`/`_prices`/`_params` via `_add_ticker_internal`) and only afterward rebuilds `_cholesky`:

```python
def add_ticker(self, ticker: str) -> None:
    if ticker in self._prices:
        return
    self._add_ticker_internal(ticker)   # ticker count now n+1
    self._rebuild_cholesky()             # np.linalg.cholesky(corr) — can raise LinAlgError
```

`_rebuild_cholesky()` calls `np.linalg.cholesky(corr)` unguarded. If the constructed correlation matrix for the new ticker set is not positive-definite, this raises, and — because `_add_ticker_internal` already ran — `self._tickers` now has `n+1` entries while `self._cholesky` retains its stale `n`-dimensional (or `None`) value. `SimulatorDataSource.add_ticker()` (`simulator.py:244-252`) does not catch this either, so the exception propagates all the way to the caller (see WR-01: the watchlist POST route awaits this with no try/except).

Worse, even if the immediate exception is swallowed somewhere upstream, the *next* `step()` call (`simulator.py:75-119`) computes `n = len(self._tickers)` (now `n+1`) and does `self._cholesky @ z_independent` where `z_independent` has `n+1` entries but `self._cholesky` is still the old `n × n` matrix — a shape-mismatch `ValueError`. `_run_loop`'s broad `except Exception` (`simulator.py:272-273`) catches and logs this every tick going forward, meaning **price updates silently stop for every ticker**, not just the newly added one, until the process restarts.

**Fix:** Guard `_rebuild_cholesky()` (or its caller) so a failed rebuild either falls back to an uncorrelated (`None`) Cholesky matrix rather than leaving a stale, wrongly-shaped one, or rolls back the just-added ticker on failure:
```python
def add_ticker(self, ticker: str) -> None:
    if ticker in self._prices:
        return
    self._add_ticker_internal(ticker)
    try:
        self._rebuild_cholesky()
    except np.linalg.LinAlgError:
        logger.warning("Cholesky rebuild failed for %s; falling back to uncorrelated draws", ticker)
        self._cholesky = None
```

## Info

### IN-01: Remove button has no in-flight/disabled state

**File:** `frontend/components/Watchlist.tsx:62-70`, `frontend/components/WatchlistRow.tsx:97-107`
**Issue:** `handleSubmit` tracks a `submitting` flag that disables the add-ticker form while the POST is in flight, but `handleRemove` has no equivalent — the remove button (`WatchlistRow.tsx`) stays enabled and un-styled during the DELETE round-trip, so rapid repeated clicks can fire multiple DELETE requests for the same ticker (harmless server-side since the second returns 404, but avoidable churn and no user feedback that the action is processing).
**Fix:** Track a per-ticker (or global) in-flight set in `Watchlist.tsx` and pass a `removing` flag down to disable the button / show a pending indicator, mirroring the `submitting` pattern already used for add.

### IN-02: Repository layer trusts caller-normalized tickers with no defensive check

**File:** `backend/app/db/repository.py:39-63`
**Issue:** `add_watchlist_ticker`/`remove_watchlist_ticker` document that they "expect an already-normalized, already-validated ticker" and rely entirely on `app/api/watchlist.py` to have called `normalize_ticker` first. This is consistently honored today, but there's no guard (assertion, or a normalize-again call) inside the repository itself, so a future caller (e.g. an LLM-driven trade/watchlist action in a later phase) that forgets to normalize would silently insert a case-variant duplicate (`"aapl"` alongside `"AAPL"`), since the `UNIQUE (user_id, ticker)` constraint is case-sensitive at the SQLite level.
**Fix:** Consider calling `normalize_ticker()` defensively inside the repository functions themselves (cheap, idempotent, and removes the cross-module contract from being purely documentation-enforced).

### IN-03: `init_db()` seed step is not safe against concurrent first-run callers

**File:** `backend/app/db/init.py:16-51`
**Issue:** The read-then-conditionally-insert seeding logic (`SELECT COUNT(*) ... ; if row["n"] == 0: INSERT ...`) is only safe against sequential calls (as tested). If two processes both call `init_db()` against the same fresh (nonexistent) database file at the same time, both could observe `n == 0` before either commits, and the second's `INSERT INTO users_profile (id, ...)` would raise an uncaught `sqlite3.IntegrityError` on the `"default"` primary key. Low practical risk given the single-container/single-process deployment model in PLAN.md §11, but worth a one-line note since `init_db()` is otherwise documented as "idempotent."
**Fix:** Either accept this as an explicitly out-of-scope single-process assumption (a one-line docstring caveat would do), or wrap the seed insert in a try/except `sqlite3.IntegrityError: pass` for defense in depth.

---

_Reviewed: 2026-09-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

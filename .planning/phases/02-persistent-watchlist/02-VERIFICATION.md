---
phase: 02-persistent-watchlist
verified: 2026-09-18T11:35:31Z
status: human_needed
score: 27/32 must-haves verified
covered_files: [".gitignore", ".planning/REQUIREMENTS.md", ".planning/phases/02-persistent-watchlist/02-01-PLAN.md", ".planning/phases/02-persistent-watchlist/02-01-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-02-PLAN.md", ".planning/phases/02-persistent-watchlist/02-02-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-03-PLAN.md", ".planning/phases/02-persistent-watchlist/02-03-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-REVIEW-FIX.md", ".planning/phases/02-persistent-watchlist/02-REVIEW.md", "backend/app/api/__init__.py", "backend/app/api/watchlist.py", "backend/app/db/__init__.py", "backend/app/db/connection.py", "backend/app/db/init.py", "backend/app/db/repository.py", "backend/app/db/schema.py", "backend/app/main.py", "backend/app/market/massive_client.py", "backend/app/market/simulator.py", "backend/app/market/ticker.py", "db/.gitkeep", "frontend/app/page.tsx", "frontend/components/Watchlist.tsx", "frontend/components/WatchlistRow.tsx"]
covered_digest: "v1:sha256:bd76173c449cf77fa63c3d8e3906758187649365e4f8ae2b7c7bcb59a5bb9601"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Two concurrent POST /api/watchlist requests for the same new ticker never produce two watchlist rows — the UNIQUE (user_id, ticker) constraint is the serialization point, and the losing request surfaces as a 409 rather than a 500 (02-02 must_haves backstop item)."
    test: "Fire two concurrent add_watchlist_ticker(\"XXXX\") calls (e.g. via asyncio.gather over asyncio.to_thread, or two threads) against the same SQLite file and confirm exactly one row exists and the second raises/translates to 409, not a 500 or a silent duplicate."
    expected: "Exactly one watchlist row for the ticker; the losing request either raises sqlite3.IntegrityError -> ValueError -> 409, or blocks/serializes cleanly — never a 500 and never two rows."
    why_human: "No concurrency test exists in backend/tests/db/test_repository.py or backend/tests/api/test_watchlist.py (confirmed by grep — no thread/asyncio.gather-based race test). The UNIQUE constraint plus per-call connection design make this very likely safe, but that is an inference from schema design, not an executed test."
human_verification:
  - test: "Reload the app in a browser and add several tickers to the watchlist; watch the initial GET /api/watchlist round trip on page load."
    expected: "No visible skeleton/spinner flash or layout jump — the watchlist grid appears populated on first paint, matching 02-01's assumption that a local SQLite read resolves fast enough to need no loading treatment."
    why_human: "Requires observing real paint timing in a running browser; the executor's own SUMMARY (02-01 D5) already flags this as human_judgment: true, unconfirmed."
  - test: "In a running browser: submit the add-ticker form (purple button, 'Adding…' in-flight state) and click the × remove glyph on a row; visually confirm styling, color tokens, and that clicking × removes the row with no flash/flicker or accidental navigation to the chart."
    expected: "Purple submit button, down-red × glyph and inline error text, disabled/'Adding…' state while in flight, and an immediate, visually clean row removal — matching the UI-SPEC's Copywriting/Color contract."
    why_human: "Requires visual/interaction confirmation in a real browser. Both 02-02 (D7) and 02-03 (D7) SUMMARYs independently flag this as human_judgment: true — the Vitest DOM assertions and successful production build support but do not substitute for it."
  - test: "Disconnect the backend (or force GET /api/watchlist to fail) while the app is loaded, and observe what the watchlist panel shows."
    expected: "Some visible indication that the watchlist failed to load, OR an explicit product decision that silent-empty is acceptable for this phase."
    why_human: "Code-confirmed gap, not a hypothesis: `useWatchlist()` (frontend/lib/hooks.ts:77-107) captures a failed GET into an `error` string, but `Watchlist.tsx` destructures only `{ watchlist, refetch }` and never reads or renders that `error` — a failed initial fetch renders as an indistinguishable empty watchlist with no message. 02-01's own must_haves flagged this as an undesigned backstop item ('no dedicated grid-level error visual has been designed and none exists to verify against yet'); this is a design decision, not a programmatically-resolvable pass/fail."
  - test: "Add tickers until the watchlist panel exceeds one screen's worth of rows and observe the panel's layout behavior."
    expected: "The panel either scrolls internally or has some intentional overflow treatment — rows should not silently push the rest of the page layout in a way that breaks the terminal's dense, single-screen aesthetic."
    why_human: "Confirmed by grep that `frontend/components/Watchlist.tsx` has no `overflow`/`scroll` styling. 02-01's must_haves explicitly flagged this as an open follow-up design decision ('if the panel does not already scroll internally this needs a follow-up design decision'); it was not resolved in any of the three plans in this phase. A human needs to view the rendered layout with more entries than fit on screen to judge whether this is acceptable as-is."
  - test: "Confirm the UI treatment for a failed DELETE (e.g. force removeWatchlistTicker to reject) renders visibly and acceptably to a user."
    expected: "The reused `watchlist-add-error` inline slot displays the server's error text after a failed remove, in a position/wording a user would actually notice given the error sits under the *add* form, not next to the row that failed to remove."
    why_human: "02-03's must_haves explicitly tagged this `verification: backstop` ('no UI treatment is specified for a failed DELETE... flagged for the executor to decide and for a future test to confirm'). The executor's chosen fix (reuse `Watchlist.tsx`'s `setError`, which feeds the shared `<p data-testid=\"watchlist-add-error\">`) is confirmed wired by code read, and the one test covering this path (`\"does not call refetch when removeWatchlistTicker resolves not-ok\"`) only asserts `refetch` was not called — it does not assert the error text actually renders in that slot. Per this project's backstop rule, presence + wiring is necessary but not sufficient for a non-inferable truth; this needs either a rendering assertion or a human look."
---

# Phase 02: Persistent Watchlist Verification Report

**Phase Goal:** The user controls which tickers they watch, and that choice — along with the rest of the app's state — now lives in a real SQLite database instead of memory
**Verified:** 2026-09-18T11:35:31Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (primary contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User adds a ticker (e.g. PYPL) through the watchlist control and it appears in the grid and starts streaming prices within seconds | ✓ VERIFIED | Live `TestClient` run against a real SQLite file, real GBM simulator: `POST /api/watchlist {"ticker":"pypl"}` → 201; **2 seconds later**, `GET /api/watchlist` returns the `PYPL` entry with a real, non-null, moving price (`{"ticker":"PYPL","price":244.94,"previous_price":244.94,"change":-0.02,"change_percent":-0.0082,"direction":"flat"}`) — the add→notify→cache→stream chain is directly observed, not inferred. Frontend: `Watchlist.tsx`'s `handleSubmit` calls `addWatchlistTicker` then `refetch()` on success (`frontend/components/Watchlist.tsx:37-57`), covered by `frontend/__tests__/Watchlist.test.tsx::"Watchlist add-ticker form"` (8 tests, all passing). |
| 2 | User removes a ticker and it disappears from the grid and stops receiving updates | ✓ VERIFIED | Live run: `DELETE /api/watchlist/pypl` → 204; subsequent `GET /api/watchlist` back to 10 entries, `PYPL` absent. `market_source.remove_ticker()` awaited on success (`backend/app/api/watchlist.py:141`). Frontend: `WatchlistRow.tsx`'s remove button (`data-testid="remove-{ticker}"`) calls `onRemove` → `Watchlist.tsx`'s `handleRemove` → `removeWatchlistTicker` → `refetch()` (`frontend/components/Watchlist.tsx:62-70`); `page.tsx`'s merged selection-guard effect moves the chart off a removed ticker (`frontend/app/page.tsx:29-37`). Covered by `"Watchlist remove wiring"` and `"Page selection guard on watchlist removal"` describe blocks (5 tests, all passing). |
| 3 | Reloading the browser shows the user's own watchlist, not the built-in default list | ✓ VERIFIED | `Watchlist.tsx` sources row membership exclusively from `useWatchlist()` (REST, `GET /api/watchlist`), not from the SSE-derived `tickers` set (`frontend/components/Watchlist.tsx:30-31`, confirmed no `tickers` destructure remains). `app/main.py`'s lifespan starts the market source from `get_watchlist()` rows, not the `DEFAULT_TICKERS` literal (`backend/app/main.py:98-100`), so a restart streams whatever the user persisted. Regression-tested by `"renders exactly three rows when useWatchlist() returns three entries, even after the stream has reported ten tickers"`. |
| 4 | A malformed or empty ticker entry is rejected with a visible message and leaves the watchlist unchanged | ✓ VERIFIED | Live run: `POST {"ticker":""}` → 400 with `error` key; `POST {"ticker":"TOOLONGTICKER"}` → 400 with `error` key; watchlist count unchanged (10) after both. Client-side empty/whitespace check with no network round trip (`frontend/components/Watchlist.tsx:40-44`), tested by `"renders the empty-submission error and does not call addWatchlistTicker"` (both empty and whitespace-only variants). No `maxLength` on the input (grep-confirmed), so over-length input reaches the server's 400 path per design. |

**ROADMAP score:** 4/4 success criteria verified, all against a real running app and a real SQLite file — not mocked.

### Additional Plan-Level Must-Haves (32 truths across 02-01/02-02/02-03 frontmatter)

| Category | Verified | Behavior-Unverified | Human-Judgment / Insufficient-Spec |
|---|---|---|---|
| 02-01 (10 truths: schema/seed/GET/lifespan/UI) | 7 | 0 | 3 (loading flicker, failed-GET error visual, no-scroll/max-size) |
| 02-02 (12 truths: POST/validation/normalization/add-form UI) | 11 | 1 (concurrent-add race) | 0 |
| 02-03 (10 truths: DELETE/remove UI/empty state/selection guard) | 9 | 0 | 1 (failed-DELETE UI treatment — presence+wiring confirmed, rendering not asserted) |
| **Total** | **27** | **1** | **4** |

**Score:** 27/32 truths verified (1 present-but-behavior-unverified, 4 routed to human judgment — 5 items total in Human Verification).

Detail on the not-fully-VERIFIED items:

- **02-02 backstop — concurrent same-ticker adds:** No concurrency test exists (`grep -rn "concurrent|threading|ThreadPoolExecutor"` over `tests/db/test_repository.py` and `tests/api/test_watchlist.py` returns nothing). The `UNIQUE (user_id, ticker)` constraint plus per-call SQLite connections make double-insert very unlikely, but this is an inference from schema design, not an executed test. Routed to `behavior_unverified_items`.
- **02-01 — no visible loading flicker:** Explicitly flagged `human_judgment: true` in 02-01-SUMMARY.md's own coverage (D5); this verification did not independently confirm paint timing in a browser. Routed to human verification.
- **02-01 — failed `GET /api/watchlist` has no dedicated error visual:** Confirmed by direct code read: `useWatchlist()` (`frontend/lib/hooks.ts:77-107`) captures a failed fetch into an `error` string, but `Watchlist.tsx` destructures only `{ watchlist, refetch }` and never renders that `error`. The plan's own must_haves already disclaimed this as undesigned — a real, present gap needing an explicit accept/fix decision. Routed to human verification.
- **02-01 — no server-side watchlist size cap / no scroll treatment:** Confirmed by grep: no `overflow`/`scroll` styling in `Watchlist.tsx`. The plan's must_haves flagged this as an open follow-up design decision, never resolved by 02-02 or 02-03. Routed to human verification.
- **02-03 backstop — stopPropagation on nested clickable:** Reclassified to VERIFIED — a named, passing test (`"does not fire the row's onSelect when the remove button is activated via keyboard"`, added in code-review fix `f9a4e7f`) directly exercises this exact concern with behavioral evidence, not just presence.
- **02-03 backstop — no UI treatment specified for a failed DELETE:** Left as human-verification, **not** reclassified to VERIFIED on first pass. Code read confirms the wiring (`handleRemove`'s `setError` feeds the shared `watchlist-add-error` `<p>`), but the one test on this path (`"does not call refetch when removeWatchlistTicker resolves not-ok"`) asserts only that `refetch` was skipped — it does not assert the error text actually renders. This project's backstop rule is explicit that presence + wiring is necessary but not sufficient for a non-inferable truth, so this stays a human item.

### Prohibitions (must_haves.prohibitions — judgment-tier, non-authoritative)

All four prohibitions across the three plans are `verification: judgment`, `status: resolved` per plan authors. Per this project's judgment-tier rule, these get a non-authoritative disposition here plus an explicit flag — never a silent pass.

| # | Source Plan | Prohibition | Disposition | Evidence |
|---|---|---|---|---|
| 1 | 02-01 | MUST NOT present a fabricated, zero, or stale-guess price for an unpriced ticker | **honored** — flagged: `unverified-prohibition — human review recommended` | `build_watchlist()` emits `price: None, previous_price: None, change: None, change_percent: None, direction: "flat"` for any ticker absent from `PriceCache` (`backend/app/api/watchlist.py:41-52`) — no synthesized number anywhere in the function. |
| 2 | 02-02 | MUST NOT silently substitute/auto-correct/fuzzy-match a submitted ticker | **honored** — flagged: `unverified-prohibition — human review recommended` | `normalize_ticker()` is strip+upper only (`backend/app/market/ticker.py:17-23`); anything failing the `[A-Z0-9]{1,5}` format gate returns 400 echoing the user's raw input (`backend/app/api/watchlist.py:92-101`) rather than being silently changed. |
| 3 | 02-02 | MUST NOT silently drop an accepted ticker or enforce an undocumented max watchlist size | **honored** — flagged: `unverified-prohibition — human review recommended` | No cap exists anywhere in `app/api/watchlist.py` or `app/db/repository.py` (grep-confirmed); every accepted ticker is persisted and returned. Note: this is the same absence that drives Human Verification item 4 (no scroll/overflow treatment for a large watchlist) — the prohibition against *silently dropping* entries holds, but the UI consequence of an unbounded list is still an open design question. |
| 4 | 02-03 | MUST NOT cascade a watchlist removal into `positions`/`trades`/`portfolio_snapshots`/`chat_messages` | **honored** — stronger-than-judgment evidence available | `remove_watchlist_ticker()`'s `DELETE` statement targets only the `watchlist` table (`backend/app/db/repository.py:66-86`), and `test_remove_does_not_touch_positions_trades_snapshots_or_chat_messages` passes as part of the 138-test backend suite — an executed test, not just judgment. |

**None of the four judgment-tier prohibitions are violated.** All four carry the `unverified-prohibition — human review recommended` flag per this project's fail-closed default for judgment-tier items, even though disposition #4 has stronger (test-backed) evidence than the other three. This does not change the phase's `human_needed` status (already triggered by the items above) — it completes the record per the mandatory reporting contract.

### Deferred Items

None — no later phase in ROADMAP.md addresses the five remaining human-verification items; they belong to this phase's own scope.

### Advisory (New Scope, Unevidenced)

Not applicable — this is an initial verification (`is_re_verification = false`), so the re-verification convergence-evidence gate (Step 7) does not apply.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/db/connection.py` | `get_db_path()`, `get_connection()`, `FINALLY_DB_PATH` override | ✓ VERIFIED | Present, substantive, one-connection-per-call, WAL mode, `mkdir(parents=True, exist_ok=True)`. |
| `backend/app/db/schema.py` | Six `CREATE TABLE IF NOT EXISTS` constants + `ALL_TABLES` + `CREATE_INDEXES` + `DEFAULT_USER_ID`/`DEFAULT_CASH_BALANCE` | ✓ VERIFIED | Directly queried against a live temp DB: `SELECT name FROM sqlite_master WHERE type='table'` → `['chat_messages', 'portfolio_snapshots', 'positions', 'trades', 'users_profile', 'watchlist']` — all six present after `init_db()`. |
| `backend/app/db/init.py` | `init_db()` idempotent create+seed | ✓ VERIFIED | Guards seed on `SELECT COUNT(*) FROM users_profile == 0`; `backend/tests/db/test_init.py` passing (part of 138-test backend suite). |
| `backend/app/db/repository.py` | `get_watchlist`, `add_watchlist_ticker`, `remove_watchlist_ticker` | ✓ VERIFIED | All three present, parameterized SQL only (`ruff check --select S608` clean), correct absence-as-bool / duplicate-as-ValueError conventions. |
| `backend/app/db/__init__.py` | Barrel: `init_db`, `get_watchlist`, `add_watchlist_ticker`, `remove_watchlist_ticker` | ✓ VERIFIED | Imported cleanly by `app/api/watchlist.py` and `app/main.py`. |
| `backend/app/api/watchlist.py` | `create_watchlist_router`, `build_watchlist`, GET/POST/DELETE routes | ✓ VERIFIED | Full CRUD surface present; order-of-operations matches plan (validate → persist → notify, with notify failures caught per WR-01 fix). |
| `backend/app/api/__init__.py` | Barrel: `create_watchlist_router` | ✓ VERIFIED | Present. |
| `backend/app/market/ticker.py` | `normalize_ticker`, `is_valid_ticker_format` | ✓ VERIFIED | Present, used consistently across `watchlist.py`, `simulator.py`, `massive_client.py`. |
| `backend/app/market/simulator.py` | Normalizes at `start`/`add_ticker`/`remove_ticker`; Cholesky rebuild guarded | ✓ VERIFIED | `grep -c normalize_ticker` well over 4; `_rebuild_cholesky` wraps `np.linalg.cholesky` in `try/except LinAlgError` (WR-03 fix `70072a5`), confirmed present in source. |
| `frontend/components/Watchlist.tsx` | REST-driven grid, add form, remove wiring, empty state | ✓ VERIFIED | Reads code directly; no `tickers` destructure from SSE context remains; `watchlist.length === 0` branch renders `data-testid="watchlist-empty"`. |
| `frontend/components/WatchlistRow.tsx` | Remove button, `stopPropagation` on click and keydown | ✓ VERIFIED | Both `handleRemoveClick` and `handleRemoveKeyDown` call `event.stopPropagation()`. |
| `frontend/app/page.tsx` | Single merged selection-guard effect | ✓ VERIFIED | CR-01 fix confirmed: one `useEffect` deriving target selection from both `tickers` (SSE) and `watchlist` (REST) with matching precedence — no separate ping-pong-prone effects remain. |
| `db/.gitkeep` | Tracked directory marker | ✓ VERIFIED | `git ls-files --error-unmatch db/.gitkeep` succeeds; `db/*.db{,-wal,-shm}` ignored; `db/.gitkeep` itself not ignored. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `app/main.py` lifespan | `init_db()` | `await asyncio.to_thread(init_db)` before tickers are read | ✓ WIRED | `backend/app/main.py:97` — runs first, before `get_watchlist()`. |
| `app/main.py` lifespan | `source.start(tickers)` | DB-sourced tickers, `DEFAULT_TICKERS` fallback only on empty query | ✓ WIRED | `backend/app/main.py:98-100`. |
| `app.include_router(watchlist router)` | registration order | Registered before `StaticFiles` mount | ✓ WIRED | `backend/app/main.py:113-129` — both routers registered at lines 113-114, static mount at 125-129. |
| `Watchlist.tsx` | `GET /api/watchlist` | `useWatchlist()` hook | ✓ WIRED | `frontend/components/Watchlist.tsx:31`; confirmed by `useWatchlist` implementation performing `getWatchlist()` on mount and via `refetch`. |
| `app/api/watchlist.py` | `app/db/repository.py` | `asyncio.to_thread(...)` at every handler | ✓ WIRED | All three routes (`GET`/`POST`/`DELETE`) wrap the sync repository call. |
| add form submit | `POST /api/watchlist` | `addWatchlistTicker()` → `refetch()` | ✓ WIRED | `frontend/components/Watchlist.tsx:37-57`, live-tested. |
| `POST /api/watchlist` | validation gate | `normalize_ticker` + `is_valid_ticker_format` precede DB write and notify | ✓ WIRED | `backend/app/api/watchlist.py:92-101`, live-tested (malformed/empty return 400 with no row written). |
| `market_source.add_ticker()`/`remove_ticker()` | `PriceCache` | Existing `MarketDataSource` contract (unmodified this phase) | ✓ WIRED, ✓ FLOWING | Live-observed, not just inferred: 2 seconds after `POST /api/watchlist` for `PYPL`, `GET /api/watchlist` returns a real, non-null, simulator-generated price for it. Notify calls wrapped in `try/except` per WR-01 fix so a notify failure never surfaces as an unhandled 500. |
| remove button click | `DELETE /api/watchlist/{ticker}` | `stopPropagation()` → `removeWatchlistTicker()` → `refetch()` | ✓ WIRED | `frontend/components/WatchlistRow.tsx:65-79`, `frontend/components/Watchlist.tsx:62-70`, live-tested. |
| `page.tsx` selection guard | `setSelectedTicker` | Merged single effect over `tickers` + `watchlist` | ✓ WIRED | `frontend/app/page.tsx:29-37`, regression-tested against the exact CR-01 ping-pong scenario. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `GET /api/watchlist` response | `watchlist[].price` | `PriceCache.get(ticker)` via `build_watchlist()` — real GBM-simulator-priced cache, not mocked in the live run | Yes (or explicit `null` for an unpriced ticker — never fabricated); directly observed at `244.94` for a ticker added 2s earlier | ✓ FLOWING |
| `Watchlist.tsx` grid rows | `watchlist` | `useWatchlist()` → `GET /api/watchlist` → SQLite `watchlist` table | Yes | ✓ FLOWING |
| `MainChart` selection | `selectedTicker` | `page.tsx`'s merged effect, derived from live `watchlist`/`tickers` state | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend suite (real app, TestClient, real SQLite) | `uv run --extra dev pytest -q -m "not requires_frontend_build"` | `138 passed, 1 deselected` | ✓ PASS |
| Full frontend suite | `npm run test` | `76 passed` (6 files) | ✓ PASS |
| Frontend typecheck | `npm run typecheck` | clean, no `error TS` | ✓ PASS |
| Backend lint | `uv run --extra dev ruff check app/ tests/` | `All checks passed!` | ✓ PASS |
| Live end-to-end HTTP run #1 (add → verify → remove → verify → malformed rejects) | Inline Python `TestClient` script | GET initial 200/10 → POST pypl 201 → GET 11 (PYPL present) → DELETE pypl 204 → GET 10 (PYPL absent) → POST empty 400 → POST TOOLONGTICKER 400 → GET still 10 | ✓ PASS |
| Live end-to-end HTTP run #2 (six-table check + streaming-within-seconds check) | Inline Python `TestClient` script with `sqlite_master` query and `time.sleep(2)` | All six tables present; `PYPL` shows a real non-null price 2s after being added | ✓ PASS |
| `.gitignore` runtime-file coverage | `git check-ignore -q db/finally.db{,-wal,-shm}` + `git ls-files --error-unmatch db/.gitkeep` | all as expected | ✓ PASS |
| Ping-pong regression (CR-01) | `npm run test -- Watchlist` (includes `"settles into a stable empty state, without an infinite selection loop..."`) | passing | ✓ PASS |
| Disabled-test scan (audit_test_quality gate) | `grep -rn -E "it\.skip\|describe\.skip\|test\.skip\|xit\(\|xdescribe\(\|@pytest\.mark\.skip\|@unittest\.skip\|it\.todo\|test\.todo"` over all watchlist-related backend and frontend test files | zero matches | ✓ PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` files exist in this project, and neither PLAN.md nor SUMMARY.md for this phase declare a probe-based verification step.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `backend/tests/db/test_repository.py` | WTCH-01/02 | all | 0 | no | Value (row counts, dict shape, boolean return) | Sufficient |
| `backend/tests/api/test_watchlist.py` | WTCH-01/02 | all | 0 | no | Value + status code (201/400/404/409/204, exact error keys, exact row counts) | Sufficient |
| `backend/tests/db/test_init.py` | WTCH-01/02 | all | 0 | no | Value (table names, row counts, idempotency across two calls) | Sufficient |
| `frontend/__tests__/Watchlist.test.tsx` | WTCH-01/02 | all | 0 | no | Behavioral (DOM structure, call-argument assertions, multi-step submit/remove/select flows) | Sufficient |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0 (no test file both imports the system under test and writes fixture/expected-value files). **Insufficient assertions:** 0 for requirement-linked behavior. No test-quality blockers.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WTCH-01 | 02-01 (foundation), 02-02 (implements) | User can add a ticker to the watchlist manually | ✓ SATISFIED | `POST /api/watchlist` live-verified end-to-end, including the streaming-within-seconds behavior; `REQUIREMENTS.md` already marks `[x]`; `02-VALIDATION.md`'s per-requirement map names `tests/api/test_watchlist.py -k add/malformed/duplicate` for this requirement, all present and passing. |
| WTCH-02 | 02-01 (foundation), 02-03 (implements) | User can remove a ticker from the watchlist manually | ✓ SATISFIED | `DELETE /api/watchlist/{ticker}` live-verified end-to-end; `REQUIREMENTS.md` already marks `[x]`; `02-VALIDATION.md`'s map names `tests/api/test_watchlist.py -k remove`, present and passing. |

No orphaned requirements — `REQUIREMENTS.md`'s traceability table maps only WTCH-01/WTCH-02 to Phase 2, and both appear in plan frontmatter (`02-01`: both listed as foundational; `02-02`: WTCH-01; `02-03`: WTCH-02).

**Note on `02-VALIDATION.md`:** this phase-level validation-strategy document is still `status: draft`, `nyquist_compliant: false`, and its own sign-off checklist (`## Validation Sign-Off`) is unchecked with `Approval: pending`. This is a planning artifact, not itself an executed check — but every automated command its own "Per-Task Verification Map" names (`-k add`, `-k malformed`, `-k duplicate`, `-k remove`, `-k normal`, `test_init.py`, `npm test -- Watchlist`) was independently run as part of this verification (directly, or as a subset of the full 138/76-test suites) and passes. The document's own sign-off state does not block phase completion but is flagged here since it was never formally closed out.

### Anti-Patterns Found

None. Scanned all 14 phase-touched source files (`backend/app/db/*.py`, `backend/app/api/watchlist.py`, `backend/app/market/ticker.py`/`simulator.py`/`massive_client.py`, `backend/app/main.py`, `frontend/components/Watchlist.tsx`/`WatchlistRow.tsx`, `frontend/app/page.tsx`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/empty-implementation patterns. Zero matches beyond incidental substring hits (the word "placeholder" appearing in an HTML `placeholder` attribute and in a docstring about SQL `?` placeholders — neither a debt marker).

### Code Review Findings — Disposition

`02-REVIEW.md` found 1 critical + 3 warning issues; `02-REVIEW-FIX.md` claims all 4 fixed. Independently verified, not trusted on claim alone:

| ID | Issue | Fix Commit | Verified In Source | Verified By Test |
|----|-------|-----------|---------------------|-------------------|
| CR-01 | Selection-guard ping-pong loop when watchlist empties | `bb74452` | Yes — `frontend/app/page.tsx:29-37`, single merged effect, no separate two-effect ping-pong remains | Yes — `"settles into a stable empty state, without an infinite selection loop..."` test passing |
| WR-01 | Unguarded market-source notify failure risks unhandled 500 | `9deca82`/`ad52443` | Yes — both `try/except Exception: logger.exception(...)` blocks present in `backend/app/api/watchlist.py:109-119, 140-150` | Yes — part of 138 passing backend tests |
| WR-02 | Keyboard remove-button activation also fires row selection | `f9a4e7f` | Yes — `handleRemoveKeyDown` added, calls `stopPropagation()` (`frontend/components/WatchlistRow.tsx:77-79`) | Yes — `"does not fire the row's onSelect when the remove button is activated via keyboard"` passing |
| WR-03 | `GBMSimulator.add_ticker` Cholesky desync can silently halt all price updates | `70072a5` | Yes — `_rebuild_cholesky` wraps `np.linalg.cholesky` in `try/except LinAlgError`, falls back to `None` | Yes — part of 138 passing backend tests |

All 4 confirmed fixed in source, not just claimed. IN-01/IN-02/IN-03 (info-level) were explicitly and correctly left unfixed as out of the `fix_scope: critical_warning` pass — no gap there.

### Human Verification Required

1. **Loading-flicker check on initial `GET /api/watchlist` fetch.** Reload the app and watch the watchlist grid on first paint. Expected: no visible skeleton/spinner flash or layout jump. Why human: requires observing real paint timing in a running browser; flagged `human_judgment: true` in 02-01-SUMMARY.md and never independently confirmed since.

2. **Visual/interaction confirmation of the add-ticker form and remove affordance.** In a running browser, submit the add-ticker form and click a row's `×` remove button. Expected: purple submit button, down-red `×` glyph and inline error text, disabled/"Adding…" in-flight state, and clean immediate row removal with no flash and no accidental chart-selection. Why human: visual styling/interaction feel cannot be confirmed by DOM-level Vitest assertions alone; both 02-02 and 02-03 SUMMARYs independently flag this as `human_judgment: true`.

3. **Decide on the silent-empty behavior for a failed `GET /api/watchlist`.** Force the initial watchlist fetch to fail (e.g. stop the backend momentarily) and observe the panel. Expected/current: `useWatchlist()` captures the error but `Watchlist.tsx` never renders it — the panel shows an indistinguishable empty state, not an error. Why human: this is a product/design decision (accept as-is for this phase, or file a follow-up), not a pass/fail programmatic check — and the plan's own must_haves already flagged this as an undesigned backstop item.

4. **Decide on watchlist panel overflow/scroll treatment.** Add enough tickers to exceed one screen's height and observe the panel layout. Expected/current: no `overflow`/`scroll` styling exists in `Watchlist.tsx` (grep-confirmed) — rows will push the surrounding layout with no defined cap. Why human: visual layout judgment; flagged as an open follow-up design decision in 02-01's must_haves and never resolved by 02-02 or 02-03.

5. **Confirm the failed-DELETE error actually renders where a user would see it.** Force `removeWatchlistTicker` to reject (e.g. stop the backend, click remove) and look at the page. Expected: the shared inline error slot under the add-ticker form shows the failure text. Why human: code-confirmed wired (`handleRemove` → `setError` → the shared `<p data-testid="watchlist-add-error">`), but the one automated test on this path only asserts `refetch` was skipped, not that the text renders — and the slot's position (under the *add* form, not next to the failed row) may not be where a user notices it. 02-03's must_haves explicitly left this an open backstop item for a human/future test to confirm.

(Item 5 above overlaps conceptually with the `behavior_unverified_items` entry in frontmatter — the concurrent-add race — but is listed separately since it is a design/visual judgment call, not a race-condition test gap.)

### Gaps Summary

No gaps block the phase goal. All four ROADMAP success criteria are verified end-to-end against a real running app and a real SQLite database (not mocked) — including a direct, time-delayed observation that a newly-added ticker streams a real price within 2 seconds, and a direct query confirming all six PLAN.md §7 tables exist. All four code-review findings are confirmed fixed in source (not just claimed), both v1 requirements (WTCH-01, WTCH-02) are satisfied, all four judgment-tier prohibitions are honored (flagged non-authoritative per this project's contract, not silently passed), and the full backend (138) and frontend (76) test suites plus lint/typecheck/disabled-test scan all pass cleanly.

What remains are five explicitly-scoped human-verification items — two visual/UX confirmations the executors themselves flagged as unconfirmed, one already-known and disclaimed gap (no error visual on a failed initial fetch) needing a human accept/fix decision, one open design decision (large-watchlist overflow), and one backstop item (failed-DELETE error rendering) whose wiring is confirmed but whose actual on-screen rendering is not — plus one behavior-unverified concurrency invariant with no executed test. None of these touch the four ROADMAP success criteria or the two requirement IDs — they are additional must-haves the plans themselves added and explicitly flagged as open. Routing to `human_needed` rather than `passed` per the verification process's explicit rule that any non-empty human-verification list — including behavior-unverified items — precludes a `passed` status even when the primary goal is otherwise fully met.

---

_Verified: 2026-09-18T11:35:31Z_
_Verifier: Claude (gsd-verifier)_

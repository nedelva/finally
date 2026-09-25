---
status: diagnosed
trigger: "Submitting the add-ticker form in the browser (http://localhost:8000) returns an HTTP 405 (Method Not Allowed) instead of adding the ticker. Reported during UAT for phase 02 (persistent watchlist), gap G-02-2. Per spec, POST /api/watchlist with body {ticker} should add a ticker."
created: 2026-09-19T09:24:00Z
updated: 2026-09-19T09:30:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-25
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED — see Resolution
test: n/a (diagnosis complete)
expecting: n/a
next_action: return ROOT CAUSE FOUND (goal: find_root_cause_only) — no code fix

## Symptoms

expected: POST /api/watchlist with body {ticker} adds the ticker (201) and it appears in the grid.
actual: Submitting the add-ticker form in the browser returned HTTP 405 Method Not Allowed.
errors: "the add action returns a 405 status" (user report, 02-UAT.md test 2 / gap G-02-2)
reproduction: Load http://localhost:8000, type a ticker into the add-ticker form, click "Add Ticker".
started: Reported during 02-persistent-watchlist UAT session, started 2026-09-18T13:35:00Z.

## Eliminated

- hypothesis: Backend POST /api/watchlist route is missing, misregistered, or shadowed by the static-file mount / duplicate router registration.
  evidence: Live `curl -i -X POST http://localhost:8000/api/watchlist` against the currently-running backend (PID 15524, started 2026-09-19T11:24:05 local, i.e. after all phase-02 commits) returns `201 Created` with the expected JSON body. `GET /openapi.json` shows `"/api/watchlist": ["get", "post"]` registered exactly once. `create_watchlist_router()` (backend/app/api/watchlist.py:68-76) builds a fresh `APIRouter()` per call — no module-level singleton reuse (unlike the documented anti-pattern for `stream.py`). `main.py` registers API routers before the `StaticFiles` mount (lines 113-114 before 125-129), so the catch-all static mount cannot swallow `/api/watchlist`.
  timestamp: 2026-09-19T09:26:43Z

- hypothesis: Frontend calls the wrong path/method, or the compiled static bundle is stale/out of sync with source.
  evidence: `frontend/lib/api.ts:73-89` (`addWatchlistTicker`) issues `fetch("/api/watchlist", { method: "POST", ... })` — correct path and method, matches PLAN.md's contract. Working tree has zero diff against HEAD for this file (`git diff HEAD -- frontend/lib/api.ts` empty). The compiled bundle actually served (`frontend/out/_next/static/chunks/0-pl2sotmhx4q.js`, built 2026-09-18 13:30:41, i.e. after the POST-route commit 651688b at 09:35:01 and after the last watchlist.py commit 9deca82 at 13:27:12) contains the literal string `fetch("/api/watchlist",{method:"POST",...})` — bundle matches source exactly, no staleness in the artifact itself. No Next.js `app/api/*/route.ts` handlers exist that could shadow the call under a dev server (`find frontend -iname "route.ts*"` → empty). No CORS preflight applies — page and API share the same origin (127.0.0.1:8000).
  timestamp: 2026-09-19T09:27:30Z

- hypothesis: `next.config.js`'s `trailingSlash: true` rewrites the fetch URL to `/api/watchlist/`, which the backend doesn't match.
  evidence: The compiled bundle's literal fetch call is `"/api/watchlist"` with no trailing slash (confirmed by grep on the built chunk); `trailingSlash` only affects Next's own page-routing/export output shape (e.g. `/index.html` inside directories), not hand-written `fetch()` call strings, and there is no Next server at runtime in this static-export + FastAPI architecture to apply a URL rewrite anyway.
  timestamp: 2026-09-19T09:28:00Z

## Evidence

- timestamp: 2026-09-19T09:26:43Z
  checked: `curl -i -X POST http://localhost:8000/api/watchlist -d '{"ticker":"PYPL"}'` against the live backend (started this session, after all phase-02 commits)
  found: 201 Created, ticker persisted.
  implication: Currently-committed code + currently-running process handle POST correctly. Bug is not present in the code as committed.

- timestamp: 2026-09-19T09:29:41Z
  checked: `curl -i -X POST http://localhost:8000/api/health` (a path that has ONLY a GET handler registered, by design)
  found: `HTTP/1.1 405 Method Not Allowed` / `{"detail":"Method Not Allowed"}` — byte-for-byte the same response shape the user reported for the add-ticker submit.
  implication: Demonstrates *a* 405, but this specific mechanism (path matches, method doesn't, on a route that still exists) would only apply to a process from the narrow ~12-minute window between the 02-01 commit (adds GET, 09:23:32) and the 02-02 commit (adds POST, 09:35:01) — too fragile to be the real explanation on its own. Superseded by the two entries below.

- timestamp: 2026-09-19T09:32:12Z
  checked: `curl -i -X POST http://localhost:8000/` (root path, claimed only by the `StaticFiles` mount) and `curl -i -X POST http://localhost:8000/api/watchlist/` (trailing slash — matches neither the POST-only `/api/watchlist` route nor the DELETE-only `/api/watchlist/{ticker}` route, so it falls through to the `StaticFiles` mount at `/`)
  found: Both return `HTTP/1.1 405 Method Not Allowed` / `{"detail":"Method Not Allowed"}` — identical shape to the user's reported error, reproduced on demand against the current, fully-correct, live process.
  implication: Confirms the general, robust mechanism: Starlette's `StaticFiles` mount only implements `GET`/`HEAD`; any POST that isn't claimed by an explicit API route falls through to the mount and comes back exactly this 405. This does **not** require the narrow window above — it applies to *any* process whose route table lacks the `POST /api/watchlist` handler, for whatever reason (predates commit `651688b`, predates the watchlist router's inclusion entirely, etc.), for as long as the app has mounted `StaticFiles` at `/` (true since early in the project, per `main.py`'s single-port architecture).

- timestamp: 2026-09-19T09:32:12Z
  checked: The long-lived stale process on port 8124 (PID 3758, running continuously since 2026-09-17 16:24:46, predating even the 02-01 commit) — `GET /api/watchlist`, `POST /api/watchlist`, and `GET /`
  found: All three returned `HTTP/1.1 500 Internal Server Error` (`{"error":"Internal server error"}` for the watchlist paths), and `GET /` returned `404 Not Found`. Not a clean 405/404 reproduction — this process is a different-enough artifact (likely broken by other means, e.g. contending with the current process for the same SQLite file, or genuinely running incompatible/incomplete phase-01-era code) that it doesn't cleanly replay either gap's symptom.
  implication: Inconclusive on its own — not used as primary evidence. It does corroborate that this environment accumulates stale, never-restarted uvicorn processes (the core operational finding), but its exact response shapes are not treated as confirming the specific 405/404 mechanism; the `/` and `/api/watchlist/` fallthrough tests above on the *current* process are the direct confirmation.

- timestamp: 2026-09-19T09:24:05Z (process metadata)
  checked: `ps -p <pid> -o lstart` for both uvicorn processes found on this machine.
  found: Process on port 8000 serving the app right now started 2026-09-19 11:24:05 (today, after this debug session began — restarted for this investigation). A second, unrelated long-lived process on port 8124 has been running continuously since 2026-09-17 16:24:46 — i.e. since *before* even the 02-01 commit (`3f580b8`, 2026-09-18 09:23:32) and long before the POST-route commit (`651688b`, 09:35:01) and the DELETE/notify-fix commits (13:08:38 / 13:27:12).
  implication: This codebase/environment demonstrably accumulates long-running uvicorn processes that are never restarted when backend code changes (`uv run ... uvicorn app.main:app` — no `--reload` flag, no `scripts/` restart tooling exists yet; `scripts/` is not yet built per PLAN.md, still phase-5 scope). A process left running from before commit `651688b` would have `GET /api/watchlist` registered but no `POST` handler, producing exactly the reported 405 — while the source code, TestClient-based verification, and (once restarted) a live curl against the same port all show the route working correctly.

- timestamp: 2026-09-19T09:30:00Z
  checked: `.planning/phases/02-persistent-watchlist/02-VERIFICATION.md` (automated verification report, `verified: 2026-09-18T11:35:31Z`) vs `.planning/phases/02-persistent-watchlist/02-UAT.md` (human UAT session, `started: 2026-09-18T13:35:00Z`, ~2 hours later)
  found: 02-VERIFICATION.md's truth #1 states: "Live `TestClient` run against a real SQLite file, real GBM simulator: `POST /api/watchlist {"ticker":"pypl"}` → 201" — i.e. the exact same code, exercised via a fresh in-process `TestClient` (which constructs `create_app()` fresh, picking up all current routes), succeeded shortly before the UAT session that reported the 405. The sibling gap in the same UAT session, G-02-1, was independently attributed by the user to "watching a stale page" ("the previous verification failed too — upon recheck the initial page does not show any tickers").
  implication: Corroborates a stale/un-restarted server (or stale browser tab pointed at one) as the shared root cause across both G-02-1 and G-02-2 in this UAT session, rather than two independent code defects — the code itself passed an equivalent, code-fresh check (TestClient) both before and after the reported failures.

## Resolution

root_cause: |
  Not a code defect in any of the reviewed files. All of `backend/app/api/watchlist.py`,
  `backend/app/api/__init__.py`, `backend/app/main.py`, `frontend/lib/api.ts`, and
  `frontend/components/Watchlist.tsx` correctly implement and call
  `POST /api/watchlist` (verified live via curl → 201, via OpenAPI route dump, via
  TestClient in 02-VERIFICATION.md, and via inspection of the exact compiled JS bundle
  served to the browser).

  Mechanism (confirmed, not inferred): `main.py` mounts `StaticFiles` at `/` after the
  API routers (`main.py:113-114` routers, `:125-129` mount). Starlette's `StaticFiles`
  only implements `GET`/`HEAD`. Any request whose method+path isn't claimed by an
  explicit API route falls through to that mount and Starlette returns
  `405 Method Not Allowed`. This is reproduced on demand against the current,
  fully-correct, live process: `POST /` and `POST /api/watchlist/` (trailing slash —
  matches neither the POST-only `/api/watchlist` route nor the DELETE-only
  `/api/watchlist/{ticker}` route) both return the exact `405
  {"detail":"Method Not Allowed"}` shape the user saw.

  Applied to the UAT report: the backend process the browser was actually talking to
  at UAT time (2026-09-18T13:35:00Z) did not have a `POST /api/watchlist` handler in
  its in-memory route table — either because it predated commit `651688b`
  (`feat(02-02): implement POST /api/watchlist`, 09:35:01+0200) or predated the
  watchlist router's inclusion entirely — and was never restarted after the relevant
  commits landed, so every POST to that path fell through to the `StaticFiles` mount
  and came back 405. This environment is confirmed (via `ps`) to accumulate exactly
  this kind of long-lived, stale uvicorn process: one was found running continuously
  since 2026-09-17 16:24:46, predating even the 02-01 commit, because the documented
  run command has no `--reload` flag and no restart tooling exists yet
  (`scripts/start_*` is phase-5, unbuilt scope per PLAN.md §4/§11).

  This unifies with sibling gap G-02-1 under the same single cause: a process that
  predates 02-01 entirely has no `/api/watchlist` route at all, so `GET
  /api/watchlist` also falls through to the `StaticFiles` mount, returning a 404 (or
  the SPA's `404.html`) instead of JSON. `getJson()` (`frontend/lib/api.ts:30-40`)
  captures that as a `res.ok === false` error string in `useWatchlist()`'s `error`
  state — but `Watchlist.tsx` destructures only `{ watchlist, refetch }` and never
  renders `error` (the already-identified G-02-3 gap), so the failure is silently
  swallowed and the grid simply renders empty. That is exactly the symptom the user
  reported for G-02-1 ("upon recheck the initial page does not show any tickers"). One
  stale backend process, one fallthrough mechanism, explains both blockers.

fix: (not applied — diagnosis only, per instructions)
verification: |
  Falsification tests performed live against the current (fully up-to-date, freshly
  started) process:
    - `POST /` → 405 `{"detail":"Method Not Allowed"}` (StaticFiles mount rejects
      non-GET/HEAD by design).
    - `POST /api/watchlist/` (trailing slash, unclaimed by any route) → the same 405
      shape — reproduces the user's exact symptom on demand via the confirmed
      fallthrough mechanism, without needing a genuinely stale process.
    - `POST /api/watchlist` (the real, correctly-routed path) → 201/409 as expected,
      never 405 — ruling out any live code defect.
  A long-lived stale process from 2026-09-17 (predating 02-01) was also found still
  running on a different port, corroborating that this environment does accumulate
  un-restarted uvicorn processes across code changes (its exact response shapes
  weren't clean enough to use as primary evidence, noted in Evidence).
files_changed: []

---
status: diagnosed
trigger: "DATA_START\nOn loading the app in a browser (http://localhost:8000), the watchlist panel shows no tickers at all — not a brief loading flicker, but a persistently empty grid after the page has settled. Reported during UAT for phase 02 (persistent watchlist). This feeds gap G-02-1 in .planning/phases/02-persistent-watchlist/02-UAT.md. Goal: find_root_cause_only, do not fix.\nDATA_END"
created: 2026-09-19T09:26:37Z
updated: 2026-09-19T09:26:37Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-25
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED (root cause) — Watchlist.tsx discards useWatchlist()'s `error`/`loading` state, and useWatchlist() never retries, so a successful-empty-list response and a failed-fetch response render byte-identically (empty grid, no error, no recovery) — G-02-1 and the already-documented G-02-3 are the same defect. Secondary confirmed gap: duplicate uncoordinated useWatchlist() instances (page.tsx:12, Watchlist.tsx:31). Environmental finding (demoted, not claimed as proven trigger): stale port-8124 process, verifiably running pre-phase-02 code, 500s on GET+POST right now (signature mismatches the reported 405). Which exact failure (empty-DB vs failed-fetch) triggered the original Sep-18 report is unrecoverable — db/finally.db shows no state older than this session's own fresh restart, and no request logs exist for either process.
test: Playwright route interception (abort only the render-driving GET /api/watchlist call) — directly reproduced 0 rows, no error text, no recovery after 5s+, while the independent chart-selection useWatchlist() instance correctly got data. sqlite3 introspection of db/finally.db confirmed no pre-session historical state survives.
expecting: n/a — investigation complete for find_root_cause_only scope
next_action: none — diagnosis complete, returning to caller (no fix applied per task instructions)

## Symptoms

expected: Watchlist panel shows 10 default tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) per DB seed spec, on fresh page load
actual: Watchlist panel is persistently empty after page settles (not a loading flicker)
errors: none reported yet — to be checked via curl and browser console
reproduction: Load http://localhost:8000 in browser; watchlist grid renders with zero rows
started: Reported during UAT for phase 02-persistent-watchlist

## Eliminated

- hypothesis: DB not seeded / seed data missing (backend/app/db/init.py, schema.py, repository.py)
  evidence: curl GET /api/watchlist returns 200 with all 10 default seed tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) plus one manually-added PYPL — the DB is correctly seeded and queried.
  timestamp: 2026-09-19T09:26:48Z

- hypothesis: Backend API route broken/erroring for GET (or POST) /api/watchlist
  evidence: Both curl and headless-browser GET requests return 200 with full correct data; curl POST returns 201 Created. backend/app/api/watchlist.py has correctly registered routes under the /api prefix, included before the static mount.
  timestamp: 2026-09-19T09:26:48Z / 2026-09-19T09:32:01Z

- hypothesis: Frontend static export (frontend/out) is stale relative to current source, serving old/broken JS
  evidence: git status frontend/ is clean; build mtime (Sep 18 13:30:41) postdates all relevant source file mtimes; built JS chunk contains current "api/watchlist" and "Watchlist is empty" strings matching current source exactly.
  timestamp: 2026-09-19T09:27:30Z

- hypothesis: Static file mount at "/" swallowing API requests due to registration order
  evidence: backend/app/main.py registers create_stream_router and create_watchlist_router via app.include_router() BEFORE app.mount("/", StaticFiles(...)) — correct order confirmed by direct read; live POST test also returns 201, not 405, ruling this out for the currently running code.
  timestamp: 2026-09-19T09:27:30Z

## Evidence

- timestamp: 2026-09-19T09:26:48Z
  checked: curl -i http://127.0.0.1:8000/api/watchlist against live backend (fresh restart this session)
  found: HTTP 200, JSON body `{"watchlist":[{ticker, added_at, price, previous_price, change, change_percent, direction}, ...]}` with 11 entries — the 10 seeded default tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) plus one PYPL added later (added_at 2026-09-19T09:26:43, 2s before this curl — likely from a prior manual/UAT add-ticker action). Each entry has full price/direction data.
  implication: DB IS seeded correctly (rules out db/init.py, db/schema.py, seed-data hypotheses). API route (backend/app/api/watchlist.py) IS returning data correctly (rules out repository.py query bugs, route wiring bugs). Root cause is NOT on the backend. Bug must be in frontend fetch/hook/render layer — response shape mismatch, wrong fetch path/base, silently swallowed error, or a render-guard bug in Watchlist.tsx.
- timestamp: 2026-09-19T09:26:48Z
  checked: curl -i http://127.0.0.1:8000/api/health
  found: HTTP 200 {"status":"ok"} — backend fully up and responsive
  implication: Server process is healthy; issue is not backend startup/crash related
- timestamp: 2026-09-19T09:27:30Z
  checked: git status frontend/, mtimes of frontend/out (build) vs frontend/lib/hooks.ts, api.ts, components/Watchlist.tsx, types.ts; grepped built JS chunk for "api/watchlist" and "Watchlist is empty" strings; grepped backend/app/main.py for static-mount vs API-router registration order
  found: git status frontend clean (no uncommitted drift). Build (frontend/out, mtime Sep 18 13:30:41) postdates all relevant source file mtimes (hooks.ts, api.ts, types.ts Sep 17; Watchlist.tsx Sep 18 13:11). Built chunk 0-pl2sotmhx4q.js contains both "api/watchlist" and "Watchlist is empty" strings, consistent with current source. main.py registers API routers (stream, watchlist) before the StaticFiles("/") mount, with an explicit comment noting order is load-bearing.
  implication: Rules out stale-build and route-registration-order hypotheses for the currently running instance — the served bundle and backend route registration match current source.
- timestamp: 2026-09-19T09:28:10Z
  checked: Headless Chromium (Playwright, via test/node_modules) loaded http://localhost:8000/ cold, captured console/pageerror events and all /api/* network requests+bodies, then inspected DOM (table tbody row count, [data-testid=watchlist-empty])
  found: Zero console errors/pageerrors. Two separate `GET /api/watchlist` requests fired (both 200, full 11-entry body). DOM shows 11 populated rows, "Connected" status, no empty-state element.
  implication: Bug does NOT reproduce on a clean, uncontended load against the live backend. Rules out "backend/DB broken" as the current-moment explanation. The TWO separate GET requests (not one) is itself a new finding requiring explanation — points toward duplicate/uncoordinated data fetching rather than a single hook instance.
- timestamp: 2026-09-19T09:29:00Z
  checked: grep -rn "useWatchlist(" across frontend/ (excluding lib/hooks.ts definition and test file references)
  found: Exactly two real call sites: frontend/app/page.tsx:12 (`const { watchlist } = useWatchlist();` inside `Terminal()`, used only to drive the chart ticker-selection effect) and frontend/components/Watchlist.tsx:31 (`const { watchlist, refetch } = useWatchlist();`, used to render the actual grid rows). No shared cache/context/dedup layer (no SWR/React Query) wraps these — each call site gets its own independent `useState([])` + one-shot `useEffect` fetch-on-mount, explaining the two separate GET requests observed above.
  implication: The app maintains TWO independent, uncoordinated copies of "the watchlist" in memory. They can diverge if one instance's fetch fails while the other's succeeds — one drives the chart's ticker selection, the OTHER (Watchlist.tsx's own instance) drives what's actually rendered in the grid.
- timestamp: 2026-09-19T09:30:15Z
  checked: Read frontend/lib/hooks.ts useWatchlist() (lines 77-107) in full and frontend/components/Watchlist.tsx in full
  found: useWatchlist() fetches exactly once on mount via useEffect (refetch has empty useCallback deps; unlike usePortfolio/usePortfolioHistory in the same file, there is no setInterval polling and no retry-on-error path). It DOES correctly track `error` and `loading` in its own state. However Watchlist.tsx destructures only `const { watchlist, refetch } = useWatchlist();` — it never reads `error` or `loading` from the hook at all. The component's only conditional render branch is `watchlist.length === 0` -> renders the "Watchlist is empty" placeholder (data-testid="watchlist-empty") with zero distinction from a genuinely-empty-but-successful state.
  implication: If Watchlist.tsx's own useWatchlist() fetch instance fails for any reason, the resulting state (`watchlist: []`, `error: "Network error..."`) renders identically to a legitimately empty watchlist — no error text, no retry, and nothing will ever change that render because the hook never fetches again. This matches gap G-02-3's already-documented code gap ("useWatchlist() captures a failed GET into an error string, but Watchlist.tsx never reads or renders it").
- timestamp: 2026-09-19T09:31:40Z
  checked: Playwright route interception — forced the FIRST GET /api/watchlist request to network-abort (route.abort('failed')) while letting the SECOND (and any further) requests through normally; loaded http://localhost:8000/ cold; inspected DOM immediately and again +5s later
  found: watchlistCallCount reached 2 (both hook instances fired as expected). DOM shows [data-testid=watchlist-empty] present, table tbody row count = 0, watchlist-add-error text is empty (no error shown), and this state is UNCHANGED after an additional 5 seconds of wait (no recovery). Critically, the body text snippet shows the MainChart panel correctly auto-selected and displayed "AAPL 197.92 +4.17%..." — i.e. the OTHER useWatchlist() instance (in Terminal/page.tsx) DID receive data and drove ticker auto-selection correctly, while the grid-rendering instance (in Watchlist.tsx) remained permanently empty with no indication anything failed.
  implication: Directly reproduces the exact reported symptom (persistently empty grid, no flicker/recovery, no visible error) using only a single transient failure of ONE of the two redundant, uncoordinated fetch instances — confirms the causal mechanism end-to-end. Also proves the two useWatchlist() instances are genuinely independent React state (not deduped), since one succeeded while the other failed and neither observed the other's outcome.
- timestamp: 2026-09-19T09:32:01Z
  checked: curl -i -X POST http://127.0.0.1:8000/api/watchlist -d '{"ticker":"SBUX"}' (checking whether G-02-2's reported 405 still reproduces, for context on whether the UAT session reflects current code)
  found: HTTP 201 Created, ticker added successfully. backend/app/api/watchlist.py:83-84 confirms `@router.post("/watchlist")` is correctly registered under the `/api` prefix router, included before the StaticFiles("/") mount in main.py.
  implication: G-02-2's 405 does not currently reproduce on port 8000 either — current backend code is correct for POST. Advisor review (below) flagged this as evidence the diagnosis needed to explain a moment-in-time historical divergence, not just current-code behavior.
- timestamp: 2026-09-19T09:35:00Z (advisor consult)
  checked: Called advisor after initial "dual uncoordinated fetch + swallowed error" conclusion. Advisor flagged: (1) all 10 default-ticker rows in the very first curl had added_at == 2026-09-19T09:24:05 — i.e. seeded TODAY, ~1 minute before that curl, matching this session's fresh port-8000 process start (ps: 11:24AM local); (2) frontend/out build mtime (Sep 18 13:30) predates UAT start (2026-09-18T13:35Z frontmatter) by 5 minutes, so the frontend bundle was constant across "broken then / working now" — the divergence must be backend/DB state or process, not frontend code drift; (3) the duplicate-fetch race theory predicts flakiness, but the user reported persistence across recheck; (4) told me to check for multiple db files/paths, read init.py/repository.py fully, and check git commit timestamps for backend/app/api and backend/app/db.
  implication: Correctly redirected investigation from "frontend race is THE root cause" toward "what backend/process/db state differed between the Sep 18 UAT window and now".
- timestamp: 2026-09-19T09:36:00Z
  checked: Read backend/app/db/connection.py (get_db_path/get_connection) in full; ran `find / -name finally.db` (whole filesystem) and `find . -iname "finally.db*"` (repo, including WAL/SHM sidecar files)
  found: get_db_path() resolves via `_REPO_ROOT = Path(__file__).resolve().parents[3]` — an ABSOLUTE path derived from source-file location, NOT from cwd — so `<repo_root>/db/finally.db` is the same path regardless of which directory a process was launched from. Exactly one finally.db exists on the entire machine (./db/finally.db); no -wal/-shm sidecars present (clean checkpoint). Both live uvicorn processes (port 8124 and port 8000) share cwd=`backend/` anyway.
  implication: Eliminates the "two different db files from relative-path resolution" hypothesis outright — there is only ever one db file, and the path is cwd-independent by construction. Whatever explains the historical symptom is not a split-brain database.
- timestamp: 2026-09-19T09:37:00Z
  checked: Read backend/app/db/repository.py in full; read backend/tests/conftest.py, backend/tests/db/conftest.py, backend/tests/api/conftest.py
  found: repository.py has no bulk-delete/reset function — only per-ticker INSERT (add_watchlist_ticker) and per-ticker DELETE (remove_watchlist_ticker); nothing in app code can empty the whole table except literal file deletion. tests/conftest.py has an `autouse=True` fixture `isolate_finally_db` that monkeypatches `FINALLY_DB_PATH` to a per-test tmp_path for every test — the test suite never touches the real db/finally.db.
  implication: Eliminates "pytest runs are silently wiping the real watchlist" as a hypothesis — test isolation is correctly implemented. Rules out a whole class of "why did the db go empty" explanations.
- timestamp: 2026-09-19T09:38:00Z
  checked: `ps -o pid,lstart,command` for both live backend processes; `git log --format='%cI %h %s' -- backend/app/api backend/app/db`
  found: Port-8124 process (pid 3756/3758) started **Thu Sep 17 2026 16:24:46 CEST**. The first phase-02 commit (`3f580b8 feat(02-01): persisted watchlist tracer — SQLite schema, GET /api/watchlist, database-driven lifespan`) landed **2026-09-18T09:23:32+02:00** — roughly 17 hours AFTER that process started. Port-8000 process (this session) started **Sat Sep 19 2026 11:24:05 CEST** (fresh). uvicorn was launched without `--reload` in both cases, so neither process picks up on-disk code changes after start.
  implication: The port-8124 process has been running continuously since before phase 02's watchlist API existed at all, and has never been restarted to pick up any of the 02-01/02-02/02-03 commits.
- timestamp: 2026-09-19T09:39:43Z
  checked: curl GET and POST /api/watchlist directly against port 8124 (the stale long-running process) instead of port 8000
  found: Both GET and POST /api/watchlist on port 8124 return `HTTP/1.1 500 Internal Server Error` with body `{"error":"Internal server error"}`. `/api/health` on 8124 returns 200 fine (process itself is up). `grep -rn "Internal server error" backend/app` finds ZERO matches anywhere in the current source tree. `git log --all -S "Internal server error" -- backend` shows this exact string only ever existed in one early commit (`c4c9d86`, "Implement full FinAlly platform..." — an earlier/alternate full-stack scaffold, not the current phase-by-phase 02-01/02-02/02-03 implementation).
  implication: Port 8124 is a genuine environmental hazard (stray stale process, definitively not running current code) but its failure signature is 500-on-both-GET-and-POST, NOT the reported 405-on-POST. Per Starlette internals, StaticFiles raises 405 for any non-GET/HEAD method before even checking if a file exists — a 405 specifically means "no POST route was registered in the serving process at all" (consistent with a process that has GET, i.e. post-02-01, but predates 02-02's POST route), whereas a 500 means a route WAS matched and a handler raised. These are different failure classes. Advisor review flagged this mismatch: port 8124's current 500s argue AGAINST it being the exact process hit during the original UAT (which reported 405, not 500) — demoted from "probable trigger" to "confirmed stale process / environmental hazard worth cleaning up," not evidence for G-02-1's specific mechanism.
- timestamp: 2026-09-19T09:41:00Z
  checked: sqlite3 db/finally.db "select count(*) from users_profile; select min(created_at) from users_profile; select count(*) from trades; select count(*) from portfolio_snapshots;"
  found: users_profile has exactly 1 row, created_at = 2026-09-19T09:24:05 (today, this session's fresh seed). trades = 0 rows, portfolio_snapshots = 0 rows.
  implication: Confirms the current db/finally.db file holds no state older than this session's own fresh restart — every table is either freshly seeded today or still empty. Whatever the watchlist table's row count was during the actual Sep 18 UAT window is unrecoverable; no historical evidence survives in the db, and no log files exist for either backend process. This closes off further forensic reconstruction of the exact Sep 18 trigger.
- timestamp: 2026-09-19T09:42:00Z (advisor consult)
  checked: Called advisor a second time with the full evidence set (db path/schema/test-isolation checks negative, port-8124 500-vs-reported-405 mismatch, db forensics exhausted).
  found: Advisor confirmed the db-path and test-isolation eliminations are correct and final. Confirmed the port-8124 chronology (process start 16:24:46 vs commit c4c9d86 at 16:55:15 same day) has a mundane explanation (someone ran the working tree, committed 30 min later) — not evidence of history rewriting. Most importantly, reframed the actual root-cause finding: there are exactly two mechanisms that produce the reported empty-grid DOM — (A) GET returns 200 with a genuinely empty watchlist, or (B) GET fails and the hook's error is silently discarded by Watchlist.tsx — and (A) and (B) are BYTE-IDENTICAL in the rendered DOM. The app records no distinguishing signal between them. That indistinguishability, directly proven by the route-abort reproduction (0 rows, no error text, no recovery, while the chart's independent useWatchlist() instance correctly showed AAPL), IS the diagnosable root cause of G-02-1 — not a guess at which of (A)/(B) occurred historically. Advised demoting port 8124 to "environmental hazard, not probable trigger" (500 != reported 405), and demoting the duplicate-useWatchlist()-instances finding to "real secondary gap, but do not claim it explains reported persistence" (a race predicts flakiness; the user reported persistence across recheck).
  implication: Root cause reframed and finalized per below — Resolution section restructured accordingly.

## Resolution

root_cause: |
  ROOT CAUSE (confirmed, directly reproduced): frontend/components/Watchlist.tsx:31 destructures only
  `const { watchlist, refetch } = useWatchlist();`, discarding the `error` and `loading` fields the hook
  (frontend/lib/hooks.ts:77-107) already tracks correctly. The component's only conditional render branch
  is `watchlist.length === 0` -> the "Watchlist is empty" placeholder (data-testid="watchlist-empty"). This
  means there are exactly two mechanisms that produce the reported DOM, and they are BYTE-IDENTICAL in the
  rendered output:
    (A) GET /api/watchlist returns 200 with a genuinely empty list, or
    (B) GET /api/watchlist fails for any reason and the hook's `error` state is silently dropped.
  The app records no signal distinguishing (A) from (B) anywhere — not in the DOM, not in a log the user can
  see. That indistinguishability is the diagnosable defect. It was directly reproduced via Playwright route
  interception (abort only the render-driving GET /api/watchlist call): table tbody stayed at 0 rows, the
  empty-state placeholder showed, watchlist-add-error was blank, and nothing changed after 5+ seconds of
  waiting — while a second, independent useWatchlist() instance (app/page.tsx:12, used only for chart
  ticker auto-selection) correctly received the same data and selected AAPL, proving the failure was
  isolated to Watchlist.tsx's own fetch and silently swallowed. hooks.ts's useWatchlist() also has no
  retry/poll (contrast usePortfolio:39 and usePortfolioHistory:67 in the same file, which both use
  setInterval) — so once branch (B) is entered, it is terminal for the session; only a full reload that
  happens to succeed recovers.
  This is the exact code gap already flagged as G-02-3 in 02-UAT.md ("useWatchlist() captures a failed GET
  into an error string, but Watchlist.tsx never reads or renders it") — G-02-1 and G-02-3 are the same
  underlying defect observed from two different angles (a naturally-occurring failure vs. a deliberately
  forced one).

  WHICH OF (A)/(B) ACTUALLY OCCURRED DURING THE SEP-18 UAT SESSION: not recoverable. sqlite3 introspection
  of db/finally.db shows every table's earliest row dates to 2026-09-19T09:24:05 (this session's own fresh
  restart) — the db file holds no state from the Sep-18 UAT window, and no request logs exist for either
  backend process. This uncertainty does not block the diagnosis or change the fix: whichever of (A)/(B)
  happened, the fix is the same, and after it lands the two cases become distinguishable in the UI (so any
  recurrence will self-diagnose instead of reproducing this investigation).

  SECONDARY, CONFIRMED GAP (real, but not the explanation for reported *persistence*): useWatchlist() is
  called independently in two places — app/page.tsx:12 and components/Watchlist.tsx:31 — with no shared
  cache/context/dedup, so every page load fires two uncoordinated GET /api/watchlist requests that can
  diverge (one succeeds, one fails). This is a real "dual source of truth" defect worth fixing alongside the
  above, but a race explains flakiness, not the reported persistence across recheck, so it is not claimed as
  G-02-1's primary mechanism.

  ENVIRONMENTAL FINDING (real hazard, demoted from earlier "probable trigger" theory): a stray backend
  process on port 8124 has been running continuously since 2026-09-17T16:24:46 CEST, ~17h before the first
  phase-02 commit (3f580b8) that added the watchlist API. It is verifiably running code absent from the
  current tree (its 500 response body `{"error":"Internal server error"}` has zero grep matches in
  backend/app and traces only to a superseded early scaffold commit, c4c9d86). Live right now it returns
  HTTP 500 (not 404/405) on both GET and POST /api/watchlist. Per Starlette internals, StaticFiles raises
  405 specifically for any non-GET/HEAD method before checking if a file exists — meaning a 405 (as G-02-2
  reported) signifies "no POST route was registered in the serving process," not "a route raised." Port
  8124's 500-on-both-methods is a different failure signature than the reported 405-on-POST, so this process
  is flagged as a confirmed environmental hazard worth cleaning up (kill stray dev servers; consider a
  startup banner logging the git commit hash so a stale process is self-evident) but is NOT claimed as the
  proven trigger for either G-02-1 or G-02-2.

fix: NOT APPLIED — goal is find_root_cause_only per task instructions. A fix would need to touch:

  - frontend/components/Watchlist.tsx — read and render useWatchlist()'s `error` (and ideally `loading`)
    state, so a failed fetch is visually distinct from a legitimately empty watchlist (this is G-02-3's fix
    too).
  - frontend/lib/hooks.ts — add retry/backoff (or at minimum a manual "retry" affordance) to useWatchlist()
    so a transient failure isn't terminal for the rest of the session.
  - frontend/app/page.tsx + frontend/components/Watchlist.tsx — deduplicate the two independent
    useWatchlist() call sites (e.g. lift to a shared context/provider like PriceStreamContext, or have
    Watchlist.tsx consume Terminal's already-fetched watchlist via props) so there is one source of truth.
  - Process hygiene (not a code change): kill/restart the stray port-8124 process before any further manual
    UAT so testing only ever hits current code.
verification: N/A — diagnosis only, no fix applied or verified.
files_changed: []

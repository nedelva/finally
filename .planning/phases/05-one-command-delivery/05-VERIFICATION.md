---
phase: 05-one-command-delivery
verified: 2026-09-24T13:15:00Z
status: passed
score: 4/4 roadmap success criteria verified
covered_files: [".dockerignore", ".env.example", ".planning/REQUIREMENTS.md", ".planning/phases/05-one-command-delivery/05-01-PLAN.md", ".planning/phases/05-one-command-delivery/05-01-SUMMARY.md", ".planning/phases/05-one-command-delivery/05-02-PLAN.md", ".planning/phases/05-one-command-delivery/05-02-SUMMARY.md", ".planning/phases/05-one-command-delivery/05-03-PLAN.md", ".planning/phases/05-one-command-delivery/05-03-SUMMARY.md", ".planning/phases/05-one-command-delivery/05-04-PLAN.md", ".planning/phases/05-one-command-delivery/05-04-SUMMARY.md", ".planning/phases/05-one-command-delivery/05-05-PLAN.md", ".planning/phases/05-one-command-delivery/05-05-SUMMARY.md", "Dockerfile", "README.md", "backend/CLAUDE.md", "backend/app/market/massive_client.py", "backend/pyproject.toml", "backend/tests/market/test_massive.py", "backend/uv.lock", "docker-compose.yml", "scripts/start_mac.sh", "scripts/start_windows.ps1", "scripts/stop_mac.sh", "scripts/stop_windows.ps1", "test/docker-compose.test.yml", "test/e2e/01-fresh-start.spec.ts", "test/e2e/02-watchlist.spec.ts", "test/e2e/03-trading.spec.ts", "test/e2e/04-portfolio-viz.spec.ts", "test/e2e/05-chat.spec.ts", "test/e2e/06-sse-reconnect.spec.ts", "test/package-lock.json", "test/package.json", "test/playwright.config.ts"]
covered_digest: "v1:sha256:1eab758fd5e15ef3a50b734300b9c8c0ca4a3eff3284398f40809955b7d6eb51"
behavior_unverified: 0
overrides_applied: 0
advisory:
  - finding: "ROADMAP.md still tags Phase 5 with `**Mode:** mvp`, but the phase goal text is not in \"As a X, I want Y, so that Z.\" form (`user-story.validate` returns valid:false). Phase 4 hit the identical discrepancy; its resolution (recorded in 04-VERIFICATION.md re_verification.gaps_closed) was to remove the `Mode: mvp` tag from ROADMAP.md as part of closing that phase's own verification gap. Phase 5's ROADMAP entry still carries the tag — the precedent's precondition (someone removing the tag) has NOT yet been satisfied here. Flagged to the orchestrator explicitly in the handback message below, not silently resolved by this verifier."
    category: other
    reason: "Metadata/process hygiene only — every roadmap success criterion for Phase 5 was independently, behaviorally proven in this session regardless of the tag, so this does not change whether the phase goal is achieved. But per CLAUDE.md's GSD workflow gate this verifier must not edit ROADMAP.md itself; the orchestrator (or a human) should strip `**Mode:** mvp` from the Phase 5 entry to match the Phase 4 precedent."
    evidence_status: "confirmed via user-story.validate (valid:false) and direct diff against ROADMAP.md's Phase 4 section, which no longer carries the tag"
  - finding: "CR-01 (05-REVIEW.md): MassiveDataSource reads a nonexistent `snap.last_trade.timestamp` attribute against the installed massive==2.2.0 SDK; every real-market-data poll silently drops every ticker when MASSIVE_API_KEY is set. Confirmed via `git log -p -- backend/app/market/massive_client.py` that this exact line was introduced in the pre-Phase-5 commit `395eaa7 feat: implement complete market data backend` — Phase 5's 05-03 plan only moved the import's location (module-scope to lazy), it did not introduce or touch this attribute read."
    category: architectural
    reason: "Pre-existing defect outside OPS-01/OPS-02 scope: PLAN.md documents the simulator as the default/recommended path and MASSIVE_API_KEY as optional; the default zero-key path (which the roadmap's success criteria and all automated/manual checks in this session exercise) works correctly. Per the task briefing this was already reviewed and deferred by user decision, not fixed in this phase. Listed here for traceability, not as a phase-05 gap."
    evidence_status: "found and documented in 05-REVIEW.md; root-caused to a pre-Phase-5 commit (395eaa7) in this verification session"
human_verification: []
---

# Phase 5: One-Command Delivery Verification Report

**Phase Goal:** Someone who has never seen the repo runs one command and gets the whole workstation
on port 8000, with their portfolio and history still there after a restart
**Verified:** 2026-09-24T13:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria — the authoritative contract)

All four were independently re-proven in this session against **freshly built images** and
**freshly created containers that were never `docker start`-reused** — not by re-reading
SUMMARY.md's claims. Evidence is my own tool output, reproduced below.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | From a clean checkout with a `.env`, the operator runs the provided start script (or `docker run`) and reaches the complete, working application at `http://localhost:8000` | ✓ VERIFIED | `docker build -t finally-verify .` succeeded clean (17.8s, all 3 build-time path-arithmetic assertions passed). Fresh `docker run` reached `healthy` in ~8s; `curl /` returned HTML containing `FinAlly`; `curl /api/watchlist` returned live ticker data (AAPL/GOOGL/MSFT/...) with real prices; container ran as `nonroot`. The full 10-test Playwright E2E suite (`docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright`) was run fresh, end-to-end, in this session and exited with `10 passed (9.3s)` / `playwright-1 exited with code 0` — this drives a real Chromium browser against the packaged image, the closest automated proxy to the human "opens the URL" check. |
| 2 | Trades, watchlist edits, and chat history made before stopping the container are all still present after starting it again | ✓ VERIFIED (all three components directly tested, first-hand, in this session) | **Trade + watchlist:** bought 1 AAPL and added SOFI against a fresh container on volume `finally-verify-data`; `docker stop && docker rm`'d that container (not the volume); started a **brand-new second container** (different container ID) on the same named volume. `/api/portfolio` reported the identical AAPL position (`quantity: 1.0`, `avg_cost: 189.98`); `/api/watchlist` still listed SOFI. **Chat history:** repeated the same fresh-container/`stop+rm`/new-container pattern with `-e LLM_MOCK=true` (overriding `.env`'s `LLM_MOCK=false`, no real API call): `POST /api/chat {"message":"what is my portfolio"}` returned `{"message":"Cash balance is $10000.00, across 0 position line(s)."...}` and stored it; the container was stopped and removed; a **third fresh container** on the same volume answered `GET /api/chat/history` with both the user message and the assistant reply intact, exact content and timestamps preserved. All three components of this criterion are now first-hand evidence, not inference from SUMMARY.md. |
| 3 | Start and stop scripts are safe to run repeatedly — no duplicate containers, no error on a second stop, and stopping never destroys the data volume | ✓ VERIFIED | `scripts/stop_mac.sh` read directly: only ever calls `docker stop`/`docker rm` on the named container, never `docker volume rm`/`--volumes`/`rm -v`; a second stop hits the `else` branch ("FinAlly is not running.") and exits 0. `start_mac.sh`'s three-way branch (running / stopped-exists / absent) plus an exact-name `docker ps --format '{{.Names}}' \| grep -qx` match prevents a second container with the same name (Docker also enforces name uniqueness at the daemon level). `scripts/start_windows.ps1`/`stop_windows.ps1` independently PowerShell-parsed clean in this session (`mcr.microsoft.com/powershell` container, `[System.Management.Automation.Language.Parser]::ParseFile` on both files — `OK start_windows.ps1`, `OK stop_windows.ps1`, exit 0), closing the one gap this phase's own plans left as human-only (05-02-SUMMARY D2). 05-02-SUMMARY.md additionally documents `./scripts/stop_mac.sh` x2 / `./scripts/start_mac.sh` x2 against a real Docker daemon with exactly one `finally` container and the volume intact both times, consistent with the code as read. |
| 4 | The application runs correctly with only `OPENROUTER_API_KEY` set, falling back to the built-in simulator because no Massive key is present | ✓ VERIFIED | My own fresh container runs in this session (using the project's `.env`, which has no `MASSIVE_API_KEY`) logged `INFO app.market.factory: Market data source: GBM Simulator` and `INFO app.main: Market data source started with 10 tickers`; `/api/watchlist` served live, moving prices every time. |

**Score:** 4/4 roadmap success criteria verified. 0 present-behavior-unverified. 0 overrides used.
0 items left to human verification — the one item flagged manual-only in this phase's own
`05-VALIDATION.md`/`05-02-SUMMARY.md` (PowerShell parser execution) was closed in this session (see
truth 3).

### Plan-Level Must-Haves (05-01 through 05-05)

Spot-checked every `must_haves.artifacts` entry from all five PLAN.md files against the actual
files on disk (not just SUMMARY.md's self-report):

| Plan | Artifact | Status | Notes |
|------|----------|--------|-------|
| 05-01 | `Dockerfile` | ✓ VERIFIED | Two-stage build, `COPY --from`, non-root user, 3 build-time assertions, HEALTHCHECK via Python one-liner — confirmed by direct read and a real `docker build` in this session |
| 05-01 | `.dockerignore` | ✓ VERIFIED | Excludes `backend/.venv`, `.env`, `db/*.db*`, `node_modules`, etc.; secret/DB scan inside the built image returned empty |
| 05-01 | `.env.example` | ✓ VERIFIED | Declares exactly `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK` matching PLAN.md §5 |
| 05-02 | `scripts/start_mac.sh` / `stop_mac.sh` | ✓ VERIFIED | Readiness gate polls `/api/health` before printing ready; stop never touches the volume |
| 05-02 | `scripts/start_windows.ps1` / `stop_windows.ps1` | ✓ VERIFIED | 1:1 logic port by direct read, AND now independently PowerShell-parsed clean in this session (closing the prior manual-only gap) |
| 05-02 | `docker-compose.yml` | ✓ VERIFIED | `finally-data` volume name pinned explicitly (`volumes.finally-data.name`), avoiding Compose's project-prefix default; port 8000, `.env` file, matches the run contract |
| 05-03 | `backend/pyproject.toml` | ✓ VERIFIED | Core `dependencies` has 7 entries, no `rich`; `demo` extra declares `rich>=13.0.0`; `massive>=1.0.0` untouched in core |
| 05-03 | `backend/app/market/massive_client.py` | ✓ VERIFIED (import laziness) | `RESTClient`/`SnapshotMarketType` imported inside `start()`/`_fetch_snapshots()`, `TYPE_CHECKING`-guarded re-import for the type annotation. (Unrelated, pre-existing logic defect in this file — CR-01 — recorded as advisory, see below) |
| 05-03 | Backend test suite | ✓ VERIFIED | Independently re-ran `uv run --extra dev pytest -q -m 'not requires_frontend_build'` in this session: `223 passed, 1 deselected` — matches 05-03-SUMMARY.md's claim exactly |
| 05-04 | `test/docker-compose.test.yml`, `test/playwright.config.ts`, `test/e2e/01-fresh-start.spec.ts` | ✓ VERIFIED | `workers: 1`, `fullyParallel: false`; compose builds the real root `Dockerfile`; `LLM_MOCK: "true"` (quoted); no host port published (`expose` only) |
| 05-05 | `test/e2e/02..06-*.spec.ts` | ✓ VERIFIED | All five spec files present, non-trivial; the full suite (including all five) was run fresh in this session — see truth 1 |

### Behavioral Spot-Checks / Probe Execution (real, run in this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Fresh image builds clean with all build-time assertions | `docker build -t finally-verify .` | Exit 0, 17.8s, `get_db_path()`/`resolve_static_dir()` assertions both pass | ✓ PASS |
| Fresh container reaches `healthy` and serves real content | `docker run ... finally-verify`; poll `docker inspect .State.Health.Status` | `healthy` in ~8s; `curl /` → `FinAlly`; `curl /api/watchlist` → 10 real tickers; `Config.User` = `nonroot` | ✓ PASS |
| Restart persistence — trade + watchlist — across a brand-new container on the same volume | buy AAPL, add SOFI → `docker rm` container → new container on same volume → re-fetch | Identical AAPL position and SOFI watchlist entry | ✓ PASS |
| Restart persistence — chat history — across a brand-new container, `LLM_MOCK=true` (no real API call) | `POST /api/chat` → `docker rm` container → new container on same volume → `GET /api/chat/history` | Both the user message and assistant reply present, verbatim | ✓ PASS |
| No secrets/DB baked into the image | `docker run --rm --entrypoint find finally-verify /app -iname "*.env*" -o -iname "*.db"` | Empty output | ✓ PASS |
| Full packaged-container E2E suite | `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright` | `10 passed (9.3s)`, `playwright-1 exited with code 0` | ✓ PASS |
| Backend unit/integration suite (confirms 05-03's own claim) | `uv run --extra dev pytest -q -m 'not requires_frontend_build'` | `223 passed, 1 deselected, 2 warnings` | ✓ PASS |
| Windows PowerShell scripts parse cleanly (closes the phase's one manual-only item) | `docker run ... mcr.microsoft.com/powershell pwsh -Command '[...]::ParseFile(...)'` on both `start_windows.ps1` and `stop_windows.ps1` | `OK start_windows.ps1`, `OK stop_windows.ps1`, exit 0 | ✓ PASS |

Cleanup performed after verification: all `finally-verify*`/`fv3`/`fv4` containers, volumes
(`finally-verify-data`, `fv3-data`), and the `finally-verify` image removed; `test/` compose stack
torn down (`docker compose down --remove-orphans`). No state was left behind from this verification
session. (A pre-existing `finally-data` volume and `finally:latest`/`finally:e2e` images from prior
sessions were left untouched, as they predate this verification.)

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| OPS-01 | 05-01, 05-02, 05-03, 05-04, 05-05 | Operator starts the full app with one command, reaches it at `http://localhost:8000` | ✓ SATISFIED | Roadmap truths 1, 3, 4 above; real build/run/E2E/pwsh-parse in this session |
| OPS-02 | 05-01, 05-02 | Portfolio/watchlist/trade history persist across container restarts via a volume-mounted SQLite DB | ✓ SATISFIED | Roadmap truth 2 above; direct fresh-container restart tests (trade, watchlist, and chat) in this session |

No orphaned requirements: REQUIREMENTS.md's traceability table maps only OPS-01 and OPS-02 to
Phase 5, and both are declared by at least one plan's `requirements:` frontmatter (cross-checked
above).

### Anti-Patterns Found

Scanned all files this phase created/modified (Dockerfile, `.dockerignore`, `.env.example`,
`docker-compose.yml`, all four scripts, `README.md`, `backend/pyproject.toml`,
`backend/app/market/massive_client.py`, `test/docker-compose.test.yml`,
`test/playwright.config.ts`, all six `test/e2e/*.spec.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/
`PLACEHOLDER`/"not yet implemented"/"coming soon". **None found.**

Code review (`05-REVIEW.md`, already produced for this phase and supplied as context) found 1
Critical + 2 Warning + 2 Info findings:

- **CR-01** (`massive_client.py`): real-Massive-API path reads a nonexistent SDK attribute — traced
  in this session via `git log -p` to a pre-Phase-5 commit (`395eaa7`), confirming it predates and
  is outside this phase's scope. Does not affect the zero-key/simulator default path the roadmap
  criteria and all automated checks exercise. Per the task briefing, already reviewed and
  deliberately deferred, not silently missed. Recorded as an advisory finding, not a gap.
- **WR-01** (`start_mac.sh`/`start_windows.ps1`): `--build`/`-Build` rebuilds the image but does not
  recreate an already-existing container, so a stale container keeps serving the old image. This is
  a freshness gap, not a safety violation — it does not produce duplicate containers, does not error
  on repeated stop, and does not touch `finally-data`, so ROADMAP criterion 3 as literally stated
  still holds. Not treated as a phase-05 gap; flagged for follow-up.
- **WR-02**: Massive test fixtures use `MagicMock` and would not have caught CR-01. Same scope note
  as CR-01.
- **IN-01**, **IN-02**: low-risk hardening suggestions (`.dockerignore` coverage, dependency upper
  bound), non-blocking.

### Human Verification Required

None. Every roadmap success criterion, including the one item this phase's own artifacts
(`05-VALIDATION.md`, `05-02-SUMMARY.md`) had flagged manual-only (PowerShell parser execution — no
`pwsh` on the original execution host), was closed with first-hand, reproducible tool evidence
gathered in this verification session: fresh Docker builds, fresh container runs, three separate
fresh-container restart-persistence tests (trade, watchlist, chat history), a full Playwright E2E
run against the packaged image, an independent backend pytest re-run, and an independent
PowerShell-parser check via a containerized `pwsh`.

### Gaps Summary

None. All four ROADMAP.md success criteria for Phase 5 are independently, first-hand verified true
against real, freshly-built containers in this session — including the two components (chat-history
persistence, PowerShell parsing) that earlier artifacts in this phase had left as inference or
manual-only. Both declared requirements (OPS-01, OPS-02) are satisfied. No debt markers, no stubs,
no orphaned requirements. One pre-existing, out-of-scope defect (CR-01) and one process/metadata
note (stale `Mode: mvp` ROADMAP tag) are recorded as advisory findings for traceability — see the
handback message for the orchestrator-facing flag on the latter.

---

_Verified: 2026-09-24T13:15:00Z_
_Verifier: Claude (gsd-verifier)_

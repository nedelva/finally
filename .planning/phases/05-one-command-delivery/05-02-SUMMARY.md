---
phase: 05-one-command-delivery
plan: 02
subsystem: infra
tags: [docker, docker-compose, bash, powershell, operator-scripts, persistence]

# Dependency graph
requires:
  - phase: 05-one-command-delivery (plan 01)
    provides: Dockerfile with FINALLY_DB_PATH=/app/db/finally.db, FINALLY_STATIC_DIR pins, and a Python-based HEALTHCHECK against /api/health
provides:
  - Idempotent scripts/start_mac.sh and scripts/stop_mac.sh with a readiness gate that blocks until /api/health answers
  - 1:1 PowerShell ports scripts/start_windows.ps1 and scripts/stop_windows.ps1
  - docker-compose.yml as a third, verified-equivalent encoding of the run contract
  - README.md "Running FinAlly" section documenting all three launch paths
  - Real restart-persistence proof: a trade, a watchlist add, and a chat message all survive a full stop/start cycle and a compose up/down cycle against the same finally-data volume
affects: [operator onboarding, phase-05 ship gate, any future deployment tooling]

# Actuals (#2632)
actuals:
  tokens: 2064
  tasks: 3
  commits: 3
plan_head_before: 56aed1ebc79207c512972b5b4cf482fe90e31748

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent operator lifecycle scripts: exact-name docker ps/ps -a matching, build-if-absent, never-touch-the-volume stop"
    - "Docker Compose named-volume pinning (`volumes.<name>.name:`) so a compose-managed container addresses the exact same named store as script-managed containers, not a project-prefixed one"

key-files:
  created:
    - scripts/start_mac.sh
    - scripts/stop_mac.sh
    - scripts/start_windows.ps1
    - scripts/stop_windows.ps1
    - docker-compose.yml
  modified:
    - README.md

key-decisions:
  - "Pinned `volumes.finally-data.name: finally-data` in docker-compose.yml — Compose's default behavior prefixes named volumes with the project name (derived from the directory name), which would have silently mounted a *different* volume than the one scripts/start_mac.sh creates, breaking the plan's own 'both launchers address the same store' guarantee"
  - "start_mac.sh's 'already running' branch falls through to the same unconditional readiness poll rather than an early exit — functionally equivalent to the three-branch description in the plan's action text, but keeps the readiness guarantee (never announce success without a live /api/health) as a single code path instead of duplicating the ready-message across branches"
  - "Wrote a throwaway root .env (OPENROUTER_API_KEY=placeholder-not-a-real-key, MASSIVE_API_KEY=, LLM_MOCK=true) per Task 1's own precondition instruction, since this fresh worktree had none; confirmed gitignored and never committed"

requirements-completed: [OPS-02]
# OPS-01 is also declared by this plan's frontmatter but stays open — it is
# shared with sibling plan 05-05, which has not produced a SUMMARY yet
# (see .planning/REQUIREMENTS.md traceability table). OPS-02 is declared
# only by 05-01 (already complete) and this plan, so it is now fully ready
# and has been marked complete via `gsd-tools requirements mark-complete`.

coverage:
  - id: D1
    description: "Idempotent macOS/Linux start/stop scripts with a readiness gate and a verified real restart-persistence round trip"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "bash -n + executable-bit + destructive-pattern grep (scripts/start_mac.sh, scripts/stop_mac.sh)"
        status: pass
      - kind: other
        ref: "./scripts/stop_mac.sh x2, ./scripts/start_mac.sh x2 against a real Docker daemon — exactly one `finally` container, `finally-data` volume intact"
        status: pass
      - kind: other
        ref: "real trade + watchlist-add + chat POST, ./scripts/stop_mac.sh, ./scripts/start_mac.sh, re-fetch /api/portfolio /api/watchlist /api/chat/history — AAPL quantity 1.0 identical before/after, SOFI present, chat message present"
        status: pass
    human_judgment: false
  - id: D2
    description: "Windows PowerShell 1:1 ports of the start/stop scripts with the same run-contract literals and non-destructive stop"
    verification:
      - kind: other
        ref: "grep for the five run-contract literals in start_windows.ps1; destructive-pattern grep over stop_windows.ps1"
        status: pass
    human_judgment: true
    rationale: "pwsh is not installed on this macOS execution host, so the PowerShell parser validation step in the plan's own <verify> block could not run — only structural/literal review was possible. A human (or a CI leg with pwsh available) should confirm the scripts actually parse and execute correctly before shipping to a Windows operator."
  - id: D3
    description: "docker-compose.yml as a third equivalent encoding of the run contract, and a README section documenting all three launch paths"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "docker compose -f docker-compose.yml config — validates, exactly one service, finally-data pinned as the literal volume name"
        status: pass
      - kind: other
        ref: "./scripts/stop_mac.sh, docker compose up -d, poll docker inspect -f {{.State.Health.Status}} finally until healthy, curl /api/portfolio confirms the Task-1 AAPL position, docker compose stop && rm -f"
        status: pass
      - kind: other
        ref: "grep for start_mac.sh / start_windows.ps1 / the original docker run line in README.md; git diff README.md shows additions only"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 02: Idempotent Operator Lifecycle Summary

**Idempotent start/stop scripts (bash + PowerShell) and a docker-compose.yml wrapper, all verified against real Docker containers to reach the exact same `finally-data` store, with trades, watchlist edits, and chat history proven to survive a full stop/start cycle.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `scripts/start_mac.sh` builds the image if absent, starts or creates the `finally` container, and blocks on a 90-second `/api/health` poll before printing the ready message — never announces readiness against a still-booting or degraded container.
- `scripts/stop_mac.sh` stops and removes only the `finally` container; a non-comment-line grep confirms it can never reach `docker volume rm`/`--volumes`/`rm -v` against `finally-data`.
- Real end-to-end persistence proof: bought 1 AAPL, added SOFI to the watchlist, sent a chat message, stopped the container, started it again — AAPL quantity was identical (`1.0` before and after), SOFI was still watched, and the chat message was still in `/api/chat/history`.
- `scripts/start_windows.ps1` / `scripts/stop_windows.ps1` are 1:1 logic ports carrying the same three constants, three-state branch, readiness poll, and non-destructive stop.
- `docker-compose.yml` is a third encoding of the run contract, with the named volume explicitly pinned to `finally-data` (not Compose's default project-prefixed name) so it addresses the identical store as the scripts — proven by `docker compose up -d` after a script-managed stop still showing the Task 1 AAPL position.
- `README.md` gained a "Running FinAlly" section documenting all three equivalent launch paths, with the pre-existing Quick Start and Environment Variables content untouched (additions only).

## Task Commits

Each task was committed atomically:

1. **Task 1: Start, stop, start again — the macOS/Linux operator lifecycle** - `a4a68c6` (feat)
2. **Task 2: The same lifecycle on Windows** - `7158cf1` (feat)
3. **Task 3: `docker-compose.yml` wrapper and the documented operator path** - `803651a` (feat)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `scripts/start_mac.sh` - Idempotent macOS/Linux launcher; build-if-absent, three-state container branch, 90s readiness poll against `/api/health`
- `scripts/stop_mac.sh` - Idempotent macOS/Linux stopper; container-only, never touches `finally-data`
- `scripts/start_windows.ps1` - PowerShell 1:1 port of `start_mac.sh`
- `scripts/stop_windows.ps1` - PowerShell 1:1 port of `stop_mac.sh`
- `docker-compose.yml` - Third run-contract encoding; `container_name: finally`, pinned `finally-data` volume name
- `README.md` - New "Running FinAlly" section (raw Docker, scripts, Compose); existing content unchanged

## Decisions Made
- Pinned `volumes.finally-data.name: finally-data` in `docker-compose.yml` (see key-decisions above — this was a real, verified bug caught by running `docker compose config` before the runtime test, not a hypothetical).
- `start_mac.sh`'s "already running" branch falls through to the shared readiness poll rather than an early `exit 0`, keeping "never print ready without a live health check" as one code path.
- Wrote a throwaway root `.env` per Task 1's precondition (the worktree had none); confirmed gitignored, never staged or committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `docker-compose.yml`'s default volume naming would have addressed a different store than the scripts**
- **Found during:** Task 3, immediately after authoring `docker-compose.yml` and running `docker compose -f docker-compose.yml config`
- **Issue:** Compose's default project name is derived from the containing directory (here, the worktree directory name), which prefixes unpinned named volumes — `docker compose config` showed the resolved volume as `agent-ae0f9b09e3b5decf6_finally-data`, not the literal `finally-data` the start/stop scripts use. Left as-is, `docker compose up -d` would have silently created and mounted a brand-new, empty volume instead of the one holding the Task 1 AAPL position — directly contradicting the plan's own acceptance criterion that Compose and the scripts "address the same store."
- **Fix:** Added `name: finally-data` under the top-level `volumes.finally-data` block, pinning the literal volume name regardless of the Compose project name.
- **Files modified:** `docker-compose.yml`
- **Verification:** Re-ran `docker compose -f docker-compose.yml config` — output now shows `volumes: finally-data: name: finally-data`. Confirmed end-to-end: `docker compose up -d` after `./scripts/stop_mac.sh` reached `healthy` and `/api/portfolio` still reported the AAPL position created by the scripts in Task 1.
- **Committed in:** `803651a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential correctness fix — without it, the plan's own runtime verification step for Task 3 would have failed (no AAPL position in a fresh, wrongly-named volume). No scope creep; the fix is a single line inside the file the task already specified.

## Issues Encountered
- `pwsh` (PowerShell) is not installed on this macOS execution host, so the plan's own conditional parser-validation step in Task 2's `<verify>` could not execute the `pwsh` branch. Per the task's own fallback instructions, this is recorded here as a known gap rather than silently skipped: `scripts/start_windows.ps1` and `scripts/stop_windows.ps1` have been validated only by structural review, literal-presence grep, and destructive-pattern grep — not by an actual PowerShell parser or a Windows runtime.

## User Setup Required
None - no external service configuration required beyond the existing `OPENROUTER_API_KEY` documented in Phase 4.

## Next Phase Readiness
- OPS-02 (restart persistence) is now fully satisfied and marked complete in `.planning/REQUIREMENTS.md` — both plans declaring it (05-01, 05-02) are done.
- OPS-01 remains open: it is also declared by sibling plan `05-05`, which has not yet produced a SUMMARY. No action needed from this plan; the shared-ID gate will mark OPS-01 complete automatically once 05-05 finishes.
- A real Docker daemon on this host now has a `finally` image, a `finally-data` volume (containing a live AAPL position, SOFI watchlist entry, and one chat message from this plan's verification), and no running container (the compose test container was stopped and removed as part of Task 3's own verification cleanup). Whoever runs the phase's final E2E/ship gate should be aware `finally-data` is not pristine — it carries this plan's test data, not a fresh $10,000 portfolio.

---
*Phase: 05-one-command-delivery*
*Completed: 2026-09-24*

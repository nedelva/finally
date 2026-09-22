---
phase: 05-one-command-delivery
plan: 04
subsystem: e2e-testing
tags: [playwright, docker-compose, e2e, package-legitimacy-gate]
requires:
  - phase: 05-one-command-delivery
    provides: "05-01's Dockerfile (real production image the E2E suite builds and drives)"
provides:
  - "test/package.json + test/package-lock.json: committed, exact-pinned @playwright/test devDependency"
  - "test/playwright.config.ts: sequential-execution config (workers 1, fullyParallel false), spec-ordering convention plan 05-05 inherits"
  - "test/docker-compose.test.yml: two-service (backend, playwright) harness building the real Dockerfile, LLM_MOCK quoted true, no volume mount, expose-only"
  - "test/e2e/01-fresh-start.spec.ts: passing fresh-start scenario proven against the packaged container"
  - "The standardized suite command proven to exit 0 on pass and non-zero on failure"
affects: [05-05, e2e-suite-expansion]
actuals:
  tokens: 3200
  tasks: 3
  commits: 2
  plan_head_before: e79006eede3ac810028310317368edd449244aa0
tech-stack:
  added: ["@playwright/test 1.63.0", "mcr.microsoft.com/playwright:v1.63.0-noble"]
  patterns:
    - "Two-digit numeric spec-filename prefix (01-, 02-, ...) encodes required run order under workers:1/fullyParallel:false"
    - "E2E compose service hostname avoided colliding with a browser-enforced HSTS-preloaded gTLD (renamed app -> backend)"
key-files:
  created:
    - test/package.json
    - test/package-lock.json
    - test/playwright.config.ts
    - test/docker-compose.test.yml
    - test/e2e/01-fresh-start.spec.ts
  modified:
    - .gitignore
key-decisions:
  - "Task 1's blocking package-legitimacy checkpoint (gate=blocking-human, SUS verdict on @playwright/test) was resolved by the real human user between executor instances; re-verified npm view @playwright/test version still returns 1.63.0 before installing, per resume instructions — no re-presentation of the checkpoint"
  - "Renamed the E2E compose app service from 'app' to 'backend' (Rule 3 blocking-issue fix) — Chromium's compiled-in HSTS preload for the Google-owned .app gTLD matches the bare hostname 'app' and force-upgrades http:// navigations to https, producing net::ERR_SSL_PROTOCOL_ERROR against this plain-HTTP container; confirmed empirically (curl succeeds, Playwright succeeds by raw IP, fails by the 'app' hostname with every HttpsUpgrades-family Chromium flag disabled)"
  - "Added test/test-results/ and test/playwright-report/ to .gitignore (Rule 2) — Playwright's generated per-run output was appearing as untracked files through the compose bind mount and must never be committed"
patterns-established:
  - "Spec-ordering convention: two-digit numeric filename prefix is load-bearing under sequential execution; 01-fresh-start must run first since it asserts a pristine $10,000.00 balance"
requirements-completed: [OPS-01]
coverage:
  - id: D1
    description: "E2E package manifest and committed lockfile install cleanly via npm ci"
    requirement: "OPS-01"
    verification:
      - kind: command
        ref: "npm --prefix test ci && npm --prefix test exec -- playwright --version"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sequential Playwright config enforces workers:1/fullyParallel:false and reads BASE_URL"
    requirement: "OPS-01"
    verification:
      - kind: command
        ref: "grep -q 'workers: 1' test/playwright.config.ts && grep -q 'fullyParallel: false' test/playwright.config.ts && grep -q 'BASE_URL' test/playwright.config.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "One command builds the real production image, boots it, and drives a real browser against the fresh-start scenario, exiting 0 on pass"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright (observed exit 0, '1 passed')"
        status: pass
    human_judgment: false
  - id: D4
    description: "The same command reports failure truthfully (non-zero exit) against a deliberately broken assertion"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "same command re-run against a corrupted cash assertion (observed exit 1, '1 failed'); corruption reverted before commit"
        status: pass
    human_judgment: false
duration: ~10min
completed: 2026-09-22
status: complete
---

# Phase 5 Plan 4: E2E Harness (Playwright + Docker Compose) Summary

**Stood up a two-service Playwright/Docker Compose E2E harness that builds the real production image and proves, in both directions, that the fresh-start scenario (default watchlist, $10,000.00 cash, streaming prices) passes against the packaged container and the gate fails loudly when it should.**

## Performance
- **Duration:** ~10min (continuation agent's own wall clock; Task 1's checkpoint pause/human-review time from the prior executor instance is excluded)
- **Started:** 2026-09-22T19:57:00Z (approx.)
- **Completed:** 2026-09-22T20:06:05Z
- **Tasks:** 3 (Task 1 checkpoint resolved by human before this agent spawned; Tasks 2–3 executed by this agent)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `test/package.json` + committed `test/package-lock.json` pin `@playwright/test` at the human-approved exact version `1.63.0`, matching the audit in `05-RESEARCH.md`.
- `test/playwright.config.ts` forces sequential execution (`workers: 1`, `fullyParallel: false`) and documents the load-bearing two-digit spec-filename ordering convention that plan 05-05 inherits.
- `test/docker-compose.test.yml` builds the real production `Dockerfile` (not the source tree), runs it under `LLM_MOCK: "true"` (quoted, exact-string match) with a placeholder `OPENROUTER_API_KEY`, mounts no volume (disposable per run), and exposes port 8000 only on the compose network.
- `test/e2e/01-fresh-start.spec.ts` asserts the literal `$10,000.00` cash balance, all ten seeded tickers, and that a ticker's price changes within a polling window — no fixed sleeps.
- The standardized suite command was proven in both directions: exit 0 against the committed spec ("1 passed"), exit 1 against a deliberately-corrupted assertion ("1 failed"), corruption reverted before the commit that shipped.

## Task Commits
1. **Task 2: E2E package manifest, committed lockfile, and sequential Playwright config** - `7270572`
2. **Task 3: End-to-end harness — real image, real browser, one real scenario** - `a7e60ab`

(Task 1 — the blocking package-legitimacy checkpoint — was resolved by the human user before this continuation agent was spawned; no code changes, no commit, per the resume context.)

**Plan metadata:** commit pending (this SUMMARY + REQUIREMENTS.md, per `git_commit_metadata` step)

## Files Created/Modified
- `test/package.json` - E2E npm manifest, `@playwright/test` pinned exactly to `1.63.0`
- `test/package-lock.json` - Committed lockfile so `npm ci` in the compose file resolves
- `test/playwright.config.ts` - Sequential-execution config; documents the spec-ordering convention
- `test/docker-compose.test.yml` - Two-service (`backend`, `playwright`) E2E harness
- `test/e2e/01-fresh-start.spec.ts` - Fresh-start scenario spec, proven passing against the real container
- `.gitignore` - Excludes `test/test-results/` and `test/playwright-report/` (Playwright's generated per-run output)

## Decisions Made
- Re-ran `npm view @playwright/test version` as instructed before installing; it still returned `1.63.0`, matching the plan's pinned value, so Task 1's checkpoint resolution ("approved") was applied without re-presenting it.
- Renamed the compose app service from `app` to `backend` — see Deviations below.
- Added Playwright's generated output directories to `.gitignore` — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Renamed the E2E compose service from `app` to `backend`**
- **Found during:** Task 3, first `docker compose up` run
- **Issue:** The plan's `must_haves` truths and code example specify the app service as `app`, reachable at `app:8000`. Running the suite against that literal hostname produced `net::ERR_SSL_PROTOCOL_ERROR` on every `page.goto("/")`, with the app container logging `WARNING: Invalid HTTP request received.` — i.e. the browser sent TLS bytes to a plain-HTTP server. Root cause, confirmed empirically: Chromium ships a compiled-in HSTS-preload entry for the Google-owned `.app` gTLD that also matches the bare single-label hostname `app`, forcing every `http://app:...` navigation to upgrade to HTTPS regardless of the explicit scheme. `curl http://app:8000/api/health` succeeded (proving the network/container was fine); a minimal Playwright script navigating to the same container by raw IP address succeeded; the same script navigating to the `app` hostname failed identically even with every `--disable-features=HttpsUpgrades`-family Chromium launch flag tried. This is a technical impossibility with the plan's literal hostname choice, not a configuration bug in this harness.
- **Fix:** Renamed the compose service (and its `depends_on`/`BASE_URL` references) from `app` to `backend`, which carries no HSTS-preload or public-suffix collision. The underlying `must_haves` intent — reachable only on the compose network, no host port published — is fully preserved; only the literal label changed. Documented inline in `test/docker-compose.test.yml`'s header comment.
- **Files modified:** `test/docker-compose.test.yml`
- **Verification:** Full suite re-run after the rename: `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright` exited 0 with `1 passed`. `docker compose ... config --services` confirms exactly two services (`backend`, `playwright`).
- **Commit:** `a7e60ab`

**2. [Rule 2 - Missing critical functionality] `.gitignore` did not exclude Playwright's generated output**
- **Found during:** Task 3, after the first full suite run
- **Issue:** `test/docker-compose.test.yml`'s `playwright` service bind-mounts `../test:/tests`, so Playwright's `test-results/` output directory (and would-be `playwright-report/` on a configured HTML reporter) writes back to the host `test/` tree and showed up as untracked files (`git status` reported `?? test/test-results/`). Left as-is, every future suite run would leave uncommitted, growing runtime artifacts in the working tree.
- **Fix:** Added `test/test-results/` and `test/playwright-report/` to the root `.gitignore`, and removed the already-generated `test/test-results/` directory before committing.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` after a full suite re-run shows no untracked files.
- **Commit:** `a7e60ab`

---
**Total deviations:** 2 auto-fixed (1 Rule 3 blocking-issue fix, 1 Rule 2 missing-hygiene fix)
**Impact on plan:** No scope change. The suite command string standardized by this plan (`docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright`) is unchanged and still copies verbatim into later gates, as the plan's "costly reversibility" note requires — only the internal compose hostname `app`→`backend` changed, which is invisible to that command string and to `BASE_URL` consumers outside this compose file.

## Issues Encountered
None beyond the two deviations above, both resolved during execution.

## User Setup Required
None. `test/docker-compose.test.yml` requires no operator setup beyond Docker/Docker Compose, already confirmed present in `05-RESEARCH.md`'s Environment Availability table.

## Next Phase Readiness
Plan 05-05 can add `test/e2e/02-*.spec.ts` onward, inheriting: the `backend`/`playwright` compose service names and `BASE_URL=http://backend:8000` (not `app:8000` — see Deviation 1), the two-digit spec-filename ordering convention, and the proven-both-directions suite command. No blockers.

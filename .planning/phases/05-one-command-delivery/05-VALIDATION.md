---
phase: "05"
slug: "one-command-delivery"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-22"
validated: "2026-09-24"
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` 1.63.0 (new — `test/` currently has no `package.json`, only a stray config-less `node_modules/`) |
| **Config file** | `test/playwright.config.ts` (new) |
| **Quick run command** | `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit` |
| **Full suite command** | Same — this phase has one E2E suite, no separate "quick" subset |
| **Estimated runtime** | ~180 seconds (container build + full E2E suite; unconfirmed until Wave 0 lands) |

---

## Sampling Rate

- **After every task commit:** `docker build .` for Dockerfile/script tasks (fast fail on layout/lockfile errors); existing `uv run --directory backend pytest` / `npm --prefix frontend run test` for any backend/frontend dependency-hygiene tasks (e.g. the `rich`/`massive` lazy-import fix)
- **After every plan wave:** Full `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit`
- **Before `/gsd-verify-work`:** Full E2E suite green **and** the manual OPS-02 restart-persistence sequence confirmed
- **Max feedback latency:** ~180 seconds

---

## Per-Task Verification Map

Reconstructed post-execution from each plan's `coverage:` block (27 deliverables across 5 plans). Full detail lives in each `05-0N-SUMMARY.md`; this table is the requirement-level rollup.

| Plan | Wave | Requirement | Deliverables | Test Type | Status |
|------|------|-------------|---------------|-----------|--------|
| 05-01 (Docker Packaging) | 1 | OPS-01, OPS-02 | D1–D7 | integration (real `docker build`/`docker run`) | ✅ 6/7 automated pass, D4 manual (visual browser check) |
| 05-02 (Operator Lifecycle Scripts) | 3 | OPS-01, OPS-02 | D1–D3 | integration (real Docker daemon) | ✅ D1/D3 automated pass incl. real restart-persistence round trip; D2 manual (no `pwsh` on host — structural review only) |
| 05-03 (Dependency Cleanup) | 2 | OPS-01 | D1–D5 | unit | ✅ 5/5 automated pass |
| 05-04 (E2E Harness) | 2 | OPS-01 | D1–D4 | command/e2e | ✅ 4/4 automated pass |
| 05-05 (Remaining E2E Scenarios) | 3 | OPS-01 | D1–D6 | e2e | ✅ 6/6 automated pass (10 Playwright tests, full suite green) |

**Requirement rollup:**
- **OPS-01** — COVERED. Automated: Docker image build/run/health (05-01), lifecycle scripts + compose (05-02), clean dependency build (05-03), E2E harness proving real pass/fail signal (05-04), full 6-spec/10-test E2E matrix (05-05). Manual-only: visual UI rendering (05-01 D4), PowerShell parser validation (05-02 D2, no `pwsh` on this host).
- **OPS-02** — COVERED. Automated beyond the original VALIDATION.md's manual-only expectation: 05-02 ran the real restart-persistence round trip (trade + watchlist edit + chat message survive `stop_mac.sh` → `start_mac.sh`) against a live Docker daemon, not just a scripted assertion plan.

---

## Wave 0 Requirements

- [ ] `.dockerignore` — build-breaker if absent (RESEARCH.md Common Pitfalls #1)
- [ ] `Dockerfile` — does not exist yet
- [ ] `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_windows.ps1` — do not exist yet (no `scripts/` directory at all)
- [ ] `.env.example` — does not exist yet
- [ ] `docker-compose.yml` (optional convenience wrapper) — does not exist yet
- [ ] `test/package.json`, `test/playwright.config.ts` — do not exist yet
- [ ] `test/docker-compose.test.yml` — does not exist yet
- [ ] `test/e2e/*.spec.ts` (fresh-start, watchlist, trading, portfolio-viz, chat, sse-reconnect) — none exist yet
- [ ] Lazy-import fix for `massive` in `backend/app/market/massive_client.py` / `factory.py`, and `rich` moved to a `[project.optional-dependencies]` extra in `backend/pyproject.toml` (followed by `uv lock`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator visually reaches the working workstation (streaming watchlist, chart, chat panel) in a real browser | OPS-01 | curl/API checks prove the HTTP surface but not browser rendering, EventSource/SSE consumption, or visual layout | Open `http://localhost:8000` after `./scripts/start_mac.sh`; confirm the terminal UI renders and prices stream |
| `scripts/start_windows.ps1` / `stop_windows.ps1` actually parse and execute on Windows | OPS-01 | No `pwsh` on the macOS execution host — only structural/literal review (grep for the five run-contract literals, destructive-pattern check) was possible | Run `./scripts/start_windows.ps1` then `./scripts/stop_windows.ps1` on a Windows host or a `pwsh`-enabled CI leg; confirm the same idempotency/never-destroy-data guarantees as the bash scripts |

Superseded from the original (pre-planning) VALIDATION.md: restart-persistence (OPS-02) was expected to be manual-only but 05-02's executor automated it against a real Docker daemon — see Per-Task Verification Map above.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none missing — see Per-Task Verification Map)
- [x] No watch-mode flags
- [x] Feedback latency < 180s (E2E suite runs in ~9.4s per 05-05-SUMMARY.md, well under the ~180s estimate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-24 — both phase requirements (OPS-01, OPS-02) are COVERED by automated verification; the two remaining items are genuinely environment-bound manual checks (visual UI, Windows `pwsh`), not test-writing gaps.

## Validation Audit 2026-09-24
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 2 (manual-only, environment-bound — see Manual-Only Verifications) |

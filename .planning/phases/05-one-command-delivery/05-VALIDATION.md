---
phase: "05"
slug: "one-command-delivery"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-22"
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | OPS-01 | T-05-01 | Non-root container, no secrets in image layers | E2E (container-level) | `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit` | ❌ W0 | ⬜ pending |
| {N}-01-02 | 01 | 1 | OPS-02 | T-05-01 | N/A | manual / scripted restart | `./scripts/start_mac.sh && <trade> && ./scripts/stop_mac.sh && ./scripts/start_mac.sh && <assert trade still present>` | ❌ W0 | ⬜ pending |

*Filled with concrete Task IDs once `gsd-planner` produces PLAN.md — this VALIDATION.md is seeded pre-planning from 05-RESEARCH.md's Validation Architecture section.*

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
| Trades/watchlist/chat history persist across a real container restart | OPS-02 | The E2E suite's containers are ephemeral (built fresh per run); restart-persistence requires stopping and restarting the same named volume outside the disposable test container | `./scripts/start_mac.sh` → make a trade / watchlist edit via UI or API → `./scripts/stop_mac.sh` → `./scripts/start_mac.sh` → confirm the trade/watchlist/chat history is still present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

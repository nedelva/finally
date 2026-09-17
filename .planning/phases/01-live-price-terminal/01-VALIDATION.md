---
phase: "1"
slug: "live-price-terminal"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-17"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

**Backend**

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3+ with pytest-asyncio (`asyncio_mode = "auto"`) |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd backend && uv run --extra dev pytest tests/market/test_stream.py tests/test_main.py -v` |
| **Full suite command** | `cd backend && uv run --extra dev pytest --cov=app -v` |
| **Estimated runtime** | ~15 seconds |

**Frontend**

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 + @testing-library/react 16.3.3 + jsdom 30.1.0 (installed; no config file exists yet) |
| **Config file** | none — Wave 0 installs `frontend/vitest.config.ts` + `frontend/vitest.setup.ts` |
| **Quick run command** | `cd frontend && npm run test -- --run <file>` |
| **Full suite command** | `cd frontend && npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted quick-run command for the file(s) touched (backend or frontend, as applicable)
- **After every plan wave:** Run the full suite for whichever side (backend/frontend) the wave touched
- **Before `/gsd-verify-work`:** Both full suites must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-TBD | TBD | 0 | MKT-01 | — | N/A | integration (backend) | `uv run --extra dev pytest tests/market/test_stream.py -v` | ❌ W0 | ⬜ pending |
| 01-01-TBD | TBD | 0 | MKT-01 | — | N/A | component (frontend) | `npm run test -- --run Watchlist` | ❌ W0 | ⬜ pending |
| 01-01-TBD | TBD | 0 | MKT-02 | — | N/A | unit (frontend hook — `frontend/lib/usePriceFlash.ts` already exists, no test yet) | `npm run test -- --run usePriceFlash` | ❌ W0 | ⬜ pending |
| 01-01-TBD | TBD | 0 | MKT-03 | — | N/A | component (frontend) | `npm run test -- --run Sparkline` | ❌ W0 | ⬜ pending |
| 01-01-TBD | TBD | 0 | MKT-04 | — | N/A | component (frontend) | `npm run test -- --run MainChart` | ❌ W0 | ⬜ pending |
| 01-01-TBD | TBD | 0 | MKT-05 | — | N/A | component (frontend); true disconnect/reconnect is manual/E2E-deferred to Phase 5 Playwright | `npm run test -- --run ConnectionDot` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs are TBD — the planner fills these in against actual plan/task numbers; this table's requirement-to-command mapping is authoritative regardless of final task IDs.*

---

## Wave 0 Requirements

- [ ] `backend/tests/market/test_stream.py` — SSE integration tests: event delivery, version-change detection, client disconnect (covers MKT-01 and the CONCERNS.md router-singleton / version-counter fixes)
- [ ] `backend/tests/test_main.py` — covers `/api/health` and static-file serving
- [ ] `frontend/vitest.config.ts` + `frontend/vitest.setup.ts` — no test config exists despite vitest/jsdom/testing-library all being installed
- [ ] `frontend/__tests__/usePriceFlash.test.ts` — the hook already exists in `frontend/lib/usePriceFlash.ts` with zero test coverage today
- [ ] Framework install: none needed — vitest/testing-library are already in `node_modules`; only config files are missing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| True SSE disconnect/reconnect cycle (network drop → yellow/red dot → auto green on recovery) | MKT-05 | Requires simulating a real network interruption against a running server; PLAN.md §12 explicitly assigns this to Phase 5's Playwright E2E suite, not a Phase 1 unit/component test | Run the dev server, use browser devtools to throttle/offline the network tab, observe the connection dot change color and self-recover within EventSource's default retry window |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

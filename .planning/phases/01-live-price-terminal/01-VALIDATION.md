---
phase: "1"
slug: "live-price-terminal"
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 01-03-T1 | 01-03 | 3 | MKT-01 | T-01-06 | SSE router isolation, empty-cache version gating, keepalive | integration (backend) | `uv run --extra dev pytest tests/market/test_stream.py -v` | ✅ | ✅ green (7 passed) |
| 01-04-T1 | 01-04 | 3 | MKT-01, MKT-02 | T-01-04 | Simulated-feed disclosure retained | component (frontend) | `npm run test -- --run Watchlist` | ✅ | ✅ green (9 passed) |
| 01-01-T3 | 01-01 | 1 | MKT-02 | — | N/A | unit (frontend hook) | `npm run test -- --run usePriceFlash` | ✅ | ✅ green (7 passed) |
| 01-04-T2 | 01-04 | 3 | MKT-03 | — | N/A | component (frontend) | `npm run test -- --run Sparkline` | ✅ | ✅ green (6 passed) |
| 01-05-T2 | 01-05 | 4 | MKT-04 | T-01-13 | No placeholder portfolio figures in header | component (frontend) | `npm run test -- --run MainChart` | ✅ | ✅ green (8 passed) |
| 01-05-T1 | 01-05 | 4 | MKT-05 | T-01-11, T-01-12 | Status derived only from EventSource open/error events; state exposed via `data-status`/`aria-label` | component (frontend); true disconnect/reconnect is manual/E2E-deferred to Phase 5 Playwright | `npm run test -- --run ConnectionDot` | ✅ | ✅ green (12 passed) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs reflect the actual executed plan/task numbers. All commands re-run and confirmed green during phase-close validation (2026-09-18). Full suites: backend 90 passed, frontend 54 passed.*

---

## Wave 0 Requirements

- [x] `backend/tests/market/test_stream.py` — SSE integration tests: event delivery, router isolation, empty-cache version gating, keepalive, client disconnect (7 tests, built in plan 01-03)
- [x] `backend/tests/test_main.py` — covers `/api/health`, static-file serving present/absent, and a real lifespan-driven SSE frame (built in plan 01-02)
- [x] `frontend/vitest.config.ts` + `frontend/vitest.setup.ts` — built in plan 01-01
- [x] `frontend/__tests__/usePriceFlash.test.ts` — built in plan 01-01 (7 tests)
- [x] Framework install: none needed — vitest/testing-library were already in `node_modules`; config files added by plan 01-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| True SSE disconnect/reconnect cycle (network drop → yellow/red dot → auto green on recovery) | MKT-05 | Requires simulating a real network interruption against a running server; PLAN.md §12 explicitly assigns this to Phase 5's Playwright E2E suite, not a Phase 1 unit/component test | Run the dev server, use browser devtools to throttle/offline the network tab, observe the connection dot change color and self-recover within EventSource's default retry window |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run` and `pytest -q` both one-shot)
- [x] Feedback latency < 15s (backend suite ~2.7s, frontend suite ~1.5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated — all 5 phase requirements (MKT-01 through MKT-05) have passing automated coverage; the sole manual-only item (true SSE disconnect/reconnect) is correctly deferred to Phase 5 Playwright and is also captured as a `<human-check>` item for end-of-phase UAT.

## Validation Audit 2026-09-18
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

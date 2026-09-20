---
phase: "3"
slug: "trading-portfolio"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-20"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0+ (backend, `pytest-asyncio` auto mode, `httpx`) / Vitest 5.0.1 + `@testing-library/react` 16.3.3 (frontend, jsdom) |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]` / `frontend/vitest.config.ts` (both existing) |
| **Quick run command** | `cd backend && uv run --extra dev pytest -q -k portfolio` / `cd frontend && npm test -- TradeBar` (swap component name per file touched) |
| **Full suite command** | `cd backend && uv run --extra dev pytest -q` and `cd frontend && npm test` (matches `.planning/config.json`'s `test_command`) |
| **Estimated runtime** | ~30 seconds (backend suite) + ~20 seconds (frontend suite) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command scoped to the file(s) touched
- **After every plan wave:** Run the full suite (`pytest -q` + `npm test`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PORT-01 | V5 negative/zero quantity | N/A (read path) | integration | `pytest tests/api/test_portfolio.py -k test_get_portfolio_fresh_db -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PORT-02 | Negative/zero qty; off-watchlist ticker | Server-side `quantity > 0` + watchlist-membership check before any write | integration | `pytest tests/api/test_portfolio.py -k TestBuyTrade -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PORT-03 | Over-sell / over-buy tampering | Refuse with no state change; single-transaction execution | integration | `pytest tests/api/test_portfolio.py -k TestSellTrade -x` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | PORT-06 | Race on periodic + post-trade snapshot writes | Single-transaction write, monotonic `recorded_at` | integration | `pytest tests/db/test_repository.py -k TestRecordSnapshot -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PORT-04 | N/A (display path) | N/A | unit | `npm test -- PositionsTable` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | PORT-05 | N/A (display path) | N/A | unit | `npm test -- Heatmap` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | PORT-06 | N/A (display path) | N/A | unit | `npm test -- PnLChart` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 2 | PORT-01, PORT-02, PORT-03 | N/A (display path) | N/A | unit | `npm test -- TradeBar` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Exact task IDs/waves are finalized by the planner — this map is the requirement→test binding, not a plan-frontmatter mirror.*

---

## Wave 0 Requirements

- [ ] `backend/tests/api/test_portfolio.py` — covers PORT-01, PORT-02, PORT-03, PORT-06 (route-level); follow `backend/tests/api/test_watchlist.py`'s `client`/`fake_market_source` fixture pattern (`backend/tests/api/conftest.py` already exists — `client.app.state.price_cache.update(...)` is the established way to seed a fill price in tests)
- [ ] `backend/tests/db/test_repository.py` extensions — covers `execute_trade`, `get_positions`, `record_snapshot`, `get_snapshots` at the repository level, following `TestAddWatchlistTicker`'s shape (`initialized_db` fixture, direct function calls, no HTTP layer)
- [ ] `frontend/__tests__/TradeBar.test.tsx`, `PositionsTable.test.tsx`, `Heatmap.test.tsx`, `PnLChart.test.tsx` — new files, following `Watchlist.test.tsx`'s render + `@testing-library/user-event` conventions
- [ ] `frontend/__tests__/positionMath.test.ts` — `deriveLivePosition` exists in source with no dedicated test file; add coverage for the D-03 fallback branch (`livePrice === undefined`), now load-bearing for PORT-04/05 correctness

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

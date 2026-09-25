---
phase: "3"
slug: "trading-portfolio"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-20"
validated: "2026-09-20"
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
| 03-01-01 | 01 | 1 | PORT-01 | V5 negative/zero quantity | N/A (read path) | integration | `pytest tests/api/test_portfolio.py -k test_fresh_database_reports_seed_cash_and_no_positions -x` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | PORT-02 | Negative/zero qty; off-watchlist ticker | Server-side `quantity > 0` + watchlist-membership check before any write | integration | `pytest tests/api/test_portfolio.py -k TestBuyTrade -x` | ✅ | ✅ green |
| 03-01-03 | 01 | 1 | PORT-03 | Over-sell / over-buy tampering | Refuse with no state change; single-transaction execution | integration | `pytest tests/api/test_portfolio.py -k TestSellTrade -x` | ✅ | ✅ green |
| 03-01-04 | 01 | 1 | PORT-06 | Race on periodic + post-trade snapshot writes | Single-transaction write, monotonic `recorded_at` | integration | `pytest tests/db/test_repository.py -k TestRecordSnapshot -x` | ✅ | ✅ green |
| 03-02-01 | 03 | 3 | PORT-04 | N/A (display path) | N/A | unit | `npm test -- PositionsTable` | ✅ | ✅ green |
| 03-02-02 | 03 | 3 | PORT-05 | N/A (display path) | N/A | unit | `npm test -- Heatmap` | ✅ | ✅ green |
| 03-02-03 | 04 | 4 | PORT-06 | N/A (display path) | N/A | unit | `npm test -- PnLChart` | ✅ | ✅ green |
| 03-02-04 | 01 | 1 | PORT-01, PORT-02, PORT-03 | N/A (display path) | N/A | unit | `npm test -- TradeBar` | ✅ | ✅ green |
| 03-03-01 | 02 | 2 | PORT-01 | N/A (display path) | N/A | unit | `npm test -- Header` | ✅ | ✅ green |
| 03-03-02 | 02 | 2 | PORT-01 | N/A (display path) | N/A | unit | `npm test -- positionMath` | ✅ | ✅ green |
| 03-03-03 | review-fix | — | PORT-02, PORT-03 | Concurrent trade race (WR-01) | `BEGIN IMMEDIATE` write-lock closes the read-then-write TOCTOU window | integration | `pytest tests/db/test_repository.py -k test_concurrent_buys_do_not_lose_an_update -x` | ✅ | ✅ green |
| 03-03-04 | review-fix | — | PORT-02, PORT-03 | NaN/Infinity trade quantity crashes with unhandled 500 (CR-01) | `math.isfinite()` guard rejects with clean 400 | integration | `pytest tests/db/test_repository.py -k test_non_finite_quantity_raises_before_any_write -x` and `pytest tests/api/test_portfolio.py -k test_buy_non_finite_quantity_returns_400_not_an_unhandled_500 -x` | ✅ | ✅ green |

*Corrected against actual implementation during `/gsd-verify-work 03`'s Nyquist audit — one command name (`test_get_portfolio_fresh_db` → `test_fresh_database_reports_seed_cash_and_no_positions`) and several task→plan/wave mappings differed from the draft's pre-execution guess. All 12 mapped commands independently re-run and confirmed green (184 backend / 137 frontend tests total, full suite). The two rows added since the draft (concurrency + NaN guard regression tests) came out of the phase's code-review fix cycle (03-REVIEW.md CR-01/WR-01), not the original plan — added here for completeness, not because Wave 0 required them.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Exact task IDs/waves are finalized by the planner — this map is the requirement→test binding, not a plan-frontmatter mirror.*

---

## Wave 0 Requirements

- [x] `backend/tests/api/test_portfolio.py` — covers PORT-01, PORT-02, PORT-03, PORT-06 (route-level)
- [x] `backend/tests/db/test_repository.py` extensions — covers `execute_trade`, `get_positions`, `record_snapshot`, `get_snapshots` at the repository level
- [x] `frontend/__tests__/TradeBar.test.tsx`, `PositionsTable.test.tsx`, `Heatmap.test.tsx`, `PnLChart.test.tsx` — all four exist and pass
- [x] `frontend/__tests__/positionMath.test.ts` — `deriveLivePosition`'s D-03 fallback branch covered (9 tests)

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Audit 2026-09-20

| Metric | Count |
|--------|-------|
| Gaps found | 1 (stale command name, not a coverage gap) |
| Resolved | 1 (corrected to `test_fresh_database_reports_seed_cash_and_no_positions`) |
| Escalated | 0 |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run`, one-shot `pytest`)
- [x] Feedback latency < 60s (full suite: ~4s backend + ~2s frontend, well under budget)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-20

---
phase: "2"
slug: "persistent-watchlist"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-18"
validated: "2026-09-19"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from `02-RESEARCH.md`'s `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 8.3.0 + pytest-asyncio 0.24.0 |
| **Config file (backend)** | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command (backend)** | `cd backend && uv run --extra dev pytest tests/db tests/api -v` |
| **Full suite command (backend)** | `cd backend && uv run --extra dev pytest -v` |
| **Framework (frontend)** | Vitest (`frontend/vitest.config.ts`, existing from Phase 1) |
| **Quick run command (frontend)** | `cd frontend && npm test -- Watchlist` |
| **Full suite command (frontend)** | `cd frontend && npm test` |
| **Estimated runtime** | ~30-60 seconds combined |

---

## Sampling Rate

- **After every task commit:** Run the targeted `pytest -k <area>` or `npm test -- <Component>` command for that task's area
- **After every plan wave:** Run both full suites — `cd backend && uv run --extra dev pytest -v` and `cd frontend && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (both backend and frontend)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|--------------------|-------------|--------|
| WTCH-01 | `POST /api/watchlist` adds a valid new ticker, persists it, notifies the market source | unit/integration | `uv run --extra dev pytest tests/api/test_watchlist.py -k add -x` | ✅ | ✅ green |
| WTCH-01 | Malformed/empty ticker rejected with 400, no DB write, no market-source notify | unit | `uv run --extra dev pytest tests/api/test_watchlist.py -k malformed -x` | ✅ | ✅ green |
| WTCH-01 | Duplicate ticker rejected with 409 | unit | `uv run --extra dev pytest tests/api/test_watchlist.py -k duplicate -x` | ✅ | ✅ green |
| WTCH-02 | `DELETE /api/watchlist/{ticker}` removes a ticker, notifies the market source, 404 if absent | unit/integration | `uv run --extra dev pytest tests/api/test_watchlist.py -k remove -x` | ✅ | ✅ green |
| WTCH-01/02 | `init_db()` creates all 6 tables, seeds default user + 10 tickers, is idempotent | unit | `uv run --extra dev pytest tests/db/test_init.py -x` | ✅ | ✅ green |
| WTCH-01/02 | Ticker normalization is consistent between `SimulatorDataSource` and `MassiveDataSource` | unit | `uv run --extra dev pytest tests/market/test_simulator_source.py tests/market/test_massive.py -k normal -x` | ✅ | ✅ green |
| WTCH-01/02 | Frontend `Watchlist.tsx` renders rows from `useWatchlist()`, not the SSE-derived ticker set; add/remove call the API and refetch | component | `npm test -- Watchlist` | ✅ | ✅ green |
| WTCH-01/02 (G-02-4) | Remove button has a 24x24px accessible hit-area with permanent visible resting-state affordance and a keyboard focus ring | component | `npm test -- Watchlist` | ✅ | ✅ green |
| WTCH-01/02 (G-02-5) | Watchlist panel scrolls internally past its bounded height (`lg:max-h-[440px]`) with the add-ticker form always visible; main chart height is independent of watchlist row count at `lg:` | component | `npm test -- Watchlist` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Audit note (2026-09-19):** This map was seeded in draft form during plan-phase (before Wave 0 existed) and was never updated as Waves 1-5 executed. Re-audited against the actual codebase and current CI-equivalent run: all backend tests (`backend/tests/api/test_watchlist.py`, `backend/tests/db/test_init.py`, `backend/tests/market/test_simulator_source.py`, `backend/tests/market/test_massive.py` — 139 passed) and frontend tests (`frontend/__tests__/Watchlist.test.tsx` — 44 passed within a 89-test full suite) cover every row above by name-matched test function. No MISSING or PARTIAL requirements found; the "Wave 0" gaps this document originally flagged were all closed by the time 02-01 through 02-05 executed. The two G-02-4/G-02-5 rows were added to capture plan 02-05's gap-closure coverage, which the original map predates.

---

## Wave 0 Requirements

- [x] `backend/tests/db/__init__.py`, `conftest.py`, `test_init.py`, `test_repository.py` — new test package (no analog in this branch)
- [x] `backend/tests/api/__init__.py`, `conftest.py` (with a `FakeMarketDataSource` test double and the `create_app(market_source=...)` injection point), `test_watchlist.py` — new test package
- [x] `frontend/__tests__/Watchlist.test.tsx`'s existing `describe("Watchlist", ...)` block — rewritten to mock `useWatchlist()`/`lib/api` rather than asserting on SSE-derived ticker count, and further extended by 02-05 with hit-area/scroll/height-decoupling coverage

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the Per-Task Verification Map above.*

---

## Security Domain (from RESEARCH.md)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V5 Input Validation | Yes | Ticker format regex (`[A-Z0-9]{1,5}`) applied server-side before any DB write |
| V12 (Files/Data) — parameterized queries | Yes | Every SQL statement in `app/db/repository.py` MUST use `?` placeholders, never string interpolation |

Known threat patterns: SQL injection via ticker string (mitigated by parameterized queries), unbounded ticker string (mitigated by format validation gate), path traversal via ticker in `DELETE /api/watchlist/{ticker}` (not applicable — ticker is never used as a filesystem path, but normalize + bound-check as defense in depth).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`npm test` = `vitest run`, one-shot)
- [x] Feedback latency < 60s (combined suite runs in ~5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-19 (post-hoc audit via `/gsd-validate-phase`, triggered by phase-02 gap-closure completion)

## Validation Audit 2026-09-19
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 (all pre-existing) |
| Escalated | 0 |

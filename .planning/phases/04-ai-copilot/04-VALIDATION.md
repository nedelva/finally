---
phase: "4"
slug: "ai-copilot"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-20"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3.0 + pytest-asyncio 0.24.0 (backend); Vitest (frontend, per existing `frontend/vitest.config.ts` and `__tests__/*.test.tsx`) |
| **Config file** | `backend/pyproject.toml` (`[tool.pytest.ini_options]`); `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && uv run pytest tests/llm tests/api/test_chat.py -q` |
| **Full suite command** | `(cd backend && uv run pytest -q) && (cd frontend && npm test)` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/llm tests/api/test_chat.py -q` (backend); `npm test -- ChatPanel` (frontend, once it exists)
- **After every plan wave:** Run `(cd backend && uv run pytest -q) && (cd frontend && npm test)`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Task IDs are assigned when the planner creates PLAN.md; this seeds the requirement→test mapping the planner should lift into each task's `<verify>` block.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| CHAT-01 | Send message, get conversational reply | integration | `pytest backend/tests/api/test_chat.py::test_chat_returns_message_and_empty_action_lists_by_default -x` | ❌ W0 | ⬜ pending |
| CHAT-02 | Reply grounded in real cash/positions/watchlist/history | unit | `pytest backend/tests/llm/test_prompts.py -x` | ❌ W0 | ⬜ pending |
| CHAT-03 | AI trade executes, shown inline | integration | `pytest backend/tests/api/test_chat.py::test_chat_happy_path_trade_executes_and_shows_up_in_portfolio -x` | ❌ W0 | ⬜ pending |
| CHAT-04 | AI watchlist add/remove executes, shown inline | integration | `pytest backend/tests/api/test_chat.py::test_chat_watchlist_action_executes -x` | ❌ W0 | ⬜ pending |
| CHAT-05 | Failed action reported conversationally, no mutation | integration | `pytest backend/tests/api/test_chat.py::test_chat_trade_failure_is_reported_as_failed_not_500 -x` | ❌ W0 | ⬜ pending |
| CHAT-06 | Reload restores conversation history | integration + component | `pytest backend/tests/api/test_chat.py::test_chat_history_endpoint_returns_persisted_messages -x`; `npm test -- ChatPanel` | ❌ W0 (endpoint + frontend hydration both new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/llm/__init__.py` — directory exists but has no `__init__.py`, unlike `backend/tests/api/` and `backend/tests/db/` — create it for consistent pytest package discovery.
- [ ] `backend/tests/llm/conftest.py` — fixtures for `LLM_MOCK` env toggling and a fake/frozen portfolio context dict.
- [ ] `backend/tests/api/test_chat.py` — new file; prior-art at commit `c4c9d86` (non-ancestor branch) is a strong scenario reference but must be rewritten against this codebase's actual fixtures (`client`, `fake_market_source`, `price_cache` — see `backend/tests/api/conftest.py`) and actual function signatures.
- [ ] Framework install: none — pytest/pytest-asyncio/Vitest are all already configured and working in this project.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

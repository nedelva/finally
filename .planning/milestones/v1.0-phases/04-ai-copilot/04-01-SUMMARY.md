---
phase: 04-ai-copilot
plan: 01
subsystem: ai-copilot-chat
tags: [litellm, openrouter, cerebras, fastapi, sse-safe-blocking, nextjs, react, vitest, sqlite]
requires:
  - phase: 03-portfolio-and-visualization
    provides: build_portfolio(price_cache) and build_watchlist(price_cache) — the
      single sources of truth for cash/positions/P&L and watchlist prices, reused
      unchanged as the LLM's prompt context so the assistant can never quote a
      number the rest of the terminal disagrees with
provides:
  - "POST /api/chat — grounded conversational reply carrying real cash, positions and watchlist prices (CHAT-01, CHAT-02)"
  - "backend/app/llm package — schema.py, prompts.py, mock.py, client.py, __init__.py barrel"
  - "chat_messages persistence via insert_chat_message / get_recent_chat_messages"
  - "A docked, collapsible AI Copilot panel (ChatPanel) wired into the terminal's right column"
affects: [04-02-action-execution, 04-03-history-rehydration]
actuals:
  tokens: 109820
  tasks: 4
  commits: 4
  plan_head_before: d765f6e2a279d921ef5ca3d606d839f820b0d81c
tech-stack:
  added: [litellm, pydantic (promoted to direct dependency), python-dotenv]
  patterns:
    - "Router-factory-with-injected-price_cache (create_chat_router), never a module-level router singleton"
    - "asyncio.to_thread() around every blocking call in the chat route, including the LiteLLM call — the chat route shares one event loop with every connected /api/stream/prices SSE client"
    - "One try block spanning both completion() and ChatResponse.model_validate_json, degrading to a fallback ChatResponse on any failure — never a 500"
    - "LLM_MOCK env-var branch checked before constructing any request, mirroring app/market/factory.py's env-var-branching convention"
    - "ChatPanel's seed greeting is a derived empty-state branch (messages.length === 0), never pushed into state or persisted"
key-files:
  created:
    - backend/app/llm/schema.py
    - backend/app/llm/prompts.py
    - backend/app/llm/mock.py
    - backend/app/llm/client.py
    - backend/app/llm/__init__.py
    - backend/app/api/chat.py
    - backend/tests/api/test_chat.py
    - backend/tests/llm/__init__.py
    - backend/tests/llm/conftest.py
    - backend/tests/llm/test_prompts.py
    - backend/tests/llm/test_client.py
    - frontend/components/chat/ChatPanel.tsx
    - frontend/__tests__/ChatPanel.test.tsx
    - .planning/phases/04-ai-copilot/04-USER-SETUP.md
  modified:
    - backend/app/db/repository.py
    - backend/app/db/__init__.py
    - backend/app/api/__init__.py
    - backend/app/main.py
    - backend/tests/conftest.py
    - backend/pyproject.toml
    - backend/uv.lock
    - frontend/app/page.tsx
key-decisions:
  - "litellm and pydantic (SUS-flagged by the Package Legitimacy Audit) approved after human review of their PyPI/GitHub provenance — Task 1's blocking checkpoint"
  - "get_chat_response wraps both the completion() call and the model_validate_json parse in one try/except, returning a fallback ChatResponse rather than ever raising out of the route"
  - "Collapse state is local-only, not persisted to localStorage or the backend — every fresh page load starts expanded, per 04-UI-SPEC.md"
  - "A send failure preserves the typed message in ChatPanel's input (deliberate divergence from TradeBar, which clears on success) so the user can retry without retyping"
  - "This plan's POST /api/chat always returns empty trades/watchlist_changes arrays — action dispatch and inline confirmation pills are explicitly deferred to 04-02"
patterns-established:
  - "Message-list max-height + overflow-y-auto scroll container, reusing Watchlist.tsx's watchlist-scroll-container idiom for ChatPanel's chat-messages"
  - "whitespace-pre-wrap break-words on message bubble text — plain-text rendering, no markdown"
requirements-completed: [CHAT-01, CHAT-02]
coverage:
  - id: D1
    description: "POST /api/chat accepts {message} and returns {message, trades, watchlist_changes} grounded in the real portfolio (CHAT-01, CHAT-02)"
    requirement: "CHAT-01, CHAT-02"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_chat.py"
        status: pass
      - kind: unit
        ref: "backend/tests/llm/test_prompts.py"
        status: pass
    human_judgment: false
  - id: D2
    description: "get_chat_response never raises — degrades to a readable fallback ChatResponse on completion() failure or malformed JSON"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "backend/tests/llm/test_client.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both turns of every exchange persist to chat_messages; empty/whitespace/over-length input rejected with 400 and no state change"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_chat.py"
        status: pass
    human_judgment: false
  - id: D4
    description: "Docked, collapsible ChatPanel: seed greeting, disabled-empty Send, Thinking bubble in flight, send-failure preserves input, collapse/expand toggle"
    requirement: "CHAT-01, CHAT-02"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ChatPanel.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live chat UX with a real OPENROUTER_API_KEY: reply quotes the same cash figure the header shows, in the terse numbers-first D-04 voice"
    verification: []
    human_judgment: true
    rationale: "Requires a live OpenRouter/Cerebras API key and cannot be exercised under LLM_MOCK=true; deferred to end-of-phase human verification per workflow.human_verify_mode"
duration: 14min (git-timestamp span across dispatches; see Issues Encountered for real-elapsed-time context)
completed: 2026-09-21
status: complete
---

# Phase 4 Plan 1: AI Copilot Tracer Slice Summary

**End-to-end `POST /api/chat` grounded in the real portfolio via LiteLLM/OpenRouter/Cerebras (mock-backed in tests), persisted to `chat_messages`, and surfaced through a docked, collapsible AI Copilot panel in the terminal's new right column.**

## Performance
- **Duration:** ~14min of git-timestamped work across three dispatches (approval checkpoint, backend build, frontend build); see Issues Encountered for the real-elapsed-time picture
- **Started:** 2026-09-21T16:35:57+02:00 (Task 2 commit)
- **Completed:** 2026-09-21T16:49:24+02:00 (Task 4 commit)
- **Tasks:** 4 (Task 1 approval-only, Tasks 2-4 code)
- **Files modified:** 22 (14 created, 8 modified)

## Accomplishments
- `backend/app/llm` package built: `schema.py` (TradeAction/WatchlistAction/ChatResponse), `prompts.py` (SYSTEM_PROMPT, HISTORY_LIMIT=10, render_portfolio_context, build_messages), `mock.py` (deterministic LLM_MOCK routing), `client.py` (the sole `litellm.completion()` call site, wrapped in one never-raising try/except)
- `backend/app/api/chat.py`: `create_chat_router(price_cache)` factory (no module-level router singleton), input-length validation (`MAX_MESSAGE_CHARS = 4000`, measured in Unicode code points), full `asyncio.to_thread` wrapping so the chat route never blocks the shared `/api/stream/prices` SSE event loop
- `chat_messages` persistence: `insert_chat_message` / `get_recent_chat_messages` added to `backend/app/db/repository.py`, mirroring the existing repository conventions exactly
- `load_dotenv(_REPO_ROOT / ".env")` wired into `backend/app/main.py` so `OPENROUTER_API_KEY`/`LLM_MOCK` resolve under plain `uv run`
- Unit coverage proving CHAT-02 grounding (`render_portfolio_context` carries the real cash/position/watchlist figures) and the client's never-raises contract (`get_chat_response` degrades on both a raising `completion()` and unparseable JSON)
- `frontend/components/chat/ChatPanel.tsx`: docked/collapsible sidebar wired to the real `postChatMessage`, with seed greeting, Thinking bubble, disabled-empty-input Send, and send-failure input preservation
- `frontend/app/page.tsx` restructured into a two-column row (`flex-1 min-w-0` left column with the unchanged Phase 1-3 panel stack; sticky `w-96` right column holding `<ChatPanel />`), with the `selectedTicker` guard effect left byte-identical

## Task Commits
1. **Task 1: Package legitimacy gate — litellm, pydantic, python-dotenv** — approved, no code changes
2. **Task 2: POST /api/chat grounded in the real portfolio via mock LLM** - `3d61b98`
3. **Task 3: Prove the grounding and the degradation path at unit level** - `08bd86e`
4. **Task 4: The AI Copilot panel — docked, collapsible, and talking to the real route** - `a043fe9`
5. **docs: 04-USER-SETUP.md** - `65314aa`

## Files Created/Modified
- `backend/app/llm/schema.py` - TradeAction, WatchlistAction, ChatResponse (the LLM's raw proposal type)
- `backend/app/llm/prompts.py` - SYSTEM_PROMPT, HISTORY_LIMIT, render_portfolio_context, build_messages
- `backend/app/llm/mock.py` - get_mock_response, deterministic LLM_MOCK routing
- `backend/app/llm/client.py` - get_chat_response, the sole completion() call site, never-raising degradation
- `backend/app/llm/__init__.py` - public barrel re-exporting get_chat_response/ChatResponse/TradeAction/WatchlistAction
- `backend/app/api/chat.py` - create_chat_router, ChatRequest, MAX_MESSAGE_CHARS
- `backend/app/db/repository.py` - insert_chat_message, get_recent_chat_messages
- `backend/app/db/__init__.py` - re-exports the two new repository functions
- `backend/app/api/__init__.py` - re-exports create_chat_router
- `backend/app/main.py` - load_dotenv, mounts create_chat_router before the static mount
- `backend/tests/conftest.py` - autouse force_llm_mock fixture
- `backend/pyproject.toml` / `backend/uv.lock` - litellm, pydantic, python-dotenv as direct dependencies
- `backend/tests/api/test_chat.py` - route-level coverage (happy path, grounding, persistence, input bounds, code-point boundary)
- `backend/tests/llm/__init__.py`, `conftest.py`, `test_prompts.py`, `test_client.py` - unit coverage for prompt grounding and client degradation
- `frontend/components/chat/ChatPanel.tsx` - the docked AI Copilot panel
- `frontend/app/page.tsx` - two-column row restructure; `<ChatPanel />` in the new sticky right column
- `frontend/__tests__/ChatPanel.test.tsx` - seed greeting, disabled-empty-send, empty-submit no-op, in-flight Thinking state, send-failure input preservation, collapse/expand toggle
- `.planning/phases/04-ai-copilot/04-USER-SETUP.md` - OPENROUTER_API_KEY / LLM_MOCK setup instructions

## Decisions Made
- `litellm` and `pydantic` — both SUS-flagged by the Package Legitimacy Audit (`too-new`, `unknown-downloads` heuristics) — were approved by the developer after reviewing their PyPI/GitHub provenance at Task 1's blocking checkpoint; `pydantic` was already a transitive dependency of `fastapi`, promoted to direct
- `get_chat_response`'s `try` block spans both the `completion()` call and the `ChatResponse.model_validate_json` parse, so a missing API key, timeout, transport error, or malformed model payload all degrade to the same fallback `ChatResponse` rather than propagating as a 500
- Chat panel collapse state is local-only and unpersisted — every fresh page load starts expanded, per 04-UI-SPEC.md's explicit scope-minimization call
- A chat send failure preserves the typed message in the input (the one deliberate divergence from `TradeBar.tsx`, which clears its inputs on success) so the user can retry without retyping
- Action dispatch (trades/watchlist changes) and inline confirmation pills are explicitly out of scope for this plan — `POST /api/chat` always returns empty `trades`/`watchlist_changes` arrays here; 04-02 fills the dispatch loop

## Deviations from Plan
None — all four tasks executed exactly as PLAN.md specified. One test-writing self-correction during Task 4: an initial `ChatPanel.test.tsx` assertion incorrectly expected the Send button to remain enabled immediately after a successful response resolved; corrected once the test run showed the button is (correctly) disabled again because the input was cleared to empty on success, not because a request is still in flight. No production code changed as a result.

## Issues Encountered
Execution spanned three dispatches: the package-legitimacy checkpoint (Task 1) required explicit developer approval; Task 4 was initially blocked by a gitignored frontend/node_modules missing in a fresh worktree checkout (resolved via npm install); and a worktree-targeting mismatch during the second continuation attempt was caught cleanly by the branch-check guard with zero data loss, resolved by the orchestrator merging the verified worktree branch to main before this final dispatch. None of these affected the shipped code.

## User Setup Required
See `04-USER-SETUP.md` (OPENROUTER_API_KEY / LLM_MOCK). All automated checks in this phase run under `LLM_MOCK=true` and need no key; the live conversational path (D5 above) requires one.

## Next Phase Readiness
- `POST /api/chat`'s response shape, `chat_messages` persistence, and `ChatPanel`'s message-rendering scaffold are all in place for 04-02 to add the action-dispatch loop (trades + watchlist changes) and inline confirmation pills — `ChatMessage.actions` is already threaded through on the frontend side, unused until 04-02 renders it
- `ChatPanel`'s seed-greeting branch (`messages.length === 0`) is a pure addition point for 04-03's history rehydration — no initial-state logic needs to be rewritten
- `GET /api/chat/history` and `get_chat_history()` (listed in this phase's Artifacts section) are not yet built — reserved for 04-03

---
*Phase: 04-ai-copilot*
*Completed: 2026-09-21*

## Self-Check: PASSED

All 11 created files verified present on disk (ChatPanel.tsx, ChatPanel.test.tsx,
backend/app/llm/{schema,prompts,mock,client}.py, backend/app/api/chat.py,
backend/tests/api/test_chat.py, backend/tests/llm/{test_prompts,test_client}.py,
this SUMMARY.md). All 4 commits verified present in `git log --oneline --all`
(3d61b98, 08bd86e, 65314aa, a043fe9). No missing items.

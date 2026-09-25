---
phase: 04-ai-copilot
plan: 03
subsystem: ai-copilot-chat
tags: [fastapi, sqlite, sse-safe-blocking, nextjs, react, vitest, chat-history, rehydration]
requires:
  - phase: 04-ai-copilot
    provides: "POST /api/chat route, chat_messages persistence, ChatPanel UI and action-dispatch pills (from 04-01/04-02)"
provides:
  - "get_chat_history() in backend/app/db/repository.py — every persisted chat_messages row for the default user, ascending by created_at, five-column explicit select (CHAT-06)"
  - "GET /api/chat/history route in create_chat_router, parsing each entry's actions server-side so the frontend never double-decodes"
  - "ChatHistoryEntry / ChatHistoryResponse types, getChatHistory() fetch wrapper, useChatHistory() fetch-on-mount hook"
  - "ChatPanel hydration: a hydratedRef-guarded effect that prepends the restored conversation into local state exactly once, with a loading placeholder, a non-blocking load-error banner, and the seed greeting preserved for a genuinely empty history"
affects: []
actuals:
  tokens: 6989
  tasks: 2
  commits: 4
  plan_head_before: fc8f8944a0d9e227f927729c67209ba5d3c895e6
tech-stack:
  added: []
  patterns:
    - "Fetch-once-on-mount hook shape (useChatHistory, modelled on useWatchlist) for data that is read once and then grows only through local POST-response handling, distinct from usePortfolio/usePortfolioHistory's poll-forever shape"
    - "hydratedRef-guarded effect: prepend restored data into existing local state exactly once, firing on the first non-loading resolution (including empty and error resolutions), immune to the fetch hook's fresh-array-identity-per-render churn"
    - "Server-side JSON parsing at the route boundary (json.loads on a stored TEXT column) so a frontend consumer never receives a raw JSON string to double-decode"
key-files:
  created: []
  modified:
    - backend/app/db/repository.py
    - backend/app/db/__init__.py
    - backend/app/api/chat.py
    - backend/tests/api/test_chat.py
    - frontend/lib/types.ts
    - frontend/lib/api.ts
    - frontend/lib/hooks.ts
    - frontend/components/chat/ChatPanel.tsx
    - frontend/__tests__/ChatPanel.test.tsx
    - frontend/__tests__/Watchlist.test.tsx
key-decisions:
  - "get_chat_history() carries no LIMIT and no pagination, matching get_snapshots's established baseline for this single-user app — get_recent_chat_messages's LIMIT exists for the prompt's token budget, a different concern from what the panel renders on reload"
  - "actions stays an unparsed JSON string/None at the repository layer (matching the rest of the module's raw-row convention) and is parsed only at the HTTP boundary in the route — keeps the repository/route responsibility split identical to every other chat function in this file"
  - "Watchlist.test.tsx's existing vi.mock(\"@/lib/hooks\", ...) factory needed a useChatHistory stub added, following the exact precedent already set for usePortfolio/useLiveTotalValue/usePortfolioHistory when each was wired into page.tsx — <Page /> renders ChatPanel, which now calls the new hook on mount"
  - "The seed-greeting ChatPanel.test.tsx case (04-01) was rewritten from a synchronous assertion to an awaited one: rendering now hydrates asynchronously before the greeting can be judged the correct empty-state branch, so the pre-existing assertion's intent is preserved but its timing had to change"
patterns-established:
  - "Message-area three-way render precedence (history-loading -> populated list -> seed greeting) with the load-error banner rendered as a sibling above the message area rather than as a fourth branch in that chain, so a failed background fetch never blocks the primary interaction (sending)"
requirements-completed: [CHAT-06]
coverage:
  - id: D1
    description: "get_chat_history() returns every persisted turn for the default user ascending by created_at with exactly five named columns (no star-select, no whole-row spread); GET /api/chat/history wraps it in asyncio.to_thread, returns a single messages key, and parses each entry's actions into an object or null so no consumer ever receives a raw JSON string (CHAT-06 backend half)"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_chat.py::TestGetChatHistory"
        status: pass
    human_judgment: false
  - id: D2
    description: "ChatPanel fetches history exactly once on mount, shows the loading placeholder while pending, hydrates every restored entry into the message list in order with its action pills intact, falls back to the seed greeting on an empty history, and degrades to a non-blocking error banner plus the seed greeting on a failed fetch — a message sent during the fetch still lands after the restored conversation once hydration resolves (CHAT-06 frontend half)"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ChatPanel.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live end-to-end UX: holding a short conversation including at least one executed trade, reloading the browser, and confirming every bubble and action pill returns in original order; a fresh database still shows only the greeting"
    verification: []
    human_judgment: true
    rationale: "Requires driving the running app through a real reload cycle, which cannot be exercised from an automated unit-test harness; deferred to end-of-phase human verification per workflow.human_verify_mode, per this plan's own <verification> Human check note"
duration: ~25min
completed: 2026-09-21
status: complete
---

# Phase 4 Plan 3: Chat History Rehydration Summary

**Closed the read half of CHAT-06: `GET /api/chat/history` returns every persisted turn with actions already parsed, and `ChatPanel` now hydrates from it on mount instead of always starting from the seed greeting.**

## Performance
- **Duration:** ~25min
- **Started:** 2026-09-21 (this dispatch)
- **Completed:** 2026-09-21
- **Tasks:** 2 (both `tdd="true"`, each executed as a test commit followed by an implementation commit)
- **Files modified:** 10 (0 created, 10 modified)

## Accomplishments
- `get_chat_history()` added to `backend/app/db/repository.py`: explicit five-column select (`id, role, content, actions, created_at`), bound `DEFAULT_USER_ID`, ascending by `created_at`, no `LIMIT` — matches `get_snapshots`'s no-pagination baseline rather than `get_recent_chat_messages`'s bounded prompt-budget read
- `GET /api/chat/history` route added to `create_chat_router`, mirroring `get_portfolio_history_route`'s `asyncio.to_thread` shape; parses each row's `actions` server-side (`json.loads` when non-empty, else `None`) so no consumer ever double-decodes a raw JSON string
- `backend/db/__init__.py` re-exports `get_chat_history` in its docstring, import, and `__all__`
- Seven new `TestGetChatHistory` cases in `backend/tests/api/test_chat.py`: empty-table read, single `messages` key, user-then-assistant ordering with null user actions, ascending `created_at` across multiple turns, an exact five-key no-leak assertion, and parsed (not stringified) `actions` on an executed-action turn — backend suite now at 23 chat tests, 223 total
- `ChatHistoryEntry` / `ChatHistoryResponse` added to `frontend/lib/types.ts`, deliberately kept distinct from `ChatMessage` (server ISO `created_at` vs. client-local numeric `createdAt`), with an inline comment recording why
- `getChatHistory()` added to `frontend/lib/api.ts` as a one-line `getJson<ChatHistoryResponse>` delegation
- `useChatHistory()` added to `frontend/lib/hooks.ts`, modelled directly on `useWatchlist` (fetch-once-on-mount, `mountedRef` guard, no poll), returning `{ entries, loading, error, refetch }`
- `ChatPanel.tsx` hydrates from the hook via a `hydratedRef`-guarded effect that prepends the mapped restored entries into `messages` exactly once, on the first non-loading resolution (including a zero-entry and a failed resolution); the message area's render precedence is now history-loading -> populated list -> seed greeting, with the load-error banner rendered as a sibling above the message area so a failed fetch never blocks sending
- `frontend/__tests__/ChatPanel.test.tsx` gained a `getChatHistory` mock, a `beforeEach` default of an empty resolved history, and a nested `describe("history rehydration (CHAT-06)", ...)` block with seven new cases; frontend suite now at 19 ChatPanel tests, 156 total
- `frontend/__tests__/Watchlist.test.tsx` gained a `useChatHistory` stub in its existing `vi.mock("@/lib/hooks", ...)` factory (it renders full `<Page />`, which now mounts `ChatPanel`) — same precedent already set for `usePortfolio`/`useLiveTotalValue`/`usePortfolioHistory`

## Task Commits
1. **Task 1 test: TestGetChatHistory (backend)** - `941f640`
2. **Task 1 feat: GET /api/chat/history — repository read + route (backend)** - `97cec9f`
3. **Task 2 test: ChatPanel rehydration coverage + Watchlist.test.tsx hook stub (frontend)** - `b8b5d0f`
4. **Task 2 feat: ChatPanel rehydrates from GET /api/chat/history on mount (frontend)** - `eb2fd27`

## Files Created/Modified
- `backend/app/db/repository.py` - `get_chat_history()`
- `backend/app/db/__init__.py` - re-exports `get_chat_history`
- `backend/app/api/chat.py` - `GET /api/chat/history` route, `json` import
- `backend/tests/api/test_chat.py` - `TestGetChatHistory` (7 cases)
- `frontend/lib/types.ts` - `ChatHistoryEntry`, `ChatHistoryResponse`
- `frontend/lib/api.ts` - `getChatHistory()`
- `frontend/lib/hooks.ts` - `useChatHistory()`
- `frontend/components/chat/ChatPanel.tsx` - hydration effect, three-way message-area precedence, load-error banner, loading placeholder
- `frontend/__tests__/ChatPanel.test.tsx` - `getChatHistory` mock, `beforeEach` default, 7 new rehydration cases, 1 pre-existing case updated to await hydration
- `frontend/__tests__/Watchlist.test.tsx` - `useChatHistory` stub added to the existing hooks mock

## Decisions Made
- `get_chat_history()` is intentionally unbounded (no `LIMIT`), matching `get_snapshots`'s precedent rather than `get_recent_chat_messages`'s prompt-budget-driven bound — the panel renders the whole conversation, the prompt only needs the recent tail
- `actions` stays a raw JSON string (or `None`) through the repository layer and is parsed only at the HTTP route boundary — keeps the repository/route split consistent with every other function in this module
- The pre-existing "renders the seed greeting on first render" `ChatPanel.test.tsx` case was changed from a synchronous assertion to an awaited one: the greeting is now the correct rendering only *after* hydration resolves (previously it rendered synchronously on first paint), so the test's intent (greeting shows on a fresh conversation) is unchanged but its timing had to be
- `Watchlist.test.tsx`'s hook-module mock needed a `useChatHistory` stub, following the same pattern already established when `usePortfolio`, `useLiveTotalValue`, and `usePortfolioHistory` were each wired into `page.tsx` — this is scope inherited from `<Page />` rendering `ChatPanel`, not new design

## Deviations from Plan
**1. [Rule 3 - Blocking issue] Added a `useChatHistory` stub to `Watchlist.test.tsx`'s existing hook-module mock**
- **Found during:** Task 2, running the full frontend suite after wiring `useChatHistory` into `ChatPanel`
- **Issue:** `Watchlist.test.tsx` renders full `<Page />` (which now mounts `ChatPanel`) through a `vi.mock("@/lib/hooks", ...)` factory that only stubbed the hooks known at the time each was wired in; `useChatHistory` wasn't in that list, so every test in the file crashed with "No `useChatHistory` export is defined on the mock"
- **Fix:** Added `useChatHistory: vi.fn(() => ({ entries: [], loading: false, error: null, refetch: vi.fn(async () => {}) }))` to the factory, in the same style and next to the same-purpose stubs for `usePortfolio`/`useLiveTotalValue`/`usePortfolioHistory`
- **Files modified:** `frontend/__tests__/Watchlist.test.tsx`
- **Verification:** `npm --prefix frontend run test` — 156/156 passing (previously 5 failing in this file)
- **Commit:** `b8b5d0f`

**Total deviations:** 1 auto-fixed (1 blocking-issue). **Impact:** none on shipped behavior — a pre-existing test-infrastructure mock needed to grow to cover a newly-added hook call reachable through a component it already renders; no production code was touched by this fix.

## Issues Encountered
`frontend/node_modules` was absent in this fresh worktree checkout (gitignored, not copied) — installed via `npm --prefix frontend install` as routine task setup before Task 2's vitest/typecheck/build commands, per Task 2's own `<precondition>`.

## User Setup Required
None — no new external service configuration required. This plan adds a new read-only endpoint and a frontend hydration path; no new environment variables.

## Next Phase Readiness

Phase 4 (AI Copilot) is now complete pending phase-level (end-of-phase) human verification. Across 04-01/04-02/04-03 this phase delivered:
- **CHAT-01/CHAT-02** (04-01): `POST /api/chat`, grounded in the real portfolio/watchlist via LiteLLM/OpenRouter/Cerebras (mock-backed under `LLM_MOCK=true`), persisted to `chat_messages`, surfaced through a docked/collapsible `ChatPanel`
- **CHAT-03/CHAT-04/CHAT-05** (04-02): the assistant can execute trades and watchlist changes through the exact Phase 2/3 validation paths (watchlist-before-trades ordering, per-action failure isolation), rendered as inline colour-coded confirmation pills; the held-position watchlist-removal guard (D-01/D-02/D-03) closed for both the manual and chat-initiated paths
- **CHAT-06** (04-03, this plan): reloading the browser restores the full prior conversation — bubbles and action pills alike — while a first-ever visit still shows the (never-persisted) seed greeting

The one remaining item across the whole phase is the human-judgment verification deferred by `workflow.human_verify_mode`: a live conversation against a real `OPENROUTER_API_KEY` (D5 in 04-01, D6 in 04-02, D3 in this plan), plus confirming the reload-restores-conversation behavior end-to-end in the running app. All automated checks across all three plans pass under `LLM_MOCK=true`.

---
*Phase: 04-ai-copilot*
*Completed: 2026-09-21*

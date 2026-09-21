---
phase: 04-ai-copilot
plan: 02
subsystem: ai-copilot-chat
tags: [fastapi, sqlite, sse-safe-blocking, litellm-mock, nextjs, react, vitest, ticker-normalization]
requires:
  - phase: 04-ai-copilot
    provides: "POST /api/chat route, get_chat_response/LLM client, ChatPanel UI scaffold (from 04-01)"
provides:
  - "Held-position watchlist-removal guard inside remove_watchlist_ticker(), inherited by both the manual DELETE route and the new chat dispatch path (D-01/D-02/D-03)"
  - "Chat dispatch loop: _execute_trade_action / _execute_watchlist_action in app/api/chat.py, calling execute_trade/add_watchlist_ticker/remove_watchlist_ticker exactly as the manual routes do (CHAT-03, CHAT-04)"
  - "Watchlist-before-trades execution ordering, so 'add X and buy X' in one turn resolves correctly"
  - "Per-action ValueError-to-failed-status translation, so a rejected action never aborts the rest of the turn and never mutates state (CHAT-05)"
  - "Deterministic buy/sell/add/remove keyword routing in app/llm/mock.py, exercising every dispatch path under LLM_MOCK=true"
  - "Inline executed/failed action confirmation pills in ChatPanel.tsx, colour-coded by status, watchlist-changes-first ordering"
affects: [04-03-history-rehydration]
actuals:
  tokens: 9956
  tasks: 3
  commits: 6
  plan_head_before: 812fa27fc67574d084af8d047404d5a2ca04dda5
tech-stack:
  added: []
  patterns:
    - "BEGIN IMMEDIATE transaction escalation for any repository function that SELECTs state before conditionally writing (execute_trade's WR-01 pattern, now also in remove_watchlist_ticker)"
    - "Per-action dict shape pinned key-for-key to frontend types (ChatTradeAction six keys incl. price; ChatWatchlistAction four keys, no price) rather than a generic error envelope"
    - "Dispatch-order-as-correctness-constraint: watchlist_changes iterated to completion before the first trades iteration, documented inline as load-bearing, not stylistic"
    - "Mock LLM keyword regex routing (buy/sell/add/remove) makes every real-model dispatch path exercisable deterministically under LLM_MOCK=true, including multi-action single-message turns"
key-files:
  created: []
  modified:
    - backend/app/db/repository.py
    - backend/app/api/watchlist.py
    - backend/app/api/chat.py
    - backend/app/llm/mock.py
    - backend/tests/db/test_repository.py
    - backend/tests/api/test_watchlist.py
    - backend/tests/api/test_chat.py
    - frontend/components/chat/ChatPanel.tsx
    - frontend/__tests__/ChatPanel.test.tsx
key-decisions:
  - "Phase 4 D-01 supersedes the Phase 3 03-01-PLAN.md truth 'Removing a ticker from the watchlist still succeeds while a position in it is open' (D-04) — the guard is promoted into remove_watchlist_ticker() so both the manual DELETE route and the new chat dispatch path inherit it identically (D-02); no previously-passing test was broken by this reversal, confirmed by a targeted grep of the existing suite before implementing"
  - "The mock LLM's trade/watchlist regexes are deliberately restricted to the same 1-5-alphanumeric character class is_valid_ticker_format enforces, per the plan's own instruction — the malformed-ticker-add behaviour is therefore tested by calling _execute_watchlist_action directly (exported specifically for this) rather than through the mock's keyword routing, since a real model response is not schema-constrained to a valid ticker but the mock's own regex construction can never emit an invalid one"
  - "_execute_watchlist_action's signature matches the plan's own <action> text exactly — (change, request), no price_cache parameter — over the PATTERNS.md snippet's slightly different signature, since watchlist mutations never need price_cache"
patterns-established:
  - "Flex-col message-row wrapper (items-end/items-start) replacing the flat flex-row bubble wrapper, so a pill stack can render beneath an assistant bubble while keeping left/right alignment — the pill stack is a sibling of the bubble <p>, not nested inside it"
requirements-completed: [CHAT-03, CHAT-04, CHAT-05]
coverage:
  - id: D1
    description: "remove_watchlist_ticker() raises ValueError while a position is held (quantity > 1e-9), and DELETE /api/watchlist/{ticker} translates that into a 409 that returns before the market-source notify (D-01/D-02/D-03)"
    requirement: "D-01, D-02, D-03"
    verification:
      - kind: unit
        ref: "backend/tests/db/test_repository.py::TestRemoveWatchlistTicker"
        status: pass
      - kind: unit
        ref: "backend/tests/api/test_watchlist.py::TestRemoveWatchlist::test_remove_held_ticker_returns_409_and_survives_a_subsequent_get"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /api/chat dispatches trades through execute_trade with the identical (price_cache, ticker, side, quantity) call signature the manual route uses; executed and failed outcomes both return HTTP 200 with per-action status/price/error (CHAT-03, CHAT-05)"
    requirement: "CHAT-03, CHAT-05"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_chat.py::TestChatTradeDispatch"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /api/chat dispatches watchlist adds/removes through add_watchlist_ticker/remove_watchlist_ticker with the same normalize -> format-validate -> persist -> notify ordering the manual routes use, including the D-01 held-position refusal surfacing as a failed action (CHAT-04)"
    requirement: "CHAT-04"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_chat.py::TestChatWatchlistDispatch"
        status: pass
    human_judgment: false
  - id: D4
    description: "Watchlist changes run to completion before the first trade in the same turn, so 'add X and buy X' resolves correctly; one failing action does not block the remaining actions in the same turn"
    verification:
      - kind: unit
        ref: "backend/tests/api/test_chat.py::TestChatDispatchOrdering, TestChatDispatchResilience"
        status: pass
    human_judgment: false
  - id: D5
    description: "ChatPanel renders one colour-coded pill per action beneath each assistant message (watchlist changes first, then trades), using the four Copywriting Contract strings verbatim, formatMoney for fill price, and no pill element at all when a turn carries zero actions"
    requirement: "CHAT-03, CHAT-04, CHAT-05"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ChatPanel.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live end-to-end UX: telling the assistant to buy/sell/add/remove through a real OpenRouter/Cerebras model produces the same dispatch and pill behaviour verified under LLM_MOCK=true"
    verification: []
    human_judgment: true
    rationale: "Requires a live OpenRouter/Cerebras API key and cannot be exercised under LLM_MOCK=true; deferred to end-of-phase human verification per workflow.human_verify_mode, per this plan's own <verification> Human check note"
duration: ~8min (git-timestamp span across the three TDD task pairs; see Issues Encountered for real-elapsed-time context)
completed: 2026-09-21
status: complete
---

# Phase 4 Plan 2: Chat Action Dispatch and Inline Confirmation Pills Summary

**Closed the held-position watchlist-removal gap in the shared repository function, built the chat dispatch loop that lets the assistant execute trades and watchlist changes through the exact Phase 2/3 validation paths, and rendered every executed/failed action as an inline colour-coded pill in the conversation.**

## Performance
- **Duration:** ~8min of git-timestamped work across three RED/GREEN task pairs (see Issues Encountered)
- **Started:** 2026-09-21T16:55:52+02:00 (Task 1 RED commit)
- **Completed:** 2026-09-21T17:03:30+02:00 (Task 3 GREEN commit)
- **Tasks:** 3 (all `tdd="true"`, each executed as a RED commit followed by a GREEN commit)
- **Files modified:** 9 (0 created, 9 modified) — no new files this plan; every change extends a file 04-01 or earlier phases already created

## Accomplishments
- `remove_watchlist_ticker()` (`backend/app/db/repository.py`) now opens with `BEGIN IMMEDIATE`, reads `positions` before deleting from `watchlist`, and raises `ValueError` when the held quantity exceeds `1e-9` — the exact epsilon and transaction-escalation pattern `execute_trade`'s WR-01 fix already established. Both call sites (`delete_watchlist_route` and the new chat dispatch path) inherit the guard automatically, with zero duplication
- `delete_watchlist_route` gained an `except ValueError` branch returning 409 with the guard's own message, returning before the market-source notify so a held ticker keeps streaming
- `backend/app/api/chat.py` gained `_execute_trade_action` and `_execute_watchlist_action`, dispatching model-proposed actions through `execute_trade`/`add_watchlist_ticker`/`remove_watchlist_ticker` unchanged — no second, looser execution path exists anywhere in the codebase
- The route handler now iterates `response.watchlist_changes` to completion before the first `response.trades` iteration, with an inline comment recording why the order is load-bearing (an add-then-buy turn would otherwise fail the watchlist-membership check)
- `backend/app/llm/mock.py`'s `get_mock_response` gained deterministic buy/sell/add/remove regex routing, making every dispatch path — including a single message proposing both a watchlist change and a trade — reachable and testable under `LLM_MOCK=true`
- `ChatPanel.tsx` renders a vertical pill stack beneath each assistant message: watchlist changes first, then trades, matching the backend's dispatch order; executed pills use `--color-up`, failed pills use `--color-down`, and all four Copywriting Contract strings (executed/failed × trade/watchlist) are reproduced verbatim, including the server's error text with no truncation
- `frontend/node_modules` (gitignored, absent in this fresh worktree checkout) was installed as routine task setup before Task 3's vitest/typecheck commands could run

## Task Commits
1. **Task 1 RED: held-position removal guard tests** - `820d0ff`
2. **Task 1 GREEN: held-position removal guard (D-01/D-02/D-03)** - `4bcb02e`
3. **Task 2 RED: chat dispatch loop tests** - `4eb4281`
4. **Task 2 GREEN: chat dispatch loop (CHAT-03/04/05)** - `d80d565`
5. **Task 3 RED: inline action pill tests** - `71697bd`
6. **Task 3 GREEN: inline action confirmation pills (CHAT-03/04/05)** - `b8a5706`

## Files Created/Modified
- `backend/app/db/repository.py` - `remove_watchlist_ticker` gained the `BEGIN IMMEDIATE` + held-position `ValueError` guard
- `backend/app/api/watchlist.py` - `delete_watchlist_route` gained the `except ValueError` -> 409 branch
- `backend/app/api/chat.py` - `_execute_trade_action`, `_execute_watchlist_action`, and the watchlist-then-trades dispatch loop replacing the two always-empty lists
- `backend/app/llm/mock.py` - `_TRADE_RE`/`_WATCHLIST_RE` keyword routing added to `get_mock_response`
- `backend/tests/db/test_repository.py` - four new `TestRemoveWatchlistTicker` cases covering the guard and both sides of the `1e-9` boundary
- `backend/tests/api/test_watchlist.py` - one new `TestRemoveWatchlist` case asserting the 409, the surviving row, and the skipped notify
- `backend/tests/api/test_chat.py` - `TestChatTradeDispatch`, `TestChatWatchlistDispatch`, `TestChatDispatchOrdering`, `TestChatDispatchResilience` (8 new tests)
- `frontend/components/chat/ChatPanel.tsx` - `ActionPills` component, `tradePillCopy`/`watchlistPillCopy` helpers, message-row wrapper restructured to `flex-col` so pills render beneath a bubble
- `frontend/__tests__/ChatPanel.test.tsx` - 6 new tests covering executed/failed trade and watchlist pills, the zero-actions case, and mixed-turn ordering

## Decisions Made
- **Phase 4 D-01 supersedes Phase 3's `03-01-PLAN.md` truth** "Removing a ticker from the watchlist still succeeds while a position in it is open" (D-04). A grep of the existing suite before implementing confirmed no test asserted the unguarded behaviour, so the reversal broke nothing — verified empirically, not just asserted
- The mock LLM's keyword regexes are deliberately restricted to the same `[a-z0-9]{1,5}` character class `is_valid_ticker_format` enforces (per the plan's own `<action>` instruction), which means the mock can never itself emit a malformed ticker. The "malformed ticker add is reported as a failed action" behaviour is therefore tested by calling `_execute_watchlist_action` directly with a hand-built `WatchlistAction` — exactly why the plan exports that helper by name rather than leaving it as a route-local closure
- `_execute_watchlist_action(change, request)` — no `price_cache` parameter — follows the plan's own `<action>` text over the `04-PATTERNS.md` snippet's slightly different signature; watchlist mutations never touch `price_cache`

## Deviations from Plan
None — all three tasks executed per PLAN.md's `<action>` instructions. Two minor test-only self-corrections, no production code affected:
1. The first draft of `test_sell_not_held_returns_failed_action_and_changes_nothing` didn't seed a live price for AAPL, so `execute_trade` rejected the sell for "no live price available" before ever reaching the over-sell check it was meant to exercise — fixed by seeding `client.app.state.price_cache` before the sell, matching every other trade-dispatch test in the file.
2. None else.

## Issues Encountered
`frontend/node_modules` was absent in this fresh worktree checkout (gitignored, not copied) — installed via `npm install` as routine task setup before Task 3's vitest/typecheck commands, per this dispatch's own instructions for already-approved, no-new-dependency setup.

## User Setup Required
None - no new external service configuration required. `LLM_MOCK=true` (already documented in `04-USER-SETUP.md` from 04-01) is sufficient to exercise every path this plan added.

## Next Phase Readiness
- `POST /api/chat`'s response now carries real per-action `status`/`price`/`error`, and the persisted `chat_messages.actions` payload already has this enriched shape — 04-03's `GET /api/chat/history` reload can hydrate `ChatPanel`'s pill rendering with no changes to the pill component itself
- The held-position guard (D-01/D-02/D-03) is fully closed for both call sites; no follow-up work remains from `.planning/codebase/CONCERNS.md`'s original flag
- `GET /api/chat/history` and `get_chat_history()` are still unbuilt — reserved for 04-03, as noted in 04-01's own readiness section

---
*Phase: 04-ai-copilot*
*Completed: 2026-09-21*

## Self-Check: PASSED

All 9 modified files verified present on disk (repository.py, watchlist.py,
chat.py, mock.py, test_repository.py, test_watchlist.py, test_chat.py,
ChatPanel.tsx, ChatPanel.test.tsx) plus this SUMMARY.md. All 7 commits
verified present in `git log --oneline --all` (820d0ff, 4bcb02e, 4eb4281,
d80d565, 71697bd, b8a5706, 6ec4fa5). No missing items.

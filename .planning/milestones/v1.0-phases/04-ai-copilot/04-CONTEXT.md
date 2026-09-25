# Phase 4: AI Copilot - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The user talks to FinAlly in natural language and it answers from their actual portfolio and acts on it — placing trades and editing the watchlist without leaving the conversation. Delivers `POST /api/chat` (grounded reply + auto-executed trades/watchlist actions) and `GET /api/chat/history` (reload persistence), per CHAT-01..06. Depends on Phase 3 (trade/watchlist execution paths already exist and must be reused exactly, not re-derived). `04-RESEARCH.md` and `04-UI-SPEC.md` already made most technical/visual implementation decisions in detail — this discussion focused on the product-level gray areas those documents flagged as unresolved or unaddressed: the held-position watchlist-removal gap, assistant voice, how far the AI can act without being asked, and conversation memory depth.

</domain>

<decisions>
## Implementation Decisions

### Held-position watchlist removal
- **D-01:** Removing a watchlist ticker (manually or via chat) is now blocked while the user still holds a position in it — refuses with an explanation rather than allowing the removal and freezing that position's price. — **Reversibility:** reversible — the guard is a new validation check, not a schema/contract change; removing it later just restores today's unguarded behavior.
- **D-02:** The guard lives inside the shared `remove_watchlist_ticker()` repository function (or equivalent shared layer), not duplicated separately in the chat dispatch path and the manual `DELETE /api/watchlist/{ticker}` route — one rule, no behavioral split between manual and AI-initiated removal. This closes the gap `.planning/codebase/CONCERNS.md` and `04-RESEARCH.md` Open Question 1 both flagged.
- **D-03:** "Still held" uses the same `1e-9` epsilon already governing position close-out in Phase 3 (`quantity <= 1e-9` counts as not held → removal allowed) — no new threshold invented.

### Assistant personality & tone
- **D-04:** System prompt voice is a terse desk-analyst: short, numbers-first sentences, minimal pleasantries — reinforces PLAN.md §9's "concise and data-driven" instruction and matches the terminal's data-dense aesthetic. Applies to `app/llm/prompts.py`'s `SYSTEM_PROMPT`.

### Proactive action scope
- **D-05:** The assistant only executes a trade or watchlist change when the user's own message directly requests it, or clearly agrees to a suggestion the assistant made in an earlier turn. It never proposes and executes an action in the same turn when the user did not ask for that specific action — this is how "the user asks or agrees" (PLAN.md §9) resolves under the single-turn, no-confirmation-dialog design.
- **D-06:** This same rule applies uniformly to watchlist changes, not just trades — no separate, more permissive rule for watchlist-only actions just because they carry no financial risk. One "ask or agree" rule for every action type the assistant can take.

### Conversation memory depth
- **D-07:** `HISTORY_LIMIT = 10` most-recent messages sent to the LLM as conversation context, per `04-RESEARCH.md`'s recommendation — kept as a simple, easily-tunable constant, not reopened as a bigger design question this phase.

### Claude's Discretion
- Exact wording of the chat-visible explanation when a held-position watchlist removal is blocked (D-01) — not discussed verbatim; should read naturally and reuse the existing error-slot/failed-action-pill conventions already established in `04-UI-SPEC.md`'s Copywriting Contract.
- Every UI layout, copy, color, and interaction decision already locked in `04-UI-SPEC.md` (panel placement, collapse behavior, message bubble styling, loading/error copy, action-confirmation pills) — not reopened in this discussion; downstream agents should treat that document as already-decided, not as open questions.
- Every technical/architectural decision already locked in `04-RESEARCH.md` (router-factory pattern, execution order, ticker normalization, `ValueError`-to-status translation, `GET /api/chat/history` addition) — not reopened in this discussion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `planning/PLAN.md` §9 — LLM integration design: structured-output schema, auto-execution rules, system-prompt guidance, mock mode
- `.planning/ROADMAP.md` (Phase 4 section) — goal, success criteria, scope notes
- `.planning/REQUIREMENTS.md` — CHAT-01..06 requirement text
- `.planning/phases/04-ai-copilot/04-RESEARCH.md` — full technical research: architecture, patterns, pitfalls (execution order, ticker normalization, held-position gap, CHAT-06 gap), validation strategy, security domain — locked, do not re-derive
- `.planning/phases/04-ai-copilot/04-UI-SPEC.md` — full UI design contract: layout, copy, color, typography, UI-state coverage — locked, do not re-derive
- `.planning/phases/04-ai-copilot/04-VALIDATION.md` — validation architecture for this phase
- `.claude/skills/cerebras/SKILL.md` — locked project skill for the LiteLLM/OpenRouter/Cerebras call shape
- `.planning/codebase/CONCERNS.md` — documents the held-position watchlist-removal gap this phase's D-01/D-02 close

### Existing execution paths (must be reused exactly, per scope notes)
- `backend/app/db/repository.py` — `execute_trade()`, `add_watchlist_ticker()`, `remove_watchlist_ticker()` (the D-02 guard's target), `normalize_ticker()`
- `backend/app/api/portfolio.py` — `build_portfolio()`, existing `ValueError`-to-status translation pattern
- `backend/app/api/watchlist.py` — `build_watchlist()`, existing manual `DELETE /api/watchlist/{ticker}` route (the D-02 guard also applies here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execute_trade`, `add_watchlist_ticker`, `remove_watchlist_ticker` (`backend/app/db/repository.py`) — the only mutation paths; chat dispatch must call these exactly, no second execution route.
- `build_portfolio(price_cache)` / `build_watchlist(price_cache)` — already produce the exact context an LLM prompt needs; no new context-assembly function.
- The `1e-9` epsilon constant already governing position close-out (Phase 3) — same value reused for D-03's "still held" check.

### Established Patterns
- Router-factory pattern (`create_portfolio_router`, `create_watchlist_router`) — `create_chat_router(price_cache)` must match exactly.
- `ValueError` → status-dict translation, never a raised exception reaching the chat route.
- `asyncio.to_thread()` wrapping for every blocking DB/LLM call, matching the rest of the codebase's async convention.

### Integration Points
- The D-01/D-02 held-position guard touches both `backend/app/api/watchlist.py`'s existing `DELETE` route and the new chat dispatch loop in `backend/app/api/chat.py` — implemented once, in the shared repository function, so both call sites inherit it automatically.

</code_context>

<specifics>
## Specific Ideas

- Blocked-removal explanation should read conversationally and reuse the existing failed-action-pill/error-slot copy conventions from `04-UI-SPEC.md`, e.g. in the shape of "Remove {ticker} failed — {error}" with the error text explaining the open position.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-AI Copilot*
*Context gathered: 2026-09-21*

# Phase 4: AI Copilot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 4-AI Copilot
**Areas discussed:** Held-position watchlist removal, Assistant personality & tone, Proactive action scope, Conversation memory depth

---

## Held-position watchlist removal

**Q1: If the user (or the AI) asks to remove a ticker while shares are still held, what should happen?**

| Option | Description | Selected |
|--------|-------------|----------|
| Block it (Recommended) | Refuse the removal while a position is open in that ticker — avoids a frozen-price position and a later "no live price" sell failure. Assistant explains why in chat. | ✓ |
| Allow with warning | Removal succeeds (matches today's manual DELETE behavior), but the assistant's reply explicitly warns the position's price will freeze at avg_cost. | |
| Allow silently | Keep exact current behavior — no special handling, no warning. | |

**User's choice:** Block it

**Q2: Should the held-position guard apply to both the manual watchlist page (existing DELETE route) and the AI chat path, or only to chat-initiated removals?**

| Option | Description | Selected |
|--------|-------------|----------|
| Both paths (Recommended) | Add the guard inside the shared `remove_watchlist_ticker()` function itself — one rule, no behavior split between manual and AI removal. | ✓ |
| Chat path only | Guard only the AI's dispatch logic in `app/api/chat.py`; the manual DELETE route keeps today's unguarded behavior. | |

**User's choice:** Both paths

**Q3: Should the 1e-9 epsilon rule (used for position close-out) decide what counts as "still held" for this removal guard?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, reuse epsilon (Recommended) | quantity <= 1e-9 counts as "not held" — removal allowed. Matches the exact rule already governing position close-out elsewhere. | ✓ |
| Any nonzero quantity blocks | Even a dust-sized fractional remainder blocks removal. | |

**User's choice:** Yes, reuse epsilon

**Notes:** Closes `04-RESEARCH.md` Open Question 1 and the `.planning/codebase/CONCERNS.md` "Watchlist Removal Must Guard Held Positions" gap.

---

## Assistant personality & tone

**Q1: PLAN.md §9 already says "concise and data-driven" — what voice should FinAlly's system prompt lock in beyond that?**

| Option | Description | Selected |
|--------|-------------|----------|
| Terse desk-analyst (Recommended) | Short, numbers-first sentences, minimal pleasantries — like a trading-desk analyst relaying facts. | ✓ |
| Warm conversational advisor | Friendlier, more explanatory phrasing (still concise) — closer to a helpful robo-advisor tone. | |
| Other | Describe a different voice | |

**User's choice:** Terse desk-analyst

---

## Proactive action scope

**Q1: Since there's no multi-turn confirmation step, what counts as the user "agreeing" to an AI-initiated trade in a single turn?**

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit ask/confirm only (Recommended) | Assistant only executes when the user's message directly requests it or clearly agrees to a prior suggestion. Never executes in the same turn it first proposes something unprompted. | ✓ |
| Same-turn execution on clear intent | If the user's message clearly implies intent, the assistant can suggest AND execute in one turn. | |

**User's choice:** Explicit ask/confirm only

**Q2: Can the assistant add/remove a watchlist ticker on its own initiative during analysis, without the user asking for that specific change?**

| Option | Description | Selected |
|--------|-------------|----------|
| No, same rule as trades (Recommended) | Watchlist changes also require an explicit request or clear same-turn agreement — one consistent rule for every action type. | ✓ |
| Yes, watchlist is more permissive | Assistant can proactively add a relevant ticker while discussing it, since watchlist changes carry no financial risk. | |

**User's choice:** No, same rule as trades

---

## Conversation memory depth

**Q1: RESEARCH.md defaults to sending the LLM the last 10 messages as context on every turn. Keep that default, or change it?**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 10 messages (Recommended) | Matches the prior-art default RESEARCH.md flagged as reasonable and low-risk; easy to tune later. | ✓ |
| Change the limit | Specify a different number of recent messages to include | |

**User's choice:** Keep 10 messages

---

## Claude's Discretion

- Exact wording of the chat-visible explanation when a held-position watchlist removal is blocked — reuse existing error-slot/failed-action-pill conventions from `04-UI-SPEC.md`.
- All UI layout, copy, color, and interaction decisions already locked in `04-UI-SPEC.md` — not reopened.
- All technical/architectural decisions already locked in `04-RESEARCH.md` — not reopened.

## Deferred Ideas

None — discussion stayed within phase scope.

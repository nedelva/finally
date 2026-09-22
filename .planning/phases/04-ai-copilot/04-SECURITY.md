---
phase: "04"
slug: "ai-copilot"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-22"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `POST /api/chat` | Untrusted free-text user input enters the server here | Chat message text |
| server → OpenRouter/Cerebras | The user's message plus their real portfolio figures leave the process over the network; a bearer credential crosses with them | Portfolio context, message text, `OPENROUTER_API_KEY` |
| OpenRouter response → `ChatResponse` parse | Untrusted, model-generated content re-enters the process and is turned into a typed object | Model-generated JSON (message, trades, watchlist_changes) |
| `app/llm` → `chat_messages` table | Model-generated text is persisted | Chat message + action history |
| model output → action dispatch | Model-generated tickers, sides and quantities become arguments to real mutating repository functions | Trade/watchlist action parameters |
| chat dispatch → SQLite | Writes to `users_profile`, `positions`, `trades`, `portfolio_snapshots` and `watchlist` originate from a non-human decision | Portfolio mutations |
| `remove_watchlist_ticker` read → write | A `SELECT` on `positions` decides whether a `DELETE` on `watchlist` proceeds | Held-position guard check |
| `chat_messages` rows → `GET /api/chat/history` response | Stored database rows, including model-generated text, cross into an HTTP response body | Chat history rows |
| history response → React rendering | Model-generated content from prior sessions is rendered into the DOM | Restored chat message content |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | `OPENROUTER_API_KEY` in `app/llm/client.py` | medium | mitigate | Key read only via `os.environ` inside `litellm`; `client.py` never logs the request object or headers — the only logger call logs the exception + user message. No key echo/persist anywhere in app code; `.env` gitignored. | closed |
| T-04-02 | Denial of Service | Unbounded `message` length on `POST /api/chat` | medium | mitigate | `MAX_MESSAGE_CHARS = 4000` enforced in `chat.py:170-174`, before any DB write or model call; returns 400 with no state change. | closed |
| T-04-03 | Denial of Service | Blocking `litellm.completion()` on the shared event loop stalls `/api/stream/prices` for every connected SSE client | high | mitigate | `await asyncio.to_thread(get_chat_response, ...)` is the sole path to `completion()`, verified by repo-wide grep (single call site each). | closed |
| T-04-04 | Tampering | Malformed or adversarial model output crashing the route | medium | mitigate | One `try` spans `completion()` and `ChatResponse.model_validate_json`, returning a fallback `ChatResponse` on any exception. | closed |
| T-04-05 | Information Disclosure | Portfolio figures sent to a third-party inference provider | low | accept | Simulated-money positions in a single-user demo app with no real-world value and no PII; sending them is CHAT-02's grounding requirement. | closed |
| T-04-SC | Tampering | `uv add litellm pydantic python-dotenv` (supply chain) | high | mitigate | Package Legitimacy Audit in 04-RESEARCH.md plus a blocking human checkpoint before install (approved, recorded in 04-01-SUMMARY.md); pinned versions in `uv.lock` from PyPI. | closed |
| T-04-06 | Elevation of Privilege | Excessive Agency — trades/watchlist changes execute with no human approval | low | accept | Locked product decision (PLAN.md §9); blast radius bounded — simulated money, no external tool surface, mutations only through validated functions. | closed |
| T-04-07 | Tampering | Prompt injection steering an unrequested trade | low | accept | Database layer is the authority; chat path calls the same validated `execute_trade` as the manual route; no indirect/third-party content ingested. | closed |
| T-04-08 | Tampering | TOCTOU between held-position `SELECT` and `watchlist` `DELETE` | medium | mitigate | `BEGIN IMMEDIATE` acquires the write lock before the guard's read, same WR-01 escalation pattern as `execute_trade`. | closed |
| T-04-09 | Tampering | Model-supplied ticker reaching SQL or the price cache unnormalised/malformed | medium | mitigate | `normalize_ticker` on every proposed ticker before any repository/cache call, `is_valid_ticker_format` before watchlist insert; all SQL uses `?` placeholders (S608 ruff gate re-run clean). | closed |
| T-04-10 | Denial of Service | A single model response proposing a very large number of actions | low | accept | Each action fails fast through the same validated path; bounded by the model's output token limit; no per-action network call. | closed |
| T-04-11 | Information Disclosure | `GET /api/chat/history` over-returning internal columns | low | mitigate | Repository read names five columns explicitly (no star-select); route response carries exactly those five keys; exact-key-set test exists. | closed |
| T-04-12 | Tampering | Stored model output rendered back into the page on reload (stored-XSS shape) | low | mitigate | React escapes interpolated text by default; message content rendered as plain JSX text; no `dangerouslySetInnerHTML`/markdown renderer anywhere in frontend. | closed |
| T-04-13 | Denial of Service | Unbounded conversation history returned in a single response and rendered in one list | low | accept | Single-user simulated app; no-pagination precedent already set elsewhere; list is internally scrollable. | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-05 | Simulated-money, single-user app with no PII — sending portfolio figures to the inference provider is the grounding requirement (CHAT-02) itself. | Product decision, PLAN.md §9 | 2026-09-22 |
| AR-04-02 | T-04-06 | Zero-friction, no-confirmation trade execution is a locked product decision; blast radius bounded (simulated money, no external tool surface, validated mutation path only). | Product decision, PLAN.md §9 | 2026-09-22 |
| AR-04-03 | T-04-07 | Database layer is the sole authority regardless of what the model proposes; no indirect/third-party content is ever ingested (the scenario OWASP LLM01 primarily addresses). | Security audit | 2026-09-22 |
| AR-04-04 | T-04-10 | Each proposed action fails fast through the same validated, non-networked path; bounded by the model's own output token limit. | Security audit | 2026-09-22 |
| AR-04-05 | T-04-13 | Single-user simulated app; existing no-pagination precedent (`get_snapshots`); the message list is internally scrollable rather than page-growing. | Security audit | 2026-09-22 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-22 | 14 | 14 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-22

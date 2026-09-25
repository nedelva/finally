---
phase: "4"
slug: "ai-copilot"
gate: api_coverage
created: "2026-09-21"
---

# Phase 4 — External API Coverage Matrix

> Full API Coverage by Default — Opt Out, Never Opt In.

## Detector result

`api-coverage.cjs` returned `detected: false` over the full phase scope
(`04-CONTEXT.md` + `04-RESEARCH.md` + the ROADMAP Phase 4 section, 60,418 chars).
The matrix is produced anyway: this phase *does* integrate an external service
(OpenRouter, reached through LiteLLM, pinned to the Cerebras inference provider),
so a `detected: false` verdict here is a probe artifact — the phase scope describes
the integration in terms of "LLM", "model", "completion", and "structured outputs"
rather than the probe's `api`/`sdk`/`endpoint` noun set.

## External surface in scope

**Service:** OpenRouter (`openrouter/openai/gpt-oss-120b`, provider order `["cerebras"]`)
**Client:** `litellm` (`from litellm import completion`)
**Authoritative call shape:** `.claude/skills/cerebras/SKILL.md` — a locked project skill.
The skill, not the vendor's full API surface, is the contract this project integrates against.

## Capability matrix

| # | Capability | Disposition | Reason |
|---|------------|-------------|--------|
| 1 | Chat completion — single blocking request/response (`completion(model, messages, …)`) | **INTEGRATE** | The one call shape the phase needs; `app/llm/client.py` is the sole call site (04-01) |
| 2 | Structured outputs (`response_format=<PydanticModel>` + `model_validate_json`) | **INTEGRATE** | Mandated by PLAN.md §9 and the `cerebras` skill; produces `ChatResponse` (04-01) |
| 3 | Provider pinning (`extra_body={"provider": {"order": ["cerebras"]}}`) | **INTEGRATE** | Mandated verbatim by the `cerebras` skill |
| 4 | Reasoning effort control (`reasoning_effort="low"`) | **INTEGRATE** | Present in the skill's own structured-output snippet; carried over verbatim |
| 5 | Conversation history in `messages` (multi-turn context) | **INTEGRATE** | CHAT-02 grounding; `HISTORY_LIMIT = 10` per D-07 (04-01) |
| 6 | Token-by-token streaming (`stream=True`) | **OPT-OUT** | Explicitly rejected by PLAN.md §9: "no token-by-token streaming — Cerebras inference is fast enough that a loading indicator is sufficient". Re-opening it would contradict a locked spec decision |
| 7 | Native async client (`litellm.acompletion`) | **OPT-OUT** | This codebase's convention is sync callable + `asyncio.to_thread` (every `app.db.*` call already does this). The skill documents only the sync `completion()` shape. Adopting `acompletion` would introduce a second async idiom for one route. RESEARCH.md "Alternatives Considered" |
| 8 | Native tool/function calling (`tools=[...]`) | **OPT-OUT** | PLAN.md §9 specifies structured JSON output, not tool-calling, as the action channel. The `trades[]` / `watchlist_changes[]` arrays *are* the tool surface, executed server-side by the chat dispatch loop |
| 9 | Embeddings / RAG (`litellm.embedding`) | **OPT-OUT** | No retrieval surface in this product. RESEARCH.md's security analysis depends on there being no indirect/third-party content channel — adding RAG would invalidate the OWASP LLM01 acceptance rationale |
| 10 | Multi-provider fallback chains (`fallbacks=[...]`) | **OPT-OUT** | The skill pins Cerebras deliberately (it is the course's subject matter). A silent fallback to a slower provider would mask the latency property the no-streaming design depends on |
| 11 | Response caching / `litellm.cache` | **OPT-OUT** | Every request is grounded in live portfolio state that changes on every tick; a cache hit would return a stale valuation |
| 12 | Cost/usage callbacks, `litellm` proxy server, observability integrations | **OPT-OUT** | Single-user local app with no budget surface; the proxy server is a deployment mode this single-container product does not use (PLAN.md §3) |
| 13 | Vision / audio / image modalities | **OPT-OUT** | Not applicable — the chat panel is text-only (PLAN.md §10) |
| 14 | Model listing / router (`litellm.Router`) | **OPT-OUT** | One model, hardcoded by the locked skill; there is no model-selection UI in scope |

**Summary:** 5 INTEGRATE, 9 OPT-OUT, 0 undecided.

Every opt-out above is either a locked spec decision (PLAN.md §9, the `cerebras` skill),
a codebase-convention decision (RESEARCH.md "Alternatives Considered"), or not-applicable
to a text-only, single-user, single-model product. None was opted out for effort reasons.

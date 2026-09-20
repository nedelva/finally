# Phase 4: AI Copilot - Research

**Researched:** 2026-09-20
**Domain:** LLM-driven chat backend (LiteLLM/OpenRouter/Cerebras structured outputs) + FastAPI action-execution route + React chat UI, layered onto an existing FastAPI/SQLite/Next.js trading app
**Confidence:** HIGH

> No `CONTEXT.md` exists for this phase (no `/gsd-discuss-phase` session ran) — there is no `## User Constraints` section to reproduce. This research is derived from `REQUIREMENTS.md`, `STATE.md`, `PLAN.md`, project skills, and direct inspection of the Phase 1-3 codebase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | User sends a chat message, receives a conversational response | `POST /api/chat` route pattern (Architecture Patterns), request/loading/response cycle already scaffolded in `frontend/lib/types.ts`/`api.ts` |
| CHAT-02 | Response is grounded in cash, positions/P&L, watchlist, and history | Reuse `build_portfolio()` + `build_watchlist()` (already built in Phase 3/2) to construct the LLM context; `render_portfolio_context()` pattern from prior art |
| CHAT-03 | AI executes trades on request, shown inline, no approval step | Reuse `app.db.execute_trade` exactly (no second execution path) — see Pitfall 1 and Pitfall 3 (execution order) |
| CHAT-04 | AI adds/removes watchlist tickers, shown inline | Reuse `add_watchlist_ticker`/`remove_watchlist_ticker` + `market_source.add_ticker`/`remove_ticker`, mirroring `app/api/watchlist.py` exactly |
| CHAT-05 | Failed AI trade/watchlist action reported conversationally, no mutation | `ValueError`-to-status-dict translation pattern (Code Examples); ties directly to Pitfall 2 (no live price after add) |
| CHAT-06 | Chat history persists and reloads on browser refresh | **Gap not covered by PLAN.md §8 or prior art** — requires a new `GET /api/chat/history` endpoint; see Pitfall 5 and Open Questions |
</phase_requirements>

## Summary

Phases 1-3 already built everything this phase needs to *read from* and *act through*: `build_portfolio(price_cache)` and `build_watchlist(price_cache)` (both plain, synchronous, DB-backed functions) produce exactly the context an LLM prompt needs, and `execute_trade()` / `add_watchlist_ticker()` / `remove_watchlist_ticker()` are the single, already-hardened mutation paths (transactional, watchlist-membership-checked, `ValueError`-on-rejection) that CHAT-03/04/05 must reuse verbatim — the scope notes are explicit that there must be no second, looser execution route, and the codebase gives no reason to build one.

The LLM plumbing itself is fully specified by the project's own `cerebras` skill (`.claude/skills/cerebras/SKILL.md`, locked, not a research discovery): `litellm.completion()` against `openrouter/openai/gpt-oss-120b` with `extra_body={"provider": {"order": ["cerebras"]}}` and a Pydantic `response_format` for structured output. A near-identical implementation of this exact feature already exists in this repository's own git history (commit `c4c9d86`, on a divergent branch that is **not an ancestor of the current `main`** and therefore not present in the working tree) — it is valuable prior art for shape and test scenarios, but every call signature in it is stale against the current `main` (different `execute_trade` signature, different router-registration convention, different Tailwind design tokens) and must not be copied verbatim. This research tags every claim sourced from that commit `[PRIOR-ART: c4c9d86]`, never `[VERIFIED]`, because it is not the current codebase.

The one real gap: neither `PLAN.md` §8 nor the prior-art branch actually solves CHAT-06 (reload-persists-history). The prior art's own `ChatPanel.tsx` seeds a hardcoded greeting and never fetches history on mount, despite persisting every turn to `chat_messages` server-side — the persistence half of CHAT-06 was built, the retrieval-and-hydrate half was not. This phase must add a small new endpoint (`GET /api/chat/history`, not in the original `PLAN.md` §8 list) to close that gap; frontend `lib/types.ts` already has a `ChatMessage` shape anticipating this (`id`, `role`, `content`, `actions?`, `createdAt: number`) but no history-fetching type or function exists in `api.ts` yet.

**Primary recommendation:** Add `backend/app/llm/{schema,prompts,mock,client}.py` (pure functions, no DB/market access — mirrors the prior art's separation of concerns) and `backend/app/api/chat.py` (a `create_chat_router(price_cache)` factory matching `create_portfolio_router`/`create_watchlist_router` exactly), wrap the LLM call and the DB writes in `asyncio.to_thread()` per this project's own async convention, execute `watchlist_changes` before `trades` (order matters — see Pitfall 3), normalize every LLM-proposed ticker through `normalize_ticker()` before touching the DB (see Pitfall 4), and add a `GET /api/chat/history` endpoint plus matching `getChatHistory()`/types on the frontend to satisfy CHAT-06.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chat message send/receive, loading state, action confirmations | Browser / Client | — | New `ChatPanel.tsx`, pure UI state, one POST per turn (PLAN.md §9: no token streaming) |
| Portfolio/watchlist context assembly for the prompt | API / Backend | — | `build_portfolio()`/`build_watchlist()` already live in `app/api/portfolio.py`/`app/api/watchlist.py`; chat route imports and reuses them, does not re-derive |
| LLM call + structured-output parsing | API / Backend | — | `app/llm/client.py`, pure function, no DB/market coupling (mirrors prior art's `llm-engineer`/`backend-api-engineer` split even though both now land in one phase) |
| Trade/watchlist action execution | API / Backend | Database / Storage | Delegates to existing `app.db.execute_trade`/`add_watchlist_ticker`/`remove_watchlist_ticker` — no new mutation logic |
| Chat message persistence + history retrieval | Database / Storage | API / Backend | New repository functions on the existing `chat_messages` table (schema already exists, unused until now) |
| Market data notification on watchlist change | API / Backend | — | `request.app.state.market_source.add_ticker`/`remove_ticker`, same as the manual watchlist routes |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `litellm` | 1.102.0 (PyPI latest) [VERIFIED: pypi.org/pypi/litellm/json queried directly] | Unified `completion()` call to OpenRouter/Cerebras with structured-output support | Mandated by the project's own `cerebras` skill (`.claude/skills/cerebras/SKILL.md`) — not a research choice, a locked project decision |
| `pydantic` | 2.12.5 (already resolved in `backend/uv.lock:401-403`) [VERIFIED: backend/uv.lock:401-403] | `response_format` schema for the LLM's structured proposal (`message`, `trades[]`, `watchlist_changes[]`) | Already a transitive dependency of FastAPI in this exact project; making it explicit in `pyproject.toml` adds no new supply-chain surface, only an explicit version floor |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-dotenv` | 1.2.1 (already resolved in `backend/uv.lock:539-544`, currently unused by app code) [VERIFIED: backend/uv.lock:539-544] | Load `.env` at process start so `OPENROUTER_API_KEY`/`LLM_MOCK` are visible under plain `uv run uvicorn`/`uv run pytest`, not only under `docker run --env-file` | Recommended addition — see Environment Availability. Not currently called anywhere in `backend/app` (confirmed via grep); a one-line `load_dotenv()` in `main.py`'s module scope, before `create_market_data_source`/env reads, closes the gap the same way `MASSIVE_API_KEY` already silently depends on the caller having exported it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `litellm.completion()` (sync) called via `asyncio.to_thread` | `litellm.acompletion()` (native async) | `acompletion` avoids the thread-pool hop, but the project's own skill file only documents the sync `completion()` shape, and every other blocking call in this codebase (`app.db.*`) is already wrapped in `asyncio.to_thread` — matching that convention keeps the chat route's async shape identical to `portfolio.py`/`watchlist.py` rather than introducing a second async-call idiom for one route |
| A new `chat_messages`-driven `GET /api/chat/history` endpoint | Returning history embedded inside the `POST /api/chat` response | Embedding would only refresh history after the user's first message of a session — it does nothing for a page reload with zero new messages, which is exactly the CHAT-06 scenario (reload with prior history, no new message sent) |

**Installation:**
```bash
cd backend
uv add litellm pydantic python-dotenv
```

**Version verification:** `pydantic` and `python-dotenv` are already pinned in `backend/uv.lock` (transitive today); `uv add` will promote them to direct dependencies without changing their resolved versions unless a newer compatible release exists. `litellm` is a new direct dependency — `uv add litellm` will resolve and lock the current latest (1.102.0 confirmed via direct PyPI JSON query on 2026-09-20; the `.venv` already has 1.101.0 installed from a stale prior sync, one patch behind).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `litellm` | PyPI | Latest release 2026-09-20 (project itself is multi-year, `berriai/litellm` GitHub) | Unknown (checker returned `null` — PyPI download counts are not queryable the way npm's are) | `litellm.ai` / `github.com/berriai/litellm` | `SUS` (heuristic: `too-new`, `unknown-downloads`) | **Kept.** The `too-new`/`unknown-downloads` signals are checker-mechanism artifacts of litellm's frequent release cadence and PyPI's lack of an npm-style downloads API — Context7 independently resolves `litellm` to a "High" reputation, 12k+ snippet source (`/berriai/litellm`, `/websites/litellm_ai`), and it is explicitly named by this project's own committed `cerebras` skill file, not discovered via web search. Per protocol this SUS verdict is still surfaced verbatim; **planner must add a `checkpoint:human-verify` task before running `uv add litellm`.** |
| `pydantic` | PyPI | Latest release 2026-08-28 (project is a multi-year, foundational Python ecosystem package) | Unknown (same checker limitation) | `github.com/pydantic/pydantic` | `SUS` (heuristic: `too-new`, `unknown-downloads`) | **Kept, lower risk than the verdict implies.** Already resolved transitively in `backend/uv.lock:401-403` at 2.12.5 as a dependency of the already-installed `fastapi` — promoting it to a direct dependency introduces no new package into the dependency tree, only an explicit version constraint. Still flag per protocol; planner should fold this into the same `checkpoint:human-verify` task as `litellm` rather than a second one. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `litellm`, `pydantic` — both kept with the reasoning above; planner adds one `checkpoint:human-verify` task before `uv add litellm pydantic python-dotenv`.

## Architecture Patterns

### System Architecture Diagram

```
Browser (ChatPanel.tsx)
   │  1. GET /api/chat/history        (on mount — CHAT-06)
   │  2. POST /api/chat {message}     (on send — CHAT-01)
   ▼
FastAPI create_chat_router(price_cache)
   │
   ├─► asyncio.to_thread(get_recent_chat_messages)   ── load last N turns for prompt
   ├─► build_portfolio(price_cache)                  ── cash, positions, P&L      (existing, Phase 3)
   ├─► build_watchlist(price_cache)                  ── watchlist + live prices   (existing, Phase 2)
   ├─► asyncio.to_thread(insert_chat_message, "user", message, None)
   │
   ├─► asyncio.to_thread(get_chat_response, message, context, history)
   │        │
   │        ├─ LLM_MOCK=true  → app.llm.mock.get_mock_response()   (deterministic, no network)
   │        └─ LLM_MOCK=false → litellm.completion(openrouter/openai/gpt-oss-120b,
   │                              extra_body={"provider":{"order":["cerebras"]}},
   │                              response_format=ChatResponse)
   │              │
   │              └─ malformed/empty → caught, replaced with a fallback ChatResponse (never raises to the route)
   │
   ├─► for each watchlist_change (BEFORE trades — see Pitfall 3):
   │        normalize_ticker → add_watchlist_ticker/remove_watchlist_ticker → market_source.add/remove_ticker
   ├─► for each trade:
   │        normalize_ticker → asyncio.to_thread(execute_trade, price_cache, ticker, side, qty)
   │
   ├─► asyncio.to_thread(insert_chat_message, "assistant", llm_message, json.dumps(response))
   ▼
Response { message, trades[], watchlist_changes[] }  → ChatPanel renders bubble + inline confirmation chips
```

### Recommended Project Structure
```
backend/app/llm/
├── __init__.py      # re-exports get_chat_response, ChatResponse, TradeAction, WatchlistAction
├── schema.py         # Pydantic: TradeAction, WatchlistAction, ChatResponse (LLM's raw proposal — NOT the enriched HTTP response)
├── prompts.py        # SYSTEM_PROMPT + render_portfolio_context() + build_messages()
├── mock.py           # get_mock_response() — deterministic keyword routing for LLM_MOCK=true
└── client.py         # get_chat_response() — the only function that calls litellm.completion()

backend/app/api/
└── chat.py           # create_chat_router(price_cache) — mirrors create_portfolio_router/create_watchlist_router

backend/app/db/repository.py   # + insert_chat_message(), get_recent_chat_messages(), get_chat_history()

frontend/components/chat/
└── ChatPanel.tsx      # new — mirrors TradeBar.tsx's local-state/submit/confirmation shape

frontend/lib/
├── api.ts             # + getChatHistory()
├── types.ts           # + ChatHistoryEntry, ChatHistoryResponse (ChatResponse/ChatMessage already present)
└── hooks.ts            # + useChatHistory() or equivalent fetch-on-mount, mirroring usePortfolio's shape
```

### Pattern 1: Router-factory-with-injected-`price_cache`, `market_source` via `request.app.state`

**What:** Every existing route module (`create_portfolio_router`, `create_watchlist_router`) is a factory function taking `price_cache: PriceCache` and returning a fresh `APIRouter`; `market_source` is *not* passed to the factory — handlers pull it from `request.app.state.market_source` at request time.
**When to use:** `create_chat_router(price_cache)` must follow this exact shape — it needs both `price_cache` (for `build_portfolio`/`build_watchlist`/`execute_trade`) and `market_source` (for watchlist-change notification), so it needs a `Request` parameter on its `POST`/`GET` handlers exactly like `watchlist.py` does.
**Example:**
```python
# Source: backend/app/api/watchlist.py:68-153 (VERIFIED, current codebase)
def create_watchlist_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["watchlist"])

    @router.post("/watchlist")
    async def post_watchlist_route(body: WatchlistAddRequest, request: Request) -> JSONResponse:
        ...
        try:
            await request.app.state.market_source.add_ticker(normalized)
        except Exception:
            logger.exception("Failed to notify market source of new ticker %s", normalized)
        return JSONResponse(status_code=201, content=result)

    return router
```

### Pattern 2: `ValueError` → status dict, never an exception, for chat-initiated actions

**What:** The manual trade route (`app/api/portfolio.py:94-116`) translates a repository-level `ValueError` into an HTTP 400 with `{"success": false, "error": ...}`. The chat route cannot do the same (a single `/api/chat` call can trigger multiple actions and must still return `200` with a mix of executed/failed items — CHAT-05), so each action execution must be wrapped individually and translated into a per-action `{"status": "executed"|"failed", "error": str|None}` dict, never let a `ValueError` from `execute_trade`/`add_watchlist_ticker` propagate out of the route.
**When to use:** Every trade/watchlist action the LLM proposes.
**Example:**
```python
# New code, following the ValueError-catch shape already established in
# app/api/portfolio.py:106-111 (VERIFIED pattern) and PLAN.md §9 ("If a trade
# fails validation ... the error is included in the chat response").
async def _execute_trade_action(trade, price_cache) -> dict:
    ticker = normalize_ticker(trade.ticker)
    try:
        result = await asyncio.to_thread(execute_trade, price_cache, ticker, trade.side, trade.quantity)
        return {"ticker": ticker, "side": trade.side, "quantity": trade.quantity,
                "status": "executed", "price": result["price"], "error": None}
    except ValueError as exc:
        return {"ticker": ticker, "side": trade.side, "quantity": trade.quantity,
                "status": "failed", "price": None, "error": str(exc)}
```

### Pattern 3: Repository functions — one connection per call, plain dicts, `DEFAULT_USER_ID`

**What:** Every existing repository function (`get_watchlist`, `execute_trade`, `record_snapshot`) opens its own `sqlite3.Connection` via `get_connection()`, converts rows to plain dicts, and hardcodes `DEFAULT_USER_ID`. New chat functions must match this exactly — no shared/pooled connection, no new user-id parameter.
**Example:**
```python
# Source: backend/app/db/repository.py:21-37 (VERIFIED, current codebase) — the shape to mirror
def get_watchlist() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, user_id, ticker, added_at FROM watchlist "
            "WHERE user_id = ? ORDER BY added_at",
            (DEFAULT_USER_ID,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()
```
New `insert_chat_message`/`get_chat_history` should follow this same try/finally-close shape, using the `chat_messages` table columns exactly as declared:
```python
# Source: backend/app/db/schema.py:70-79 (VERIFIED, current codebase) — verbatim column list
CREATE_CHAT_MESSAGES = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
)
"""
```

### Pattern 4: Test isolation via `FINALLY_DB_PATH` — already automatic

**What:** `backend/tests/conftest.py:14-24` has an **autouse** fixture (`isolate_finally_db`) that points every test's SQLite file at a per-test `tmp_path`. Chat repository tests and chat API tests need no special DB setup beyond this — it is already active for every test in the suite.
**Example:**
```python
# Source: backend/tests/conftest.py:14-24 (VERIFIED, current codebase)
@pytest.fixture(autouse=True)
def isolate_finally_db(tmp_path, monkeypatch):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
```

### Anti-Patterns to Avoid

- **A second trade/watchlist execution path for chat:** Scope notes are explicit — reuse `execute_trade`/`add_watchlist_ticker`/`remove_watchlist_ticker` exactly. Do not write a parallel "AI trade" function even if it feels convenient to skip the watchlist-membership check for LLM-initiated buys.
- **Calling `litellm.completion()` directly inside `async def post_chat_route(...)`:** this blocks the event loop for the full duration of the LLM round-trip (typically hundreds of ms to a few seconds even with Cerebras), freezing `/api/stream/prices` for every connected SSE client during that window. Wrap in `asyncio.to_thread`, exactly like every `app.db.*` call elsewhere in this codebase.
- **A module-level chat router singleton:** `.planning/codebase/CONCERNS.md` already documents this exact anti-pattern from the market-data module (`stream.py`'s module-level `router = APIRouter(...)`) as a source of duplicate-route bugs. `create_chat_router()` must build a fresh `APIRouter()` inside the factory, like `create_portfolio_router`/`create_watchlist_router` already do.
- **Using the old-branch Tailwind class names** (`bg-panel-raised`, `text-accent-yellow`, `border-hairline`, `bg-positive-dim`, `text-negative`): none of these exist in this project's actual `app/globals.css` `@theme` block. The only defined tokens are `--color-bg`, `--color-panel`, `--color-border`, `--color-accent-yellow`, `--color-primary-blue`, `--color-secondary-purple`, `--color-up`, `--color-down`, referenced via Tailwind arbitrary-value syntax like `bg-[var(--color-panel)]` (see `TradeBar.tsx`, `Header.tsx`). A new `ChatPanel.tsx` must use this same syntax, not the prior-art class names.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON output from the LLM | A custom "parse JSON out of the text response and hope" loop | `litellm.completion(..., response_format=ChatResponse)` + `ChatResponse.model_validate_json(...)` | This is exactly what the project's own `cerebras` skill specifies; `litellm` converts the Pydantic model into a strict `json_schema` `response_format` for you |
| Portfolio/watchlist context for the prompt | A new context-assembly function | `build_portfolio(price_cache)` (`app/api/portfolio.py:32-76`) + `build_watchlist(price_cache)` (`app/api/watchlist.py:29-65`) | Both already exist, already handle the cache-miss-falls-back-to-avg_cost edge case (D-03), and are the same functions the manual REST endpoints use — reusing them guarantees the LLM's view of the portfolio can never drift from what `GET /api/portfolio` reports |
| Trade/watchlist validation logic | Any new "is this trade allowed" check | `execute_trade`, `add_watchlist_ticker`, `remove_watchlist_ticker` (`app/db/repository.py`) | Already transactional (`BEGIN IMMEDIATE`), already watchlist-membership-checked, already epsilon-safe for float share quantities — re-deriving any of this for chat risks a second, subtly different rule set |

**Key insight:** This phase is almost entirely *integration*, not new domain logic — nearly every piece of business logic it needs (portfolio math, trade execution, watchlist mutation, ticker normalization) was already built and tested in Phases 2-3. The only genuinely new logic is the LLM call/parsing itself and the thin action-dispatch loop around it.

## Common Pitfalls

### Pitfall 1: Reusing `execute_trade`'s call signature wrong

**What goes wrong:** The current `execute_trade` signature is `execute_trade(price_cache, ticker: str, side: str, quantity: float) -> dict`, and it *raises* `ValueError` on rejection — it does not return `{"success": bool, ...}`. The prior-art implementation (`[PRIOR-ART: c4c9d86]`, `backend/app/llm/client.py` era) called a differently-shaped `execute_trade(ticker, side, quantity, price_cache)` that returned a `{"success", "trade", "error"}` dict. Copying that call shape verbatim will throw a `TypeError` (wrong argument order) or silently swallow the actual current contract (no `.raise`/`try` around it).
**Why it happens:** The prior art is from a divergent branch with its own, different `repository.py`; the argument order and return contract changed during this project's actual Phase 3 build.
**How to avoid:** Call it exactly as `app/api/portfolio.py:107-109` does: `await asyncio.to_thread(execute_trade, price_cache, normalized, body.side, body.quantity)`, wrapped in `try/except ValueError`.
**Warning signs:** A `TypeError: execute_trade() takes 4 positional arguments but ...` at runtime, or a trade that "succeeds" with no cash/position change (because the wrong function was imported).

### Pitfall 2: A just-added watchlist ticker has no live price yet

**What goes wrong:** `market_source.add_ticker(ticker)` only tells the running data source to start producing prices for that ticker on its next tick (~500ms for the simulator) — it does not synchronously populate `PriceCache`. If the LLM's response proposes "add PLTR to watchlist AND buy 5 PLTR" in the same turn, `execute_trade` will find no cache entry and raise `"No live price available for PLTR."`, per `app/db/repository.py:233-235`.
**Why it happens:** `PriceCache` is populated by an async background loop, not by `add_ticker()` itself.
**How to avoid:** Do not build a "wait for the first tick" retry loop for the MVP — this is exactly the scenario CHAT-05 anticipates ("A request the portfolio cannot support... produces a conversational explanation of the failure"). The trade action legitimately fails, is reported as `status: "failed"` with the real error text, and the conversation naturally continues ("I've added PLTR to your watchlist, but I need a live price before I can buy it — try again in a moment").
**Warning signs:** A flaky test that buys a ticker in the same turn it was just added; treat this as expected behavior, not a bug to suppress.

### Pitfall 3: Execution order — watchlist changes before trades, not after

**What goes wrong:** The prior art (`[PRIOR-ART: c4c9d86]`, `app/api/chat.py`) executes `trades` first, then `watchlist_changes`, in the response-building loop. In *this* codebase, `execute_trade` rejects any ticker not already on the watchlist (`app/db/repository.py:226-231`, the D-01 membership check). A single natural request like "add PLTR and buy 10 shares" would have its trade fail with `"PLTR is not on your watchlist."` if trades run first — even though the watchlist add in the same response would have made it valid moments later.
**Why it happens:** The membership check exists in this project's `execute_trade` but did not exist in the prior art's differently-shaped trade function, so order didn't matter there.
**How to avoid:** Execute `watchlist_changes` before `trades` in `app/api/chat.py`'s dispatch loop.
**Warning signs:** A test for "add and buy in one message" failing with a watchlist-membership error despite the add action reporting `"status": "executed"` in the same response.

### Pitfall 4: LLM-supplied tickers reach the DB unnormalized

**What goes wrong:** The Pydantic schema only constrains `ticker: str` — the LLM can return `"aapl"`, `" AAPL "`, or similar. Manual routes always call `normalize_ticker()` (uppercase + strip) before touching the DB or `PriceCache`; `execute_trade`/`add_watchlist_ticker` themselves do **not** normalize — `app/db/repository.py`'s own docstrings say "Expects an already-normalized ticker — the format/normalize gate lives at the API boundary." A chat action that skips this gate can insert a lowercase watchlist row that never matches the uppercase `PriceCache` keys, or a trade that fails the watchlist-membership check purely on case mismatch.
**Why it happens:** The Pydantic schema for the LLM's proposal has no ticker-format validator (nor should it — that would make the LLM's honest attempt at a bad ticker crash schema validation instead of failing gracefully as CHAT-05 wants).
**How to avoid:** Call `normalize_ticker(action.ticker)` immediately when dispatching each proposed action, exactly like `post_trade_route`/`post_watchlist_route` do. For watchlist adds, also run `is_valid_ticker_format()` and report a `"failed"` status with a clear error for a garbage ticker string, rather than inserting it.
**Warning signs:** A watchlist row that never gets a price; a trade rejected as "not on your watchlist" for a ticker the user can see in the UI (case mismatch).

### Pitfall 5: CHAT-06 (reload persistence) is not solved by persisting messages alone

**What goes wrong:** Persisting every turn to `chat_messages` (which both the prior art and this phase's scope notes cover) satisfies the *write* half of CHAT-06 but not the *read* half. The prior art's own `ChatPanel.tsx` never fetches history on mount — it always seeds a hardcoded greeting, so reloading the browser in that build actually lost the visible conversation even though the DB rows were intact. `PLAN.md` §8's endpoint table has no `GET` for chat history at all.
**Why it happens:** `POST /api/chat`'s response only ever contains the *new* turn — there is no endpoint that returns everything already in `chat_messages`.
**How to avoid:** Add `GET /api/chat/history` (new, not in the original `PLAN.md` §8 list, required to satisfy CHAT-06) returning all persisted messages for `DEFAULT_USER_ID` ascending by `created_at`, with `actions` already `json.loads()`-parsed server-side (not left as a raw JSON string the frontend has to double-decode). Fetch it once on `ChatPanel` mount and hydrate initial state from it; fall back to the seed greeting only when the history is empty.
**Warning signs:** A UAT/E2E scenario that sends a chat message, reloads the page, and finds the chat panel empty despite `chat_messages` rows existing in the DB.

## Code Examples

### `app/llm/schema.py` — the LLM's raw proposal (distinct from the HTTP response)

```python
# Adapted from prior art (c4c9d86, PRIOR-ART reference only — not current code)
# and the cerebras skill's structured-output convention.
from typing import Literal
from pydantic import BaseModel, Field

class TradeAction(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float

class WatchlistAction(BaseModel):
    ticker: str
    action: Literal["add", "remove"]

class ChatResponse(BaseModel):
    """The LLM's own proposal — NOT the enriched {status, price, error} shape
    the HTTP route returns. That enrichment only exists once each action has
    actually been attempted against the DB/market data source."""
    message: str
    trades: list[TradeAction] = Field(default_factory=list)
    watchlist_changes: list[WatchlistAction] = Field(default_factory=list)
```

### `app/llm/client.py` — the only function that calls `litellm.completion()`

```python
# Source: .claude/skills/cerebras/SKILL.md (VERIFIED — locked project skill, current)
import logging
import os
from litellm import completion
from .mock import get_mock_response
from .prompts import build_messages
from .schema import ChatResponse

logger = logging.getLogger(__name__)
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
_FALLBACK_MESSAGE = "Sorry, I had trouble putting together a response just now. Please try again."

def get_chat_response(user_message: str, portfolio_context: dict, history: list[dict]) -> ChatResponse:
    if os.environ.get("LLM_MOCK") == "true":
        return get_mock_response(user_message, portfolio_context, history)

    messages = build_messages(user_message, portfolio_context, history)
    response = completion(
        model=MODEL, messages=messages, response_format=ChatResponse,
        reasoning_effort="low", extra_body=EXTRA_BODY,
    )
    try:
        return ChatResponse.model_validate_json(response.choices[0].message.content)
    except Exception:
        logger.exception("Failed to parse LLM structured response: %r", response)
        return ChatResponse(message=_FALLBACK_MESSAGE, trades=[], watchlist_changes=[])
```
Called from the route as `await asyncio.to_thread(get_chat_response, message, context, history)` — never awaited directly, since `completion()` is a blocking network call (see Anti-Patterns).

### `GET /api/chat/history` route (new — closes CHAT-06)

```python
# New code — no direct prior art (see Pitfall 5). Mirrors get_portfolio_history_route's shape.
@router.get("/chat/history")
async def get_chat_history_route() -> dict:
    rows = await asyncio.to_thread(get_chat_history)
    return {
        "messages": [
            {**row, "actions": json.loads(row["actions"]) if row["actions"] else None}
            for row in rows
        ]
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Token-by-token SSE streaming for chat responses | Single complete JSON response with a client-side loading indicator | Locked by `PLAN.md` §9 for this project specifically ("Cerebras inference is fast enough that a loading indicator is sufficient") | Simplifies the frontend to a single `postChatMessage` promise, already implemented in `frontend/lib/api.ts:109-123` — no EventSource/streaming-reducer complexity needed for chat (unlike the price feed, which does use SSE) |

**Deprecated/outdated:** Not applicable — this is a new feature in this codebase, not a migration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `litellm.completion(..., extra_body={"provider": {"order": ["cerebras"]}})` correctly routes the request through OpenRouter to the Cerebras backend and returns a response whose `.choices[0].message.content` is valid JSON matching the Pydantic `response_format` when called against the real API (not `LLM_MOCK`) | Standard Stack, Code Examples | If Cerebras/OpenRouter's structured-output support behaves differently than OpenAI's strict-mode `json_schema` (e.g., an optional field with a default isn't included, or `content` isn't pure JSON), `ChatResponse.model_validate_json()` will throw — the code already catches this generically and falls back to `_FALLBACK_MESSAGE`, so the *user-facing* risk is a degraded "sorry, try again" experience rather than a 500, but real end-to-end verification against the live API (not just `LLM_MOCK=true`) has not happened in this project's current codebase (the prior-art commit's own message says "no OPENROUTER_API_KEY is present in this repo yet, so live Cerebras calls are untested") |
| A2 | No `OPENROUTER_API_KEY` currently exists anywhere in this repository (`.env` does not exist at all — confirmed via `ls`, not via reading contents) | Environment Availability | If a `.env` is added later with the key but the app never calls `load_dotenv()`, real (non-mock) chat calls will fail with an auth error that surfaces to the user as the generic fallback message, which could be mistaken for a code bug rather than a missing-credential issue |
| A3 | Presenting AI-executed trades/watchlist changes with no confirmation step is intentional and should not be treated as an "Excessive Agency" finding requiring a human-in-the-loop gate | Security Domain | This is directly backed by `PLAN.md` §9 and `REQUIREMENTS.md`'s Out of Scope table ("Trade confirmation dialogs... Deliberate zero-friction design for AI-driven demo"), so risk of this being wrong is low, but it is called out explicitly because a generic OWASP-LLM security pass could otherwise recommend a gate this project has deliberately rejected |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should the chat-driven watchlist-removal path guard against removing a ticker the user still holds a position in?**
   - What we know: `.planning/codebase/CONCERNS.md` documents this exact scenario ("Watchlist Removal Must Guard Held Positions Once Trading Ships") as a forward-looking note expected to be fixed "whenever [the phase that] adds it (expected: Phase 3)". Direct inspection of the current `backend/app/api/watchlist.py:122-153` `delete_watchlist_route` shows **no such guard exists** — it unconditionally calls `market_source.remove_ticker()` after a successful DB delete, regardless of open positions. This phase's `WatchlistAction(action="remove")` handler will call the same `remove_watchlist_ticker()` function (per the "reuse the exact Phase 3 path" scope note), inheriting the gap.
   - What's unclear: Whether fixing this now (this phase "touches" the watchlist-removal path) is in scope, per the project's own standing decision ("Known market-data defects ... are fixed inside the phase that touches them — no dedicated cleanup phase"), or whether it should be deferred again since the *manual* DELETE route has the identical gap and fixing it only for the chat path would be inconsistent.
   - Recommendation: Flag for the planner/discuss-phase to decide explicitly rather than silently inheriting or silently fixing. If deferred, chat-driven "remove PLTR" while holding PLTR shares will freeze that position's price and make a subsequent sell fail with "no live price available" — a real, demoable failure mode, not just a theoretical one.

2. **Exact shape/limit for the LLM's conversation-history context window.**
   - What we know: The prior art used `HISTORY_LIMIT = 10` most-recent messages, formatted as plain `{"role", "content"}` turns.
   - What's unclear: Whether 10 is right for `gpt-oss-120b`'s context budget combined with the rendered portfolio-context block (which grows with position/watchlist count) — not verified against a live token count in this session.
   - Recommendation: Keep `HISTORY_LIMIT = 10` as a documented constant (easy to tune later); it is a reasonable, low-risk default, not a locked requirement.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `OPENROUTER_API_KEY` | Real (non-mock) LLM calls (CHAT-01/02/03/04/05 end-to-end against Cerebras) | Unknown — **`.env` does not exist in this repository at all** (confirmed via `ls .env` → "No such file or directory"; file contents were never read, per this session's secret-file guard) | — | `LLM_MOCK=true` (deterministic mock responses) fully covers development, unit tests, and the Phase 5 E2E suite per the scope notes; only genuinely live-API verification is blocked |
| `litellm` (Python package) | All LLM calls, mock and real | ✗ as a direct dependency (present in `.venv` at 1.101.0 from a stale prior sync, absent from `backend/pyproject.toml` and `backend/uv.lock`) | latest on PyPI: 1.102.0 [VERIFIED: pypi.org/pypi/litellm/json] | none needed — `uv add litellm` resolves it |
| `pydantic` (Python package) | `response_format` schema | ✓ (transitive via `fastapi`, `backend/uv.lock:401-403`) | 2.12.5 | none needed — already resolvable, only needs promotion to a direct dependency |

**Missing dependencies with no fallback:**
- A real `OPENROUTER_API_KEY` — without it, only `LLM_MOCK=true` behavior can be verified in this environment. This blocks live-API UAT for the "real" conversational-analysis quality (CHAT-01/CHAT-02's *qualitative* grounding), though not the mechanical trade/watchlist execution paths, which are fully exercisable under mock mode.

**Missing dependencies with fallback:**
- `litellm` as a direct dependency — trivially resolved via `uv add`, not a blocker, just not yet declared.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3.0 + pytest-asyncio 0.24.0 (backend); Vitest (frontend, per existing `frontend/vitest.config.ts` and `__tests__/*.test.tsx`) |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`); `frontend/vitest.config.ts` |
| Quick run command | `cd backend && uv run pytest tests/llm tests/api/test_chat.py -q` |
| Full suite command | `(cd backend && uv run pytest -q) && (cd frontend && npm test)` (matches `.planning/config.json`'s configured `test_command`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Send message, get conversational reply | integration | `pytest backend/tests/api/test_chat.py::test_chat_returns_message_and_empty_action_lists_by_default -x` | ❌ Wave 0 |
| CHAT-02 | Reply grounded in real cash/positions/watchlist/history | unit | `pytest backend/tests/llm/test_prompts.py -x` | ❌ Wave 0 |
| CHAT-03 | AI trade executes, shown inline | integration | `pytest backend/tests/api/test_chat.py::test_chat_happy_path_trade_executes_and_shows_up_in_portfolio -x` | ❌ Wave 0 |
| CHAT-04 | AI watchlist add/remove executes, shown inline | integration | `pytest backend/tests/api/test_chat.py::test_chat_watchlist_action_executes -x` | ❌ Wave 0 |
| CHAT-05 | Failed action reported conversationally, no mutation | integration | `pytest backend/tests/api/test_chat.py::test_chat_trade_failure_is_reported_as_failed_not_500 -x` | ❌ Wave 0 |
| CHAT-06 | Reload restores conversation history | integration + component | `pytest backend/tests/api/test_chat.py::test_chat_history_endpoint_returns_persisted_messages -x`; `npm test -- ChatPanel` | ❌ Wave 0 (both endpoint and frontend hydration are new) |

### Sampling Rate
- **Per task commit:** `uv run pytest tests/llm tests/api/test_chat.py -q` (backend); `npm test -- ChatPanel` (frontend, once it exists)
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/llm/__init__.py` — the directory exists (with only a stale `__pycache__`, confirmed via `ls`) but has **no `__init__.py`**, unlike `backend/tests/api/` and `backend/tests/db/`, which both have one. Must be created or pytest package discovery for `tests/llm/*` may behave inconsistently with the rest of the suite.
- [ ] `backend/tests/llm/conftest.py` — fixtures for `LLM_MOCK` env toggling and a fake/frozen portfolio context dict.
- [ ] `backend/tests/api/test_chat.py` — new file; the prior-art version (`[PRIOR-ART: c4c9d86]`) is a strong scenario reference (happy-path trade, failed trade, watchlist action, persistence-of-both-turns, LLM-failure-graceful-degradation) but must be rewritten against this codebase's actual fixtures (`client`, `fake_market_source`, `price_cache` — see `backend/tests/api/conftest.py`) and actual function signatures (Pitfall 1).
- [ ] Framework install: none — pytest/pytest-asyncio/Vitest are all already configured and working in this project.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Single hardcoded `user_id="default"`, no auth surface — unchanged by this phase (project-wide constraint, `.claude/CLAUDE.md`) |
| V3 Session Management | No | No sessions; single-user |
| V4 Access Control | No | Same as V2 — no multi-user boundary to enforce |
| V5 Input Validation | Yes | The user's chat message is free text passed into the LLM prompt (`build_messages`) — no server-side length/content restriction currently planned. Recommend a simple length cap (e.g., reject or truncate messages over a few thousand characters) purely to bound prompt cost/latency, not as an injection defense (see below) |
| V6 Cryptography | No | No new cryptographic material introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Prompt injection via the user's own chat message (OWASP LLM01) | Tampering | **Deliberately not mitigated with a confirmation gate** — see rationale below. The only mitigation applied is the existing, non-bypassable server-side validation inside `execute_trade`/`add_watchlist_ticker` (cash sufficiency, share sufficiency, watchlist membership, ticker format) — the LLM can *propose* anything, but the DB layer is the actual authority and rejects anything invalid regardless of what the model was tricked into proposing |
| Excessive Agency — autonomous execution of trades/watchlist changes with no human approval (OWASP LLM06) | Elevation of Privilege | **Explicitly out of scope by design, not an oversight.** `PLAN.md` §9 and `REQUIREMENTS.md`'s Out of Scope table both state a no-confirmation, zero-friction flow is a deliberate product decision for this simulated-money demo app. The blast radius is bounded by construction: (1) all money is fake/simulated with no real-world value, (2) the only mutation surface is this app's own `trades`/`positions`/`watchlist` tables via the same validated functions the manual UI uses, (3) there is no external tool-calling surface (no email, no file system, no other API) for the LLM to reach, and (4) the only untrusted input channel is the user's own message to their own single-user instance — there is no indirect/third-party content (RAG documents, scraped web pages, other users' messages) the LLM ever ingests, which is the scenario OWASP LLM01/LLM06 guidance is primarily concerned with. **A future ASVS/security pass on this phase should not recommend adding a confirmation dialog** — that would directly contradict a locked product decision; if concern remains, the correct escalation is a discussion with the user, not a unilateral plan change |
| Malformed/adversarial LLM output causing a 500 | Denial of Service (of this one endpoint) | Already covered by the fallback pattern in `get_chat_response`/`client.py` (Code Examples) — any parse failure produces a graceful fallback `ChatResponse`, never an unhandled exception reaching the route |

## Sources

### Primary (HIGH confidence)
- `.claude/skills/cerebras/SKILL.md` — locked project skill, the authoritative source for the LiteLLM/OpenRouter/Cerebras call shape (model name, `extra_body`, `response_format` usage)
- `backend/app/api/portfolio.py`, `backend/app/api/watchlist.py`, `backend/app/db/repository.py`, `backend/app/db/schema.py`, `backend/app/db/connection.py`, `backend/app/main.py`, `backend/tests/api/conftest.py`, `backend/tests/conftest.py`, `backend/app/market/ticker.py`, `backend/app/market/__init__.py`, `backend/app/db/__init__.py` — all read directly this session (current `main` branch, ground truth for every call signature and pattern cited)
- `frontend/lib/api.ts`, `frontend/lib/types.ts`, `frontend/lib/hooks.ts`, `frontend/lib/format.ts`, `frontend/app/page.tsx`, `frontend/app/globals.css`, `frontend/components/TradeBar.tsx`, `frontend/components/Header.tsx` — all read directly this session (current `main` branch)
- `backend/uv.lock` — grepped directly for `litellm`, `pydantic`, `python-dotenv` resolution state
- PyPI JSON API (`https://pypi.org/pypi/litellm/json`) — queried directly for the current `litellm` release version
- Context7 `/berriai/litellm` — queried for `response_format`/structured-output internals (`type_to_response_format_param`, strict-mode schema construction)

### Secondary (MEDIUM confidence)
- Git history commit `c4c9d86` ("Implement full FinAlly platform...") on a **non-ancestor branch** of current `main` — a complete prior implementation of this exact feature set (`backend/app/llm/*`, `backend/app/api/chat.py`, `frontend/components/chat/ChatPanel.tsx`, `test/tests/06-ai-chat.spec.ts`). Extremely valuable for test-scenario shape and prompt-construction patterns, but every call signature and design-token reference from it is tagged `[PRIOR-ART: c4c9d86]`, never `[VERIFIED]`, because it is not the current codebase and several of its specifics (execution order, `execute_trade` signature, Tailwind class names) are actively wrong against `main` today.
- `.planning/codebase/CONCERNS.md` — a codebase audit dated 2026-09-17 (before Phases 1-3 executed); its "Missing Environment Setup" and "Watchlist Removal Must Guard Held Positions" findings were independently re-verified against the current codebase this session (the former is still true — `.env.example` still does not exist; the latter is still true — no position guard exists in `watchlist.py` today)
- WebSearch: OWASP Top 10 for LLM Applications (LLM01 Prompt Injection, LLM06 Excessive Agency) — multiple secondary-source summaries (aembit.io, indusface.com, a10networks.com), cross-checked against each other for consistent framing, not against the primary OWASP GenAI document text directly in this session

### Tertiary (LOW confidence)
- WebSearch: "FastAPI chat endpoint structured LLM response non-streaming" — generic blog-level guidance confirming the non-streaming approach is a normal pattern, not project-specific; used only to sanity-check `PLAN.md` §9's already-locked design choice, not to derive it

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — the LLM call shape is a locked project skill, not a discovery; `pydantic`/`python-dotenv` versions verified against this exact project's own lockfile
- Architecture: HIGH — every pattern cited (router factory, `ValueError`-to-status translation, repository shape, DB test isolation) was read directly from the current codebase this session, not inferred
- Pitfalls: HIGH — Pitfalls 1, 3, and 4 are derived from a direct diff between the prior-art implementation and the current codebase's actual function signatures/validation order, not speculation; Pitfall 2 is derived from reading `PriceCache`/`execute_trade`'s actual cache-miss behavior; Pitfall 5 is derived from reading the prior art's `ChatPanel.tsx` end-to-end and confirming it never fetches history

**Research date:** 2026-09-20
**Valid until:** 30 days (stable domain — FastAPI/SQLite/React patterns here are unlikely to shift; the one fast-moving component, `litellm`'s exact structured-output internals, should be re-checked if implementation is delayed past a few weeks)
</content>

# Phase 4: AI Copilot - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 19 (9 new, 10 modified)
**Analogs found:** 19 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/app/llm/schema.py` | model | transform | `backend/app/api/watchlist.py` (`WatchlistAddRequest`, pydantic `BaseModel`) | role-match (schema, not route) |
| `backend/app/llm/prompts.py` | utility | transform | `backend/app/api/portfolio.py` (`build_portfolio`) + `backend/app/api/watchlist.py` (`build_watchlist`) | role-match (pure context-assembly function) |
| `backend/app/llm/mock.py` | utility | request-response | `backend/app/market/factory.py` (env-var-branching factory function) | role-match (env-var branch, deterministic return) |
| `backend/app/llm/client.py` | service | request-response | `.claude/skills/cerebras/SKILL.md` (locked call shape) + `backend/app/api/portfolio.py` (`execute_trade` try/except shape) | exact (skill is authoritative; codebase has no other LLM caller) |
| `backend/app/llm/__init__.py` | config/barrel | — | `backend/app/db/__init__.py` (docstring-listed public API + `__all__` re-export list) | exact |
| `backend/app/api/chat.py` | controller/route | request-response | `backend/app/api/watchlist.py` (`create_watchlist_router`) | exact (router-factory, `Request`-param, `ValueError`-translation, market_source notify) |
| `backend/app/db/repository.py` (add `insert_chat_message`, `get_recent_chat_messages`, `get_chat_history`; guard `remove_watchlist_ticker`) | model/repository | CRUD | same file, `get_watchlist`/`add_watchlist_ticker`/`remove_watchlist_ticker`/`execute_trade` | exact (same file, same conventions) |
| `backend/app/db/__init__.py` (re-export new repository functions) | config/barrel | — | same file (existing re-export list) | exact |
| `backend/app/api/__init__.py` (re-export `create_chat_router`) | config/barrel | — | same file (existing re-export list) | exact |
| `backend/app/main.py` (mount `create_chat_router(price_cache)`, add `load_dotenv()`) | config | — | same file (existing `include_router` calls) | exact |
| `backend/app/api/watchlist.py` (modify `delete_watchlist_route` — new `except ValueError` branch for D-01/D-02) | controller | request-response | same file, `post_watchlist_route`'s existing `except ValueError` branch (`:104-108`) | exact (same file, sibling handler in the same file already has the exact shape to copy) |
| `backend/pyproject.toml` (add `litellm`, `pydantic`, `python-dotenv` as direct deps) | config | — | same file (existing `[project.dependencies]` list) | exact |
| `backend/tests/llm/__init__.py`, `backend/tests/llm/conftest.py`, `backend/tests/llm/test_*.py` | test | — | `backend/tests/api/conftest.py`, `backend/tests/api/test_watchlist.py` | role-match (fixture + class-per-endpoint test shape) |
| `backend/tests/api/test_chat.py` | test | request-response | `backend/tests/api/test_watchlist.py` | exact (same `client`/`fake_market_source` fixtures, same class-per-behavior shape) |
| `backend/tests/api/test_watchlist.py` (add held-position-removal-blocked test case) | test | request-response | same file (existing `TestGetWatchlist`-style class) | exact |
| `backend/tests/db/test_repository.py` (add held-position-guard unit test for `remove_watchlist_ticker`) | test | CRUD | same file (existing repository-function test shape) | exact |
| `frontend/components/chat/ChatPanel.tsx` | component | request-response | `frontend/components/TradeBar.tsx` (submit/loading/confirmation local-state shape) + `frontend/components/Watchlist.tsx` (fetch-list/loading/error/empty shape) | role-match (no existing chat/message-list component; composite of two closest local-state components) |
| `frontend/lib/api.ts` (add `getChatHistory`) | service/utility | request-response | same file, `getWatchlist`/`getPortfolioHistory` (`getJson<T>` helper) | exact |
| `frontend/lib/types.ts` (add `ChatHistoryEntry`, `ChatHistoryResponse`) | model | transform | same file, `PortfolioHistoryResponse`/`WatchlistResponse` | exact |
| `frontend/lib/hooks.ts` (add `useChatHistory` or equivalent) | hook | request-response | same file, `useWatchlist`/`usePortfolio` (fetch-on-mount, no-poll variant closest to `useWatchlist`) | exact |
| `frontend/app/page.tsx` (add `ChatPanel` to right column) | component | — | same file (existing panel composition) | exact |
| `frontend/__tests__/ChatPanel.test.tsx` | test | request-response | `frontend/__tests__/TradeBar.test.tsx` (full file, read in full below) | role-match (closest local-state component test — mocked API module, submit/loading/confirmation/error assertions) |

## Pattern Assignments

### `backend/app/llm/schema.py` (model, transform)

**Analog:** `backend/app/api/watchlist.py` (Pydantic request model convention) + RESEARCH.md's own `Code Examples` section (already-verified target shape)

**Pydantic model pattern** (`backend/app/api/watchlist.py:23-27`):
```python
class WatchlistAddRequest(BaseModel):
    """Request body for `POST /api/watchlist`."""

    ticker: str
```

**Apply as:**
```python
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
    the HTTP route returns."""
    message: str
    trades: list[TradeAction] = Field(default_factory=list)
    watchlist_changes: list[WatchlistAction] = Field(default_factory=list)
```
Note: this `ChatResponse` (LLM's raw proposal) is a distinct type from the frontend's `ChatResponse` in `frontend/lib/types.ts:116-120` (the enriched HTTP response with `status`/`price`/`error` per action) — do not conflate; the backend route builds the frontend-facing shape from this Pydantic model plus per-action execution results.

---

### `backend/app/llm/__init__.py` (config/barrel)

**Analog:** `backend/app/db/__init__.py:1-40` (full file, read in full above)

**Docstring + `__all__` re-export pattern:**
```python
"""Persistence subsystem for FinAlly.

Public API:
    init_db                - Idempotent lazy schema creation + default-data seeding
    get_watchlist           - Read the current user's watchlist rows
    ...
"""

from .init import init_db
from .repository import (
    add_watchlist_ticker,
    ...
)

__all__ = [
    "init_db",
    "get_watchlist",
    ...
]
```
Apply identically for `backend/app/llm/__init__.py`: docstring lists `get_chat_response`, `ChatResponse`, `TradeAction`, `WatchlistAction`; `__all__` re-exports the same names from `.client`/`.schema`. Callers import from `app.llm`, never `app.llm.client`/`app.llm.schema` directly (mirrors "`app.market`, not `app.market.cache`" convention in `.claude/CLAUDE.md` Module Design).

---

### `backend/app/llm/prompts.py` (utility, transform)

**Analog:** `build_portfolio(price_cache)` (`backend/app/api/portfolio.py:32-76`) and `build_watchlist(price_cache)` (`backend/app/api/watchlist.py:29-65`)

**Reuse, do not re-derive** (Don't Hand-Roll, RESEARCH.md): call these two functions directly to assemble the LLM's context — never write a parallel context-assembly function. Import them:
```python
from app.api.portfolio import build_portfolio
from app.api.watchlist import build_watchlist
```

**Docstring convention to mirror** (`backend/app/api/portfolio.py:32-42`): explain *why* a value falls back the way it does (e.g., cache-miss → avg_cost) directly in the docstring, not just what the function returns.

**System prompt tone (D-04):** terse desk-analyst voice — short, numbers-first sentences, minimal pleasantries. Constant name: `SYSTEM_PROMPT` (per CONTEXT.md D-04, explicit target).

**Conversation-memory constant (D-07):** `HISTORY_LIMIT = 10` — define as a module-level `UPPERCASE_WITH_UNDERSCORES` constant per project naming convention (`.claude/CLAUDE.md` Naming Patterns), not a magic number inline.

---

### `backend/app/llm/mock.py` (utility, request-response)

**Analog:** `backend/app/market/factory.py`-style env-var branching (pattern, not literal code — file itself not re-read this session since the branch shape is fully specified in RESEARCH.md's `client.py` example) combined with `backend/app/api/portfolio.py`'s `build_portfolio` return-a-plain-dict-like-object convention.

**Core pattern:** `get_mock_response(user_message, portfolio_context, history) -> ChatResponse` — deterministic keyword routing, no network call, no randomness. Must return the same `ChatResponse` Pydantic type `client.py` returns from the real path, so the route never branches on mock-vs-real after calling `get_chat_response`.

---

### `backend/app/llm/client.py` (service, request-response)

**Analog:** `.claude/skills/cerebras/SKILL.md:24-42` (VERIFIED, locked project skill — authoritative call shape) + error-handling shape from `backend/app/api/portfolio.py:106-111`'s `try/except ValueError`.

**Imports pattern** (from the skill, `.claude/skills/cerebras/SKILL.md:24-28`):
```python
from litellm import completion
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
```

**Core call pattern** (skill, lines 37-42):
```python
response = completion(model=MODEL, messages=messages, response_format=MyBaseModelSubclass,
                       reasoning_effort="low", extra_body=EXTRA_BODY)
result = response.choices[0].message.content
result_as_object = MyBaseModelSubclass.model_validate_json(result)
```

**Error handling pattern** — no direct analog for "malformed LLM output," but mirror this project's broad-catch-in-background-task convention (`.claude/CLAUDE.md` Error Handling: "Background tasks... catch Exception broadly but log and do not re-raise... Always use logger.exception()"). Wrap `model_validate_json` in `try/except Exception`, `logger.exception(...)`, return a fallback `ChatResponse` — never let a parse failure raise out of `get_chat_response`.

**Async-wrapping pattern** — `get_chat_response` itself stays a plain synchronous function (matches every `app.db.*` repository function); the route wraps it in `asyncio.to_thread(...)`, exactly like `backend/app/api/portfolio.py:107-109` wraps `execute_trade`. Do not make `client.py` `async def` — see Anti-Patterns in RESEARCH.md ("Calling `litellm.completion()` directly inside `async def post_chat_route`").

**Env var read for LLM_MOCK** — mirror `backend/app/market/factory.py`'s `os.environ.get()` convention (per `.claude/CLAUDE.md` Configuration: "Read via `os.environ.get()`").

---

### `backend/app/api/chat.py` (controller/route, request-response)

**Analog:** `backend/app/api/watchlist.py` (`create_watchlist_router`, full file — 154 lines, read in full above)

**Imports pattern** (`backend/app/api/watchlist.py:8-20`):
```python
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import add_watchlist_ticker, get_watchlist, remove_watchlist_ticker
from app.market import PriceCache, is_valid_ticker_format, normalize_ticker

logger = logging.getLogger(__name__)
```
Apply identically for chat, substituting the chat imports (`app.db.insert_chat_message`, `app.db.get_recent_chat_messages`, `app.db.get_chat_history`, `app.llm.get_chat_response`, `app.llm.ChatResponse`, `app.db.execute_trade`, `app.db.add_watchlist_ticker`, `app.db.remove_watchlist_ticker`).

**Router-factory pattern** (`backend/app/api/watchlist.py:68-76`):
```python
def create_chat_router(price_cache: PriceCache) -> APIRouter:
    """Create the chat router with a reference to the price cache.

    Constructs a fresh `APIRouter` on every call, mirroring
    `create_watchlist_router`'s factory shape.
    """
    router = APIRouter(prefix="/api", tags=["chat"])
    ...
    return router
```
Register in `backend/app/main.py` alongside the other two (`backend/app/main.py:120-122`):
```python
app.include_router(create_stream_router(price_cache))
app.include_router(create_watchlist_router(price_cache))
app.include_router(create_portfolio_router(price_cache))
app.include_router(create_chat_router(price_cache))   # new
```
Add to `backend/app/api/__init__.py`'s re-export list alongside `create_watchlist_router`/`create_portfolio_router`.

**Market-source notify pattern** (`backend/app/api/watchlist.py:109-119`, for watchlist-add actions inside the chat dispatch loop):
```python
try:
    await request.app.state.market_source.add_ticker(normalized)
except Exception:
    logger.exception("Failed to notify market source of new ticker %s", normalized)
```
Same shape for `remove_ticker` (`backend/app/api/watchlist.py:140-150`). The chat route needs a `Request` parameter on its `POST /api/chat` handler specifically to reach `request.app.state.market_source`, exactly as `post_watchlist_route`/`delete_watchlist_route` do.

**`ValueError`-to-per-action-status pattern** (adapt from `backend/app/api/portfolio.py:106-111`, single-error version, into the chat route's multi-action version per RESEARCH.md Pattern 2):
```python
# backend/app/api/portfolio.py:106-111 — single-action shape to adapt
try:
    trade = await asyncio.to_thread(
        execute_trade, price_cache, normalized, body.side, body.quantity
    )
except ValueError as exc:
    return JSONResponse(status_code=400, content={"success": False, "error": str(exc)})
```
Adapted for chat (per-action, never propagates, loop continues). Return dicts are pinned key-for-key to the frontend types they populate (`frontend/lib/types.ts:98-114`) — `ChatTradeAction` has a `price` key, `ChatWatchlistAction` does not:
```python
async def _execute_trade_action(trade: TradeAction, price_cache) -> dict:
    """Returns a dict matching ChatTradeAction (frontend/lib/types.ts:98-105):
    {ticker, side, quantity, status, price, error} — six keys, price present."""
    ticker = normalize_ticker(trade.ticker)
    try:
        result = await asyncio.to_thread(execute_trade, price_cache, ticker, trade.side, trade.quantity)
        return {"ticker": ticker, "side": trade.side, "quantity": trade.quantity,
                "status": "executed", "price": result["price"], "error": None}
    except ValueError as exc:
        return {"ticker": ticker, "side": trade.side, "quantity": trade.quantity,
                "status": "failed", "price": None, "error": str(exc)}


async def _execute_watchlist_action(change: WatchlistAction, price_cache, request: Request) -> dict:
    """Returns a dict matching ChatWatchlistAction (frontend/lib/types.ts:109-114):
    {ticker, action, status, error} — four keys, no price. Mirrors
    post_watchlist_route/delete_watchlist_route's normalize -> format-validate
    -> persist -> notify order (backend/app/api/watchlist.py:84-151)."""
    ticker = normalize_ticker(change.ticker)
    if change.action == "add":
        if not is_valid_ticker_format(ticker):
            return {"ticker": ticker, "action": "add", "status": "failed",
                     "error": f"{ticker} isn't a valid ticker — use 1-5 letters or numbers."}
        try:
            await asyncio.to_thread(add_watchlist_ticker, ticker)
        except ValueError as exc:
            return {"ticker": ticker, "action": "add", "status": "failed", "error": str(exc)}
        try:
            await request.app.state.market_source.add_ticker(ticker)
        except Exception:
            logger.exception("Failed to notify market source of new ticker %s", ticker)
        return {"ticker": ticker, "action": "add", "status": "executed", "error": None}
    else:  # "remove"
        try:
            removed = await asyncio.to_thread(remove_watchlist_ticker, ticker)
        except ValueError as exc:
            # D-01/D-02: raised when the ticker is still held — see the
            # repository.py section below for the guard itself.
            return {"ticker": ticker, "action": "remove", "status": "failed", "error": str(exc)}
        if not removed:
            return {"ticker": ticker, "action": "remove", "status": "failed",
                     "error": f"{ticker} is not on your watchlist."}
        try:
            await request.app.state.market_source.remove_ticker(ticker)
        except Exception:
            logger.exception("Failed to notify market source of removed ticker %s", ticker)
        return {"ticker": ticker, "action": "remove", "status": "executed", "error": None}
```

**Execution order (Pitfall 3):** dispatch loop must run all `watchlist_changes` before any `trades` — see Shared Patterns below.

**Ticker normalization gate (Pitfall 4):** call `normalize_ticker(action.ticker)` immediately on every LLM-proposed ticker before it reaches `execute_trade`/`add_watchlist_ticker`/`remove_watchlist_ticker`, exactly as `post_trade_route` (`backend/app/api/portfolio.py:105`) and `post_watchlist_route` (`backend/app/api/watchlist.py:93`) already do for manual input. For watchlist adds, also gate through `is_valid_ticker_format()` (`backend/app/api/watchlist.py:94-101`) before attempting the DB write.

**New `GET /api/chat/history` route** — no direct analog in this codebase (Pitfall 5, genuinely new). Mirror `get_portfolio_history_route`'s shape (`backend/app/api/portfolio.py:118-125`):
```python
@router.get("/portfolio/history")
async def get_portfolio_history_route() -> dict:
    return await asyncio.to_thread(lambda: {"snapshots": get_snapshots()})
```
Adapted:
```python
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

---

### `backend/app/api/watchlist.py` — modify `delete_watchlist_route` (controller, request-response)

**Analog:** same file, `post_watchlist_route`'s existing `except ValueError` branch (`backend/app/api/watchlist.py:102-108`).

The route today (`:122-151`) calls `remove_watchlist_ticker(normalized)` with no `try/except` — once the D-01/D-02 guard (below) makes that function raise `ValueError` for a held position, this route needs a new branch, in the same style as its sibling handler:
```python
# post_watchlist_route's existing shape to mirror (:102-108)
try:
    result = await asyncio.to_thread(add_watchlist_ticker, normalized)
except ValueError:
    return JSONResponse(
        status_code=409,
        content={"error": f"{normalized} is already on your watchlist."},
    )
```
Adapted for `delete_watchlist_route`:
```python
try:
    removed = await asyncio.to_thread(remove_watchlist_ticker, normalized)
except ValueError as exc:
    return JSONResponse(status_code=409, content={"error": str(exc)})
if not removed:
    return JSONResponse(status_code=404, content={"error": f"{normalized} is not on your watchlist."})
```
409 (Conflict) matches the existing convention that a rejected-but-well-formed mutation on this route is a 409, mirroring the duplicate-add case above — no new status code introduced.

---

### `backend/app/db/repository.py` additions (model/repository, CRUD)

**Analog:** same file — `get_watchlist` (`:21-37`), `add_watchlist_ticker` (`:40-64`), `remove_watchlist_ticker` (`:67-87`), `execute_trade` (`:197-313`), all read in full above.

**Connection-per-call, try/finally-close pattern** (`backend/app/db/repository.py:21-37`):
```python
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

**Apply for `insert_chat_message`** (mirror `add_watchlist_ticker`'s insert-with-UUID-and-ISO-timestamp shape, `:40-64`):
```python
def insert_chat_message(role: str, content: str, actions: dict | None) -> dict:
    row_id = str(uuid.uuid4())
    created_at = datetime.now(UTC).isoformat()
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (row_id, DEFAULT_USER_ID, role, content,
                 json.dumps(actions) if actions is not None else None, created_at),
            )
    finally:
        conn.close()
    return {"id": row_id, "role": role, "content": content, "actions": actions,
            "created_at": created_at}
```

**Apply for `get_recent_chat_messages`/`get_chat_history`** (mirror `get_watchlist`'s select-and-dict-convert shape, `:21-37`, with `ORDER BY created_at` and, for the "recent N" variant, a `LIMIT ?` bound param — see `get_snapshots`, `:176-194`, for the ascending-order-no-pagination baseline the full-history variant should match exactly).

**Chat table schema to select against** (`backend/app/db/schema.py:70-79`, VERIFIED, already exists — no schema change needed):
```python
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
)
```

**D-01/D-02 held-position guard on `remove_watchlist_ticker`** — add inside the existing function (`backend/app/db/repository.py:67-87`), before the `DELETE`, inside the same connection. The guard reads (`SELECT quantity FROM positions`) and then writes (`DELETE FROM watchlist`) in the same transaction, which is exactly the SELECT-then-write shape `execute_trade` uses `BEGIN IMMEDIATE` to protect (WR-01 — see the comment at `backend/app/db/repository.py:219-224`, quoted in full below). Without it, sqlite3's default *deferred* transaction only opens on the first write, so a concurrent buy could commit between this guard's SELECT and the DELETE, removing a ticker that is now held — precisely the race D-01 exists to prevent:
```python
# backend/app/db/repository.py:219-224 (VERIFIED) — the comment/rationale to
# carry over verbatim, not just the statement
# BEGIN IMMEDIATE acquires the write lock before the first SELECT,
# instead of relying on sqlite3's default deferred-transaction
# behavior (which only opens a transaction before the first
# write). Without this, two concurrent trade requests can both
# read the same stale cash/position balance before either has
# written, producing a lost-update race (WR-01).
conn.execute("BEGIN IMMEDIATE")
```
Applied to `remove_watchlist_ticker`:
```python
def remove_watchlist_ticker(ticker: str) -> bool:
    conn = get_connection()
    try:
        with conn:
            # BEGIN IMMEDIATE, mirroring execute_trade (:219-224) — this
            # function now reads (positions) before it writes (watchlist
            # delete), the same shape that motivated BEGIN IMMEDIATE there.
            conn.execute("BEGIN IMMEDIATE")
            position_row = conn.execute(
                "SELECT quantity FROM positions WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            ).fetchone()
            if position_row is not None and position_row["quantity"] > 1e-9:
                raise ValueError(
                    f"You still hold {position_row['quantity']} shares of {ticker} — sell first."
                )
            cursor = conn.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            )
            return cursor.rowcount > 0
    finally:
        conn.close()
```
The `1e-9` epsilon is copied verbatim from `execute_trade`'s own close-out check (`backend/app/db/repository.py:275`: `if new_quantity <= 1e-9:`) per D-03 — do not invent a new threshold. Raising `ValueError` (not returning a special bool) matches this repository's existing convention that a caller-level rejection is always a `ValueError`, translated to a status code/chat-pill at the API boundary — see `add_watchlist_ticker`'s duplicate-ticker `ValueError` (`:60-61`) for the same pattern on the same table.

**Both call sites inherit the guard automatically** (D-02): `backend/app/api/watchlist.py:134` (`delete_watchlist_route`) needs the new `except ValueError` branch shown in the section above; the new chat dispatch loop's `_execute_watchlist_action` (shown in the `chat.py` section above) wraps the same call the same way trades are wrapped.

---

### `backend/pyproject.toml` (config)

**Analog:** same file, `[project.dependencies]`/`[project.optional-dependencies].dev` lists (full file read above).

Current state:
```toml
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "numpy>=2.0.0",
    "massive>=1.0.0",
    "rich>=13.0.0",
]
```
Add via `uv add litellm pydantic python-dotenv` (per RESEARCH.md Standard Stack — **flagged `SUS`/`checkpoint:human-verify` for `litellm`/`pydantic` per the Package Legitimacy Audit; do not skip that checkpoint**), which appends entries to this same list in the same `>=` lower-bound style already used for every other dependency — do not hand-edit version pins that diverge from what `uv add` resolves.

---

### `backend/tests/llm/` (test)

**Analog:** `backend/tests/api/conftest.py` (fixture shape) + `backend/tests/api/test_watchlist.py` (class-per-behavior shape), both read in full above.

`backend/tests/llm/__init__.py` — currently missing (RESEARCH.md Wave 0 Gaps); create empty, matching `backend/tests/api/__init__.py`/`backend/tests/db/__init__.py` (both present, both empty markers for package discovery).

`backend/tests/llm/conftest.py` — new fixtures for `LLM_MOCK` env toggling (`monkeypatch.setenv("LLM_MOCK", "true")`, mirroring the `isolate_finally_db` autouse fixture's `monkeypatch.setenv` idiom in `backend/tests/conftest.py`) and a frozen portfolio-context dict fixture.

---

### `backend/tests/api/test_chat.py` (test)

**Analog:** `backend/tests/api/test_watchlist.py:1-38` (excerpt read above) + `backend/tests/api/conftest.py` (`client`, `fake_market_source` fixtures).

```python
class TestGetWatchlist:
    """`GET /api/watchlist` against a freshly-seeded database."""

    def test_get_returns_ten_entries_with_expected_keys(self, client):
        response = client.get("/api/watchlist")
        assert response.status_code == 200
        ...
```
Apply the identical class-per-endpoint-behavior shape: `TestPostChat`, `TestGetChatHistory`, using the existing `client` fixture (wraps `create_app(static_dir=tmp_path, market_source=fake_market_source)`) exactly as `test_watchlist.py`/`test_portfolio.py` do — do not build a second `TestClient` fixture for chat. With `LLM_MOCK=true` set via `monkeypatch`, `fake_market_source.added`/`.removed` (recording lists, `backend/tests/api/conftest.py:21-24`) give a direct assertion surface for CHAT-04's "shown inline" requirement without needing to inspect real network calls.

---

### `backend/tests/api/test_watchlist.py` — add held-position-removal-blocked case (test)

**Analog:** same file, `TestGetWatchlist` class shape (excerpt read above) — add a sibling `TestDeleteWatchlist` case (or extend an existing one) asserting: seed a position via `execute_trade`, then `DELETE /api/watchlist/{ticker}` returns a 409 with the D-01 explanation, and the watchlist row is *not* removed (still present in a follow-up `GET /api/watchlist`).

---

### `backend/tests/db/test_repository.py` — add `remove_watchlist_ticker` guard unit test (test)

**Analog:** same file (not re-read this session — same repository-function-per-test-class shape as every other test file in this session, per `.claude/CLAUDE.md` Naming Patterns: `test_cache.py`/`test_simulator.py`-style one-module-per-source-file convention). Add a unit test calling `remove_watchlist_ticker` directly (no HTTP layer) after inserting a `positions` row with `quantity > 1e-9`, asserting it raises `ValueError`, and a companion test asserting `quantity <= 1e-9` (or no position row at all) still allows removal — covering D-03's epsilon boundary directly, one layer below the API-level test above.

---

### `frontend/components/chat/ChatPanel.tsx` (component, request-response)

**Analog A — submit/loading/confirmation shape:** `frontend/components/TradeBar.tsx` (full file, 152 lines, read in full above)
**Analog B — fetch-list/loading/error/empty shape:** `frontend/components/Watchlist.tsx` (full file, 172 lines, read in full above)

**Imports/styling-token pattern** (`frontend/components/TradeBar.tsx:11-14`, `frontend/components/Header.tsx:12-14`):
```typescript
"use client";
import { useEffect, useState } from "react";
import { postTrade } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { TradeSide, WatchlistEntry } from "@/lib/types";
```
CSS token syntax — **only** these tokens exist in `frontend/app/globals.css:1-11`, always via Tailwind arbitrary-value syntax, never a bare class name:
```
bg-[var(--color-panel)]  border-[var(--color-border)]  text-[var(--color-accent-yellow)]
bg-[var(--color-primary-blue)]  bg-[var(--color-secondary-purple)]  text-[var(--color-up)]  text-[var(--color-down)]
```
(RESEARCH.md's Anti-Patterns section explicitly warns against the prior-art's stale class names — `bg-panel-raised`, `text-accent-yellow` (bare), `border-hairline`, `bg-positive-dim`, `text-negative` — none of these exist in this project.)

**Submit/loading/local-error-state pattern** (`frontend/components/TradeBar.tsx:24-29,56-85`):
```typescript
const [submitting, setSubmitting] = useState<TradeSide | "">("");
const [error, setError] = useState("");
const [confirmation, setConfirmation] = useState("");

async function submit(side: TradeSide) {
  setSubmitting(side);
  setError("");
  const result = await postTrade({ ticker, side, quantity: parsedQuantity });
  if (result.ok && result.data.success) {
    setConfirmation(`${side === "buy" ? "Bought" : "Sold"} ...`);
    onFilled();
  } else if (result.ok && !result.data.success) {
    setError(result.data.error);
  } else if (!result.ok) {
    setError(result.error);
  }
  setSubmitting("");
}
```
Apply the same shape for the chat send button: `submitting` (boolean, Send/Sending… per Copywriting Contract), `error` (network/server send failure, input preserved per UI-SPEC — the one deliberate divergence from `TradeBar`, which clears its inputs on success but the chat input's error path must *not* clear on failure).

**Fetch-on-mount/loading/error/empty pattern** (`frontend/components/Watchlist.tsx:29-38,116-149`):
```typescript
const { watchlist, loading, error: loadError, refetch } = useWatchlist();
...
{loading ? ( /* loading row */ ) : loadError ? ( /* error banner */ ) : watchlist.length === 0 ? ( /* empty state */ ) : ( /* populated list */ )}
```
Apply for `ChatPanel`'s history fetch: `useChatHistory()` (new hook, see below) → loading = `"Loading conversation…"`, error = banner per Copywriting Contract (does not block sending — UI-SPEC explicitly says seed greeting still renders underneath), empty = seed greeting bubble.

**Confirmation-pill fade-timer pattern** (`frontend/components/TradeBar.tsx:44-48`):
```typescript
useEffect(() => {
  if (confirmation === "") return;
  const timer = setTimeout(() => setConfirmation(""), CONFIRMATION_FADE_MS);
  return () => clearTimeout(timer);
}, [confirmation]);
```
Not directly reused for `ChatPanel` (action-confirmation pills there are inline per-message, not a single transient banner), but the cleanup-on-unmount idiom (`clearTimeout`/`clearInterval` in the effect's return) is the project-wide convention to follow for any timers `ChatPanel` introduces (e.g. auto-scroll-on-new-message).

**`data-testid` convention** — every interactive element and state slot carries a `data-testid` (`trade-bar-ticker`, `trade-bar-error`, `watchlist-add-error`, `watchlist-loading`, etc.) — apply the same for `ChatPanel`'s send button, input, message list, loading bubble, error banner, and per-action confirmation pills.

**Component doc-comment convention** (top-of-file, `frontend/components/TradeBar.tsx:3-9`, `frontend/components/Watchlist.tsx:3-14`) — a plain (non-JSDoc) comment block explaining what the component mirrors and why, referencing requirement IDs / decision IDs (`D-07`, `PLAN.md §2`) — apply the same for `ChatPanel.tsx`, referencing `D-01`..`D-07` and CHAT-01..06 as relevant.

---

### `frontend/__tests__/ChatPanel.test.tsx` (test, request-response)

**Analog:** `frontend/__tests__/TradeBar.test.tsx` (full file, 183 lines, read in full above).

**Mocked-API-module pattern** (`:1-10`):
```typescript
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradeBar } from "@/components/TradeBar";
import { postTrade } from "@/lib/api";
import type { TradeResponse, WatchlistEntry } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  postTrade: vi.fn(),
}));
```
Apply for `ChatPanel.test.tsx`, mocking both `postChatMessage` and `getChatHistory` from `@/lib/api`.

**In-flight/loading-state assertion pattern** (`:86-111`) — assert the disabled/relabeled state *while the promise is pending*, by holding an unresolved promise open via a manually-captured `resolvePromise`:
```typescript
let resolvePromise!: (value: { ok: true; data: TradeResponse }) => void;
vi.mocked(postTrade).mockReturnValue(
  new Promise((resolve) => { resolvePromise = resolve; }),
);
...
expect(screen.getByTestId("trade-bar-buy")).toBeDisabled();
expect(screen.getByTestId("trade-bar-buy")).toHaveTextContent("Buying...");
...
resolvePromise({ ok: true, data: { success: false, error: "..." } });
await waitFor(() => expect(screen.getByTestId("trade-bar-buy")).not.toBeDisabled());
```
Apply for asserting `ChatPanel`'s "Thinking…" bubble and disabled Send button while `postChatMessage` is in flight.

**Fake-timer confirmation-fade pattern** (`:113-162`) — `vi.useFakeTimers()`/`vi.advanceTimersByTime(...)` around `fireEvent` (not `userEvent`, which conflicts with fake timers) for any transient UI state. Not directly needed for `ChatPanel` (its per-message pills don't fade), but this is the project's only existing example of testing a timed UI transition and is the pattern to reach for if `ChatPanel` introduces one (e.g. auto-scroll debounce).

**Error-preserves-input assertion pattern** (`:164-182`):
```typescript
vi.mocked(postTrade).mockResolvedValue({
  ok: true,
  data: { success: false, error: "Insufficient cash for this trade. Lower the quantity and try again." },
});
...
await waitFor(() =>
  expect(screen.getByTestId("trade-bar-error")).toHaveTextContent(
    "Insufficient cash for this trade. Lower the quantity and try again.",
  ),
);
expect(quantityInput.value).toBe("1000");   // input NOT cleared on failure
```
Apply directly for `ChatPanel`'s send-failure case (UI-SPEC: "the typed message is **not** cleared from the input, so the user can retry without retyping").

---

### `frontend/lib/api.ts` — `getChatHistory()` (service/utility, request-response)

**Analog:** same file, `getWatchlist()`/`getPortfolioHistory()` (`frontend/lib/api.ts:42-52`)

**Core pattern:**
```typescript
export function getPortfolioHistory(): Promise<ApiResult<PortfolioHistoryResponse>> {
  return getJson<PortfolioHistoryResponse>("/api/portfolio/history");
}
```
Apply as:
```typescript
export function getChatHistory(): Promise<ApiResult<ChatHistoryResponse>> {
  return getJson<ChatHistoryResponse>("/api/chat/history");
}
```
`postChatMessage` already exists (`frontend/lib/api.ts:109-123`) and needs no change — it already follows the `!res.ok` / `readError` / `ApiResult` pattern exactly.

---

### `frontend/lib/types.ts` — `ChatHistoryEntry`, `ChatHistoryResponse` (model, transform)

**Analog:** same file, `PortfolioSnapshot`/`PortfolioHistoryResponse` (`frontend/lib/types.ts:68-75`)

```typescript
export interface PortfolioSnapshot {
  total_value: number;
  recorded_at: string;
}
export interface PortfolioHistoryResponse {
  snapshots: PortfolioSnapshot[];
}
```
Apply as (matching the backend's `get_chat_history_route` response shape and the already-existing `ChatMessage`/`ChatResponse` types at `frontend/lib/types.ts:96-128`):
```typescript
export interface ChatHistoryEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: ChatResponse | null;
  created_at: string;
}
export interface ChatHistoryResponse {
  messages: ChatHistoryEntry[];
}
```
Note the existing `ChatMessage` (`:122-128`) uses `createdAt: number` (client-local, for optimistic UI messages before persistence) — `ChatHistoryEntry.created_at: string` (ISO, server-persisted) is deliberately a distinct shape; `ChatPanel` will need a small mapper from one to the other, not a type merge.

---

### `frontend/lib/hooks.ts` — `useChatHistory()` (hook, request-response)

**Analog:** same file, `useWatchlist()` (`frontend/lib/hooks.ts:104-134`) — closest because it fetches once on mount with no poll interval, matching chat history's "fetch once, then grow via `POST` responses" access pattern (unlike `usePortfolio`/`usePortfolioHistory`, which poll).

**Core pattern:**
```typescript
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getWatchlist();
    if (!mountedRef.current) return;
    if (res.ok) {
      setWatchlist(res.data.watchlist);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { watchlist, loading, error, refetch };
}
```
Apply identically for `useChatHistory()`, substituting `getChatHistory()`/`ChatHistoryEntry[]`. Keep the `mountedRef` guard and the `eslint-disable` comment — both are load-bearing project conventions, not incidental.

---

### `frontend/app/page.tsx` (composition, no new logic)

**Analog:** same file — existing panel composition (not re-read this session; UI-SPEC §"Layout & Panel Integration" already specifies the exact wrapper classes to add: `flex flex-col gap-4 lg:flex-row lg:items-start` row wrapping a `flex-1 min-w-0` left column and a `w-full lg:w-96 lg:shrink-0 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-4rem)]` right column containing `<ChatPanel>`). Treat `04-UI-SPEC.md` lines 37-54 as the locked source for this file's exact diff — do not re-derive layout.

---

## Shared Patterns

### Router-factory-with-injected-`price_cache`
**Source:** `backend/app/api/watchlist.py:68-76`, `backend/app/api/portfolio.py:79-87`
**Apply to:** `backend/app/api/chat.py`'s `create_chat_router(price_cache)`
```python
def create_chat_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["chat"])
    # ... route definitions ...
    return router
```
Never a module-level `router = APIRouter(...)` singleton (the documented anti-pattern in `backend/app/market/stream.py` and `.planning/codebase/CONCERNS.md`).

### `ValueError` → status translation, never an uncaught exception
**Source:** `backend/app/api/portfolio.py:106-111` (single-action), adapted per-action for chat (RESEARCH.md Pattern 2)
**Apply to:** every trade/watchlist action dispatched from `chat.py`, and the modified `delete_watchlist_route` in `watchlist.py` (new `except ValueError` branch for the D-01/D-02 guard).

### `asyncio.to_thread()` for every blocking call
**Source:** `backend/app/api/portfolio.py:92,107-109,112,125`; `backend/app/api/watchlist.py:81,103,134`
**Apply to:** every DB call (`insert_chat_message`, `get_recent_chat_messages`, `get_chat_history`, `execute_trade`, `add_watchlist_ticker`, `remove_watchlist_ticker`) and the LLM call (`get_chat_response`) inside `chat.py`'s route handlers — never call any of these directly inside `async def`.

### Ticker normalization gate at the API boundary
**Source:** `backend/app/market/ticker.py` (`normalize_ticker`, `is_valid_ticker_format`, full file read above); applied at `backend/app/api/watchlist.py:93-101`, `backend/app/api/portfolio.py:105`
**Apply to:** every LLM-proposed `ticker` string in `chat.py`'s dispatch loop, immediately on receipt from the parsed `ChatResponse`, before any DB/cache call.

### Execution order: watchlist changes before trades
**Source:** RESEARCH.md Pitfall 3 (derived from `execute_trade`'s watchlist-membership check at `backend/app/db/repository.py:226-231`) — no existing codebase analog (new ordering constraint), but the underlying membership check it must not violate is itself a Shared Pattern:
```python
# backend/app/db/repository.py:226-231
watchlisted = conn.execute(
    "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?",
    (DEFAULT_USER_ID, ticker),
).fetchone()
if watchlisted is None:
    raise ValueError(f"{ticker} is not on your watchlist.")
```
**Apply to:** `chat.py`'s dispatch loop — iterate `response.watchlist_changes` to completion, then iterate `response.trades`.

### `BEGIN IMMEDIATE` for any read-then-write repository function
**Source:** `backend/app/db/repository.py:219-224` (`execute_trade`'s WR-01 comment, quoted in full above)
**Apply to:** the new held-position guard inside `remove_watchlist_ticker` — any repository function that `SELECT`s state and then conditionally writes based on it (not just `execute_trade`) must open with `conn.execute("BEGIN IMMEDIATE")` inside its `with conn:` block, not rely on sqlite3's default deferred-transaction behavior.

### `1e-9` epsilon for "still held" / close-out
**Source:** `backend/app/db/repository.py:275` (`if new_quantity <= 1e-9:`)
**Apply to:** the new held-position guard inside `remove_watchlist_ticker` (D-03) — same literal, same comparison direction (`quantity > 1e-9` means still held; `<= 1e-9` means not held).

### DB test isolation — already automatic
**Source:** `backend/tests/conftest.py` (autouse `isolate_finally_db` fixture, per RESEARCH.md Pattern 4, not re-read this session — RESEARCH.md quotes it verbatim and confirms it is autouse)
**Apply to:** all new `backend/tests/llm/*` and `backend/tests/api/test_chat.py` tests need no special DB setup beyond what already applies to the whole suite.

### `client`/`fake_market_source` API test fixtures
**Source:** `backend/tests/api/conftest.py` (full file, 87 lines, read in full above)
**Apply to:** `backend/tests/api/test_chat.py` — use the existing `client` fixture (wraps `create_app(static_dir=tmp_path, market_source=fake_market_source)`) exactly as `test_watchlist.py`/`test_portfolio.py` do; do not build a second TestClient fixture for chat.

### Class-per-endpoint-behavior test shape
**Source:** `backend/tests/api/test_watchlist.py:1-38` (excerpt read above)
```python
class TestGetWatchlist:
    """`GET /api/watchlist` against a freshly-seeded database."""

    def test_get_returns_ten_entries_with_expected_keys(self, client):
        response = client.get("/api/watchlist")
        assert response.status_code == 200
        ...
```
**Apply to:** `backend/tests/api/test_chat.py` — one `class Test{Verb}{Noun}` per route/behavior (`TestPostChat`, `TestGetChatHistory`), one `def test_...` per scenario named for the exact behavior under test.

### Mocked-API-module Vitest pattern
**Source:** `frontend/__tests__/TradeBar.test.tsx:1-10,86-111,164-182` (full file, read in full above)
**Apply to:** `frontend/__tests__/ChatPanel.test.tsx` — `vi.mock("@/lib/api", () => ({ ... }))` at module scope, `vi.mocked(fn).mockResolvedValue(...)`/`mockReturnValue(new Promise(...))` for in-flight-state assertions, `fireEvent`+`vi.useFakeTimers()` (never `userEvent`) when a test needs to control a timer, and the error-preserves-input assertion shape for send failures.

## No Analog Found

None. Every new/modified file has at least a role-match analog in the current codebase or an authoritative external source (the locked `cerebras` skill for the LLM call shape). The two weakest matches — `ChatPanel.tsx`/`ChatPanel.test.tsx` (no prior chat/message-list component or its test exists in this codebase) and `mock.py` (no prior deterministic-mock-response function exists) — are documented above as composites of the two closest available local patterns (`TradeBar.tsx`+`.test.tsx` + `Watchlist.tsx`; env-var-branch + plain-dict-return) rather than left unmapped, per `04-RESEARCH.md`'s own `Code Examples` section, which independently specifies both files' target shape from the locked skill and this codebase's conventions.

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/db/`, `backend/app/market/`, `backend/tests/api/`, `backend/tests/conftest.py`, `backend/pyproject.toml`, `.claude/skills/cerebras/`, `frontend/lib/`, `frontend/components/`, `frontend/__tests__/`, `frontend/app/globals.css`
**Files scanned:** 19 (read in full or targeted excerpt this session; full list in Sources below)
**Pattern extraction date:** 2026-09-21

**Sources read this session (all VERIFIED, git-tracked, current `main`):**
`backend/app/api/watchlist.py`, `backend/app/api/portfolio.py`, `backend/app/db/repository.py`, `backend/app/db/schema.py`, `backend/app/db/__init__.py`, `backend/app/main.py`, `backend/app/market/ticker.py`, `backend/pyproject.toml`, `backend/tests/api/conftest.py`, `backend/tests/api/test_watchlist.py` (excerpt), `.claude/skills/cerebras/SKILL.md`, `frontend/lib/api.ts`, `frontend/lib/types.ts`, `frontend/lib/hooks.ts`, `frontend/components/TradeBar.tsx`, `frontend/components/Watchlist.tsx`, `frontend/components/Header.tsx`, `frontend/__tests__/TradeBar.test.tsx`, `frontend/app/globals.css` (excerpt), `.planning/phases/04-ai-copilot/04-CONTEXT.md`, `.planning/phases/04-ai-copilot/04-RESEARCH.md`, `.planning/phases/04-ai-copilot/04-UI-SPEC.md` (excerpt).

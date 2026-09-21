"""Chat REST route.

`POST /api/chat` — CHAT-01..05. Mirrors `backend/app/api/watchlist.py`'s
router-factory, request-model, and blocking-call-via-`asyncio.to_thread`
shape. The route answers with a grounded conversational reply, dispatches
any proposed trades/watchlist changes through the exact Phase 2/3 execution
paths (no second, looser route), and persists both turns.
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.portfolio import build_portfolio
from app.api.watchlist import build_watchlist
from app.db import (
    add_watchlist_ticker,
    execute_trade,
    get_chat_history,
    get_recent_chat_messages,
    insert_chat_message,
    remove_watchlist_ticker,
)
from app.llm import TradeAction, WatchlistAction, get_chat_response
from app.llm.prompts import HISTORY_LIMIT, render_portfolio_context
from app.market import PriceCache, is_valid_ticker_format, normalize_ticker

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    """Request body for `POST /api/chat`."""

    message: str


MAX_MESSAGE_CHARS = 4000


async def _execute_trade_action(trade: TradeAction, price_cache: PriceCache) -> dict:
    """Dispatch one model-proposed trade through the real trade path.

    Returns a dict matching `ChatTradeAction` in `frontend/lib/types.ts`
    exactly: `ticker`, `side`, `quantity`, `status`, `price`, `error` — six
    keys, always present. Calls `execute_trade` with the identical argument
    order `post_trade_route` uses (`price_cache, ticker, side, quantity`);
    argument order is the documented way this goes wrong. A `ValueError`
    from the repository (off-watchlist, no live price, insufficient cash, an
    over-sell) never propagates out of this function — it becomes a failed
    action instead, so one rejected action never aborts the rest of the
    turn's dispatch loop.
    """
    ticker = normalize_ticker(trade.ticker)
    try:
        result = await asyncio.to_thread(
            execute_trade, price_cache, ticker, trade.side, trade.quantity
        )
    except ValueError as exc:
        return {
            "ticker": ticker,
            "side": trade.side,
            "quantity": trade.quantity,
            "status": "failed",
            "price": None,
            "error": str(exc),
        }
    return {
        "ticker": ticker,
        "side": trade.side,
        "quantity": trade.quantity,
        "status": "executed",
        "price": result["price"],
        "error": None,
    }


async def _execute_watchlist_action(change: WatchlistAction, request: Request) -> dict:
    """Dispatch one model-proposed watchlist mutation through the real path.

    Returns a dict matching `ChatWatchlistAction` in `frontend/lib/types.ts`
    exactly: `ticker`, `action`, `status`, `error` — four keys, no `price`.
    Reproduces `post_watchlist_route`/`delete_watchlist_route`'s normalize ->
    format-validate -> persist -> notify ordering step for step, so a chat-
    initiated change goes through the exact same gates a manual one does.

    An add's `is_valid_ticker_format` failure returns a failed action before
    any write — a real model response is not schema-constrained to a valid
    ticker (`app/llm/schema.py` deliberately carries no ticker-format
    validator), so this is a real reachable path, not defensive dead code.
    A remove's `ValueError` is the D-01/D-02 held-position guard inside
    `remove_watchlist_ticker` surfacing here unchanged. Both branches wrap
    the market-source notify in its own `try`/`except Exception` with
    `logger.exception` — a notify failure must not downgrade an
    already-committed write to a failed action, the same reasoning
    `post_watchlist_route`'s own comment gives for the identical shape.
    """
    ticker = normalize_ticker(change.ticker)
    if change.action == "add":
        if not is_valid_ticker_format(ticker):
            return {
                "ticker": ticker,
                "action": "add",
                "status": "failed",
                "error": f"{ticker} isn't a valid ticker — use 1-5 letters or numbers.",
            }
        try:
            await asyncio.to_thread(add_watchlist_ticker, ticker)
        except ValueError as exc:
            return {"ticker": ticker, "action": "add", "status": "failed", "error": str(exc)}
        try:
            await request.app.state.market_source.add_ticker(ticker)
        except Exception:
            logger.exception("Failed to notify market source of new ticker %s", ticker)
        return {"ticker": ticker, "action": "add", "status": "executed", "error": None}

    # change.action == "remove"
    try:
        removed = await asyncio.to_thread(remove_watchlist_ticker, ticker)
    except ValueError as exc:
        # D-01/D-02: raised when the ticker is still held — the guard lives
        # once inside remove_watchlist_ticker, so this path and the manual
        # DELETE route can never diverge.
        return {"ticker": ticker, "action": "remove", "status": "failed", "error": str(exc)}
    if not removed:
        return {
            "ticker": ticker,
            "action": "remove",
            "status": "failed",
            "error": f"{ticker} is not on your watchlist.",
        }
    try:
        await request.app.state.market_source.remove_ticker(ticker)
    except Exception:
        logger.exception("Failed to notify market source of removed ticker %s", ticker)
    return {"ticker": ticker, "action": "remove", "status": "executed", "error": None}


def create_chat_router(price_cache: PriceCache) -> APIRouter:
    """Create the chat router with a reference to the price cache.

    Constructs a fresh `APIRouter` on every call, mirroring
    `create_watchlist_router`'s factory shape — no module-level router
    singleton, the anti-pattern `.planning/codebase/CONCERNS.md` documents
    for `backend/app/market/stream.py`.
    """
    router = APIRouter(prefix="/api", tags=["chat"])

    @router.post("/chat")
    async def post_chat_route(body: ChatRequest, request: Request) -> JSONResponse:
        """Answer one chat message, grounded in the real portfolio/watchlist.

        Order of operations: validate the message length (before any DB
        write or model call) -> assemble portfolio/watchlist context ->
        load recent history -> persist the user turn -> call the model ->
        dispatch watchlist changes, then trades -> persist the assistant
        turn (with the enriched per-action results) -> respond.
        """
        stripped = body.message.strip()
        if not stripped:
            return JSONResponse(status_code=400, content={"error": "Message cannot be empty."})
        # len() on the decoded str counts Unicode code points, not UTF-8
        # bytes or grapheme clusters — a message of multi-byte characters is
        # judged by the same count as an ASCII one.
        if len(stripped) > MAX_MESSAGE_CHARS:
            return JSONResponse(
                status_code=400,
                content={"error": f"Message must be {MAX_MESSAGE_CHARS} characters or fewer."},
            )

        portfolio = await asyncio.to_thread(build_portfolio, price_cache)
        watchlist = await asyncio.to_thread(build_watchlist, price_cache)
        portfolio_context = render_portfolio_context(portfolio, watchlist)

        history = await asyncio.to_thread(get_recent_chat_messages, HISTORY_LIMIT)

        await asyncio.to_thread(insert_chat_message, "user", stripped, None)

        response = await asyncio.to_thread(get_chat_response, stripped, portfolio_context, history)

        # Watchlist changes must run to completion before the first trade.
        # execute_trade rejects any ticker not already on the watchlist, so
        # running trades first would fail "add PLTR and buy 10" with a
        # membership error even though the add in the same response would
        # have made it valid a moment later.
        watchlist_results = [
            await _execute_watchlist_action(change, request)
            for change in response.watchlist_changes
        ]
        trade_results = [
            await _execute_trade_action(trade, price_cache) for trade in response.trades
        ]

        response_dict = {
            "message": response.message,
            "trades": trade_results,
            "watchlist_changes": watchlist_results,
        }

        await asyncio.to_thread(
            insert_chat_message, "assistant", response.message, response_dict
        )

        return JSONResponse(status_code=200, content=response_dict)

    @router.get("/chat/history")
    async def get_chat_history_route() -> dict:
        """Return every persisted chat turn, oldest first, actions already parsed.

        Mirrors `get_portfolio_history_route`'s shape: a single
        `asyncio.to_thread` read, no pagination, one top-level response key.
        `actions` is parsed here (server-side) rather than left as the raw
        stored JSON string — handing the frontend a string would force it to
        double-decode and would silently break pill rendering for every
        restored assistant turn. FastAPI matches routes by method, so this
        GET and `POST /api/chat` above share the same `/api/chat` prefix
        with no ordering hazard.
        """
        rows = await asyncio.to_thread(get_chat_history)
        messages = [
            {
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "actions": json.loads(row["actions"]) if row["actions"] else None,
                "created_at": row["created_at"],
            }
            for row in rows
        ]
        return {"messages": messages}

    return router

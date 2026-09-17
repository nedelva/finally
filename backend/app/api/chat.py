"""Chat route: POST /api/chat.

Loads portfolio context and recent history from the DB, calls the LLM module for a proposed
response, executes any proposed trades/watchlist changes through the exact same code paths as
the manual `/api/portfolio/trade` and `/api/watchlist` endpoints (`execute_trade`,
`add_to_watchlist`, `remove_from_watchlist`), persists both turns, and returns the enriched
response per `planning/API_CONTRACT.md`.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.portfolio import build_portfolio, execute_trade
from app.api.watchlist import add_to_watchlist, build_watchlist, remove_from_watchlist
from app.db import get_recent_chat_messages, insert_chat_message
from app.llm import ChatResponse, get_chat_response
from app.market import MarketDataSource, PriceCache

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

HISTORY_LIMIT = 10
_FALLBACK_MESSAGE = (
    "Sorry, I'm having trouble reaching the AI assistant right now. Please try again shortly."
)


class ChatRequest(BaseModel):
    message: str


async def _execute_trade_action(trade, price_cache: PriceCache) -> dict[str, Any]:
    result = execute_trade(trade.ticker, trade.side, trade.quantity, price_cache)
    return {
        "ticker": trade.ticker.upper(),
        "side": trade.side,
        "quantity": trade.quantity,
        "status": "executed" if result["success"] else "failed",
        "price": result["trade"]["price"] if result["success"] else None,
        "error": result["error"],
    }


async def _execute_watchlist_action(
    change, market_data_source: MarketDataSource
) -> dict[str, Any]:
    if change.action == "add":
        result = await add_to_watchlist(change.ticker, market_data_source)
    else:
        result = await remove_from_watchlist(change.ticker, market_data_source)

    return {
        "ticker": change.ticker.upper(),
        "action": change.action,
        "status": "executed" if result["success"] else "failed",
        "error": result["error"],
    }


@router.post("/api/chat")
async def post_chat(body: ChatRequest, request: Request) -> dict[str, Any]:
    price_cache: PriceCache = request.app.state.price_cache
    market_data_source: MarketDataSource = request.app.state.market_data_source

    portfolio_context = build_portfolio(price_cache)
    watchlist_context = build_watchlist(price_cache)
    portfolio_context["watchlist"] = watchlist_context["watchlist"]

    history = [
        {"role": m["role"], "content": m["content"]}
        for m in get_recent_chat_messages(limit=HISTORY_LIMIT)
    ]

    insert_chat_message("user", body.message, None)

    try:
        llm_response = get_chat_response(body.message, portfolio_context, history)
    except Exception:
        # `get_chat_response`'s own docstring says a malformed LLM response is caught internally
        # and turned into a benign ChatResponse -- only genuinely unexpected failures (e.g. a
        # network error reaching OpenRouter) propagate here. The user's message is already
        # persisted; respond gracefully with no actions rather than a bare 500.
        logger.exception("get_chat_response failed")
        llm_response = ChatResponse(message=_FALLBACK_MESSAGE, trades=[], watchlist_changes=[])

    trades = [
        await _execute_trade_action(trade, price_cache) for trade in llm_response.trades
    ]
    watchlist_changes = [
        await _execute_watchlist_action(change, market_data_source)
        for change in llm_response.watchlist_changes
    ]

    response = {
        "message": llm_response.message,
        "trades": trades,
        "watchlist_changes": watchlist_changes,
    }

    insert_chat_message("assistant", llm_response.message, json.dumps(response))

    return response

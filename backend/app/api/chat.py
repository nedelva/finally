"""Chat REST route.

`POST /api/chat` — CHAT-01/CHAT-02. Mirrors `backend/app/api/watchlist.py`'s
router-factory, request-model, and blocking-call-via-`asyncio.to_thread`
shape. In this plan the route answers with a grounded conversational reply
and persists both turns; no trade or watchlist action executes yet (04-02).
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.portfolio import build_portfolio
from app.api.watchlist import build_watchlist
from app.db import get_recent_chat_messages, insert_chat_message
from app.llm import get_chat_response
from app.llm.prompts import HISTORY_LIMIT, render_portfolio_context
from app.market import PriceCache

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    """Request body for `POST /api/chat`."""

    message: str


MAX_MESSAGE_CHARS = 4000


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
        persist the assistant turn -> respond. `request` is unused in this
        plan but is declared now so the handler signature does not churn
        once 04-02 needs `request.app.state.market_source` for action
        dispatch. `request` itself is unused in this plan's body.
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

        # The dispatch loop that fills these from response.trades /
        # response.watchlist_changes lands in 04-02 — always empty here.
        response_dict = {"message": response.message, "trades": [], "watchlist_changes": []}

        await asyncio.to_thread(
            insert_chat_message, "assistant", response.message, response_dict
        )

        return JSONResponse(status_code=200, content=response_dict)

    return router

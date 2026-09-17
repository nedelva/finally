"""Pydantic models for the LLM chat structured-output contract.

This is the LLM's own proposal schema -- deliberately simpler than the enriched
``{status, price, error}`` shape documented for ``POST /api/chat`` in
``planning/API_CONTRACT.md``. Status/price/error only exist once
``backend-api-engineer`` has attempted to execute each action against the DB and
market data source; this module never touches either, so it can only describe what
the LLM *wants* to happen, not what actually happened.
"""

from typing import Literal

from pydantic import BaseModel, Field


class TradeAction(BaseModel):
    """A single trade the LLM proposes to execute on the user's behalf."""

    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


class WatchlistAction(BaseModel):
    """A single watchlist modification the LLM proposes."""

    ticker: str
    action: Literal["add", "remove"]


class ChatResponse(BaseModel):
    """The complete structured response requested from the LLM.

    ``trades`` and ``watchlist_changes`` default to empty lists (never omitted)
    so callers can always iterate them without a None check.
    """

    message: str
    trades: list[TradeAction] = Field(default_factory=list)
    watchlist_changes: list[WatchlistAction] = Field(default_factory=list)

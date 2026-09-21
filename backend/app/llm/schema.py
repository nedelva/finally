"""Pydantic models for the LLM's raw structured proposal.

Mirrors `backend/app/api/watchlist.py`'s `WatchlistAddRequest` convention —
a plain `BaseModel` per request/response shape. `TradeAction` and
`WatchlistAction` deliberately carry no ticker-format validator: a bad
ticker from the model must fail gracefully at dispatch time (04-02), not
blow up schema validation here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TradeAction(BaseModel):
    """One trade the LLM proposes executing."""

    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


class WatchlistAction(BaseModel):
    """One watchlist mutation the LLM proposes executing."""

    ticker: str
    action: Literal["add", "remove"]


class ChatResponse(BaseModel):
    """The LLM's own raw proposal for one chat turn.

    This is NOT the enriched `{status, price, error}` per-action shape the
    HTTP route returns — that enrichment only exists once each action has
    actually been attempted against the DB/market data source. The
    frontend's own `ChatResponse` in `frontend/lib/types.ts` is the
    enriched one; do not conflate the two.
    """

    message: str
    trades: list[TradeAction] = Field(default_factory=list)
    watchlist_changes: list[WatchlistAction] = Field(default_factory=list)

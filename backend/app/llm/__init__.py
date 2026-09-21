"""LLM subsystem for FinAlly.

Public API:
    get_chat_response - Get the assistant's structured reply for one chat turn
    ChatResponse      - The LLM's raw proposal (message, trades, watchlist_changes)
    TradeAction       - One proposed trade
    WatchlistAction   - One proposed watchlist mutation

Callers import from `app.llm`, never from `app.llm.client` or
`app.llm.schema` directly, mirroring the `app.db`/`app.market` barrel
convention.
"""

from .client import get_chat_response
from .schema import ChatResponse, TradeAction, WatchlistAction

__all__ = [
    "get_chat_response",
    "ChatResponse",
    "TradeAction",
    "WatchlistAction",
]

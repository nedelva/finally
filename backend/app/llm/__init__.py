"""LLM chat module for FinAlly.

Public API:
    get_chat_response  - entrypoint: user message + context + history -> ChatResponse
    ChatResponse        - the LLM's structured proposal (message, trades, watchlist_changes)
    TradeAction          - a single proposed trade
    WatchlistAction       - a single proposed watchlist change
"""

from .client import get_chat_response
from .schema import ChatResponse, TradeAction, WatchlistAction

__all__ = [
    "get_chat_response",
    "ChatResponse",
    "TradeAction",
    "WatchlistAction",
]

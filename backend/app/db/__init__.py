"""Database module for FinAlly.

Public API:
    init_db - Idempotent lazy schema creation + seed data
    Everything exported from `repository` (get_cash_balance, apply_buy, insert_trade, ...)
"""

from .init import init_db
from .repository import (
    add_watchlist_ticker,
    apply_buy,
    apply_sell,
    get_cash_balance,
    get_positions,
    get_recent_chat_messages,
    get_snapshots,
    get_watchlist,
    insert_chat_message,
    insert_snapshot,
    insert_trade,
    remove_watchlist_ticker,
    set_cash_balance,
)

__all__ = [
    "init_db",
    "get_cash_balance",
    "set_cash_balance",
    "get_watchlist",
    "add_watchlist_ticker",
    "remove_watchlist_ticker",
    "get_positions",
    "apply_buy",
    "apply_sell",
    "insert_trade",
    "insert_snapshot",
    "get_snapshots",
    "insert_chat_message",
    "get_recent_chat_messages",
]

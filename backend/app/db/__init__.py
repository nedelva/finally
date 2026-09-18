"""Persistence subsystem for FinAlly.

Public API:
    init_db             - Idempotent lazy schema creation + default-data seeding
    get_watchlist       - Read the current user's watchlist rows
    add_watchlist_ticker - Insert a new watchlist row, raising ValueError on a duplicate
"""

from .init import init_db
from .repository import add_watchlist_ticker, get_watchlist

__all__ = [
    "init_db",
    "get_watchlist",
    "add_watchlist_ticker",
]

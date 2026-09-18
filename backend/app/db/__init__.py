"""Persistence subsystem for FinAlly.

Public API:
    init_db                - Idempotent lazy schema creation + default-data seeding
    get_watchlist           - Read the current user's watchlist rows
    add_watchlist_ticker    - Insert a new watchlist row, raising ValueError on a duplicate
    remove_watchlist_ticker - Delete a watchlist row, returning whether one was deleted
"""

from .init import init_db
from .repository import add_watchlist_ticker, get_watchlist, remove_watchlist_ticker

__all__ = [
    "init_db",
    "get_watchlist",
    "add_watchlist_ticker",
    "remove_watchlist_ticker",
]

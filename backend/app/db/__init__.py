"""Persistence subsystem for FinAlly.

Public API:
    init_db       - Idempotent lazy schema creation + default-data seeding
    get_watchlist - Read the current user's watchlist rows
"""

from .init import init_db
from .repository import get_watchlist

__all__ = [
    "init_db",
    "get_watchlist",
]

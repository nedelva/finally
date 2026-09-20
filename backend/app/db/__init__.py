"""Persistence subsystem for FinAlly.

Public API:
    init_db                - Idempotent lazy schema creation + default-data seeding
    get_watchlist           - Read the current user's watchlist rows
    add_watchlist_ticker    - Insert a new watchlist row, raising ValueError on a duplicate
    remove_watchlist_ticker - Delete a watchlist row, returning whether one was deleted
    get_cash_balance        - Read the current user's cash balance
    get_positions           - Read the current user's positions, ordered by ticker
    execute_trade           - Execute a market-order trade atomically, raising ValueError on rejection
    total_portfolio_value   - Value cash + positions on an already-open connection (D-03-aware)
"""

from .init import init_db
from .repository import (
    add_watchlist_ticker,
    execute_trade,
    get_cash_balance,
    get_positions,
    get_watchlist,
    remove_watchlist_ticker,
    total_portfolio_value,
)

__all__ = [
    "init_db",
    "get_watchlist",
    "add_watchlist_ticker",
    "remove_watchlist_ticker",
    "get_cash_balance",
    "get_positions",
    "execute_trade",
    "total_portfolio_value",
]

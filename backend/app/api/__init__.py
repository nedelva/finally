"""REST API subsystem for FinAlly.

Public API:
    create_watchlist_router - FastAPI router factory for /api/watchlist
"""

from .watchlist import create_watchlist_router

__all__ = [
    "create_watchlist_router",
]

"""REST API subsystem for FinAlly.

Public API:
    create_watchlist_router - FastAPI router factory for /api/watchlist
    create_portfolio_router - FastAPI router factory for /api/portfolio
"""

from .portfolio import create_portfolio_router
from .watchlist import create_watchlist_router

__all__ = [
    "create_watchlist_router",
    "create_portfolio_router",
]

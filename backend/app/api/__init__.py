"""REST API routers for FinAlly.

Public API:
    health_router      - GET /api/health
    portfolio_router    - GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history
    watchlist_router    - GET/POST /api/watchlist, DELETE /api/watchlist/{ticker}
    chat_router         - POST /api/chat
"""

from .chat import router as chat_router
from .health import router as health_router
from .portfolio import router as portfolio_router
from .watchlist import router as watchlist_router

__all__ = [
    "health_router",
    "portfolio_router",
    "watchlist_router",
    "chat_router",
]

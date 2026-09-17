"""Market data subsystem for FinAlly.

Public API:
    PriceUpdate         - Immutable price snapshot dataclass
    PriceCache          - Thread-safe in-memory price store
    MarketDataSource    - Abstract interface for data providers
    create_market_data_source - Factory that selects simulator or Massive
    create_stream_router - FastAPI router factory for SSE endpoint
    DEFAULT_TICKERS     - The ten tickers the app seeds with by default
"""

from .cache import PriceCache
from .factory import create_market_data_source
from .interface import MarketDataSource
from .models import PriceUpdate
from .seed_prices import DEFAULT_TICKERS
from .stream import create_stream_router

__all__ = [
    "PriceUpdate",
    "PriceCache",
    "MarketDataSource",
    "create_market_data_source",
    "create_stream_router",
    "DEFAULT_TICKERS",
]

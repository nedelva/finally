"""Market data subsystem for FinAlly.

Public API:
    PriceUpdate         - Immutable price snapshot dataclass
    PriceCache          - Thread-safe in-memory price store
    MarketDataSource    - Abstract interface for data providers
    create_market_data_source - Factory that selects simulator or Massive
    create_stream_router - FastAPI router factory for SSE endpoint
    DEFAULT_TICKERS     - The ten tickers the app seeds with by default
    normalize_ticker     - Uppercase + strip a raw ticker string
    is_valid_ticker_format - 1-5 alphanumeric format check
"""

from .cache import PriceCache
from .factory import create_market_data_source
from .interface import MarketDataSource
from .models import PriceUpdate
from .seed_prices import DEFAULT_TICKERS
from .stream import create_stream_router
from .ticker import is_valid_ticker_format, normalize_ticker

__all__ = [
    "PriceUpdate",
    "PriceCache",
    "MarketDataSource",
    "create_market_data_source",
    "create_stream_router",
    "DEFAULT_TICKERS",
    "normalize_ticker",
    "is_valid_ticker_format",
]

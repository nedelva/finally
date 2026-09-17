"""Shared fixtures for `tests/api`.

Each test gets its own temp SQLite file (via the `DB_PATH` env var), a fresh in-memory
`PriceCache`, and a `FakeMarketDataSource` test double so watchlist add/remove behavior can be
asserted without depending on the real GBM simulator's timing or randomness. The FastAPI app
under test mounts the real routers from `app.api` -- only the DB path and the market data source
are swapped for test doubles, so route logic is exercised exactly as it runs in production.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import chat_router, health_router, portfolio_router, watchlist_router
from app.db import init_db
from app.market import MarketDataSource, PriceCache


class FakeMarketDataSource(MarketDataSource):
    """In-memory test double that records add/remove calls instead of streaming real prices."""

    def __init__(self) -> None:
        self.tickers: list[str] = []
        self.added: list[str] = []
        self.removed: list[str] = []
        self.started_with: list[str] = []
        self.stopped = False

    async def start(self, tickers: list[str]) -> None:
        self.tickers = list(tickers)
        self.started_with = list(tickers)

    async def stop(self) -> None:
        self.stopped = True

    async def add_ticker(self, ticker: str) -> None:
        if ticker not in self.tickers:
            self.tickers.append(ticker)
        self.added.append(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        if ticker in self.tickers:
            self.tickers.remove(ticker)
        self.removed.append(ticker)

    def get_tickers(self) -> list[str]:
        return list(self.tickers)


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Point the DB module at a fresh temp file and initialize it (schema + seed data)."""
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("LLM_MOCK", "true")
    init_db()
    return db_path


@pytest.fixture
def price_cache() -> PriceCache:
    return PriceCache()


@pytest.fixture
def market_source() -> FakeMarketDataSource:
    return FakeMarketDataSource()


@pytest.fixture
def app(temp_db, price_cache, market_source) -> FastAPI:
    application = FastAPI()
    application.state.price_cache = price_cache
    application.state.market_data_source = market_source
    application.include_router(health_router)
    application.include_router(portfolio_router)
    application.include_router(watchlist_router)
    application.include_router(chat_router)
    return application


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)

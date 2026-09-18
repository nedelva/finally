"""Fixtures for the `app.api` test package."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.market import MarketDataSource


class FakeMarketDataSource(MarketDataSource):
    """Recording test double for `MarketDataSource`.

    A hand-written fake rather than a `MagicMock` because tests need to
    assert *which* ticker was passed to `add_ticker`/`remove_ticker`, which a
    recording fake makes more readable than mock call-arg inspection.
    """

    def __init__(self) -> None:
        self.started: list[str] = []
        self.added: list[str] = []
        self.removed: list[str] = []
        self.stopped = False

    async def start(self, tickers: list[str]) -> None:
        self.started = list(tickers)

    async def stop(self) -> None:
        self.stopped = True

    async def add_ticker(self, ticker: str) -> None:
        self.added.append(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        self.removed.append(ticker)

    def get_tickers(self) -> list[str]:
        return [*self.started, *self.added]


@pytest.fixture
def fake_market_source() -> FakeMarketDataSource:
    """A fresh recording FakeMarketDataSource per test."""
    return FakeMarketDataSource()


@pytest.fixture
def client(tmp_path, fake_market_source) -> Iterator[TestClient]:
    """A TestClient wrapping a real app, backed by a fake market source.

    `app.state.price_cache`/`app.state.market_source` only exist once the
    ASGI lifespan protocol has actually run, so this fixture enters the
    `with TestClient(app) as ...:` context before yielding — tests that need
    to seed `client.app.state.price_cache` must do so after receiving this
    fixture, which is always past that point.
    """
    app = create_app(static_dir=tmp_path, market_source=fake_market_source)
    with TestClient(app) as test_client:
        yield test_client

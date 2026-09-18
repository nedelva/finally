"""Tests for `GET /api/watchlist`."""

from app.market import DEFAULT_TICKERS

EXPECTED_ENTRY_KEYS = {
    "ticker",
    "added_at",
    "price",
    "previous_price",
    "change",
    "change_percent",
    "direction",
}


class TestGetWatchlist:
    """`GET /api/watchlist` against a freshly-seeded database."""

    def test_get_returns_ten_entries_with_expected_keys(self, client):
        response = client.get("/api/watchlist")

        assert response.status_code == 200
        body = response.json()
        entries = body["watchlist"]
        assert len(entries) == 10
        assert {entry["ticker"] for entry in entries} == set(DEFAULT_TICKERS)
        for entry in entries:
            assert set(entry.keys()) == EXPECTED_ENTRY_KEYS

    def test_get_reports_null_price_for_uncached_ticker(self, client):
        """A ticker the FakeMarketDataSource never ticks reports a null price,
        not a synthesized number."""
        response = client.get("/api/watchlist")

        assert response.status_code == 200
        entries = response.json()["watchlist"]
        for entry in entries:
            assert entry["price"] is None
            assert entry["previous_price"] is None
            assert entry["change"] is None
            assert entry["change_percent"] is None
            assert entry["direction"] == "flat"

    def test_get_reports_live_price_when_cache_has_entry(self, client):
        """A ticker with a PriceCache entry reports the cache's real values."""
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.get("/api/watchlist")

        assert response.status_code == 200
        entries = {entry["ticker"]: entry for entry in response.json()["watchlist"]}
        assert entries["AAPL"]["price"] == 190.5
        assert entries["AAPL"]["direction"] == "flat"  # first tick: previous == price


class TestCreateAppMarketSourceInjection:
    """`create_app(market_source=...)` uses the injected double, not a real source."""

    def test_injected_fake_receives_database_tickers(self, client, fake_market_source):
        """The FakeMarketDataSource (not a real simulator/Massive client)
        received start() with the database-seeded tickers — proving
        create_app(market_source=...) never constructed a real source."""
        assert set(fake_market_source.started) == set(DEFAULT_TICKERS)

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


class TestAddWatchlist:
    """`POST /api/watchlist` — validate, persist, and notify the market source."""

    def test_add_new_ticker_returns_201_with_expected_body(self, client, fake_market_source):
        response = client.post("/api/watchlist", json={"ticker": "PYPL"})

        assert response.status_code == 201
        body = response.json()
        assert body["ticker"] == "PYPL"
        assert "added_at" in body

    def test_add_new_ticker_notifies_market_source_exactly_once(
        self, client, fake_market_source
    ):
        client.post("/api/watchlist", json={"ticker": "PYPL"})

        assert fake_market_source.added == ["PYPL"]

    def test_add_new_ticker_appears_in_a_subsequent_get(self, client):
        client.post("/api/watchlist", json={"ticker": "PYPL"})

        tickers = {entry["ticker"] for entry in client.get("/api/watchlist").json()["watchlist"]}
        assert "PYPL" in tickers

    def test_add_lowercase_ticker_normalizes_to_uppercase(self, client):
        response = client.post("/api/watchlist", json={"ticker": "pypl"})

        assert response.status_code == 201
        assert response.json()["ticker"] == "PYPL"

    def test_add_whitespace_padded_ticker_normalizes(self, client):
        response = client.post("/api/watchlist", json={"ticker": "  PYPL  "})

        assert response.status_code == 201
        assert response.json()["ticker"] == "PYPL"

    def test_add_duplicate_ticker_returns_409(self, client, fake_market_source):
        # AAPL is one of the ten seeded default tickers.
        response = client.post("/api/watchlist", json={"ticker": "AAPL"})

        assert response.status_code == 409
        assert "error" in response.json()

    def test_add_duplicate_ticker_does_not_duplicate_the_row(self, client):
        client.post("/api/watchlist", json={"ticker": "AAPL"})

        entries = client.get("/api/watchlist").json()["watchlist"]
        aapl_rows = [e for e in entries if e["ticker"] == "AAPL"]
        assert len(aapl_rows) == 1

    def test_add_duplicate_ticker_does_not_notify_market_source(
        self, client, fake_market_source
    ):
        fake_market_source.added.clear()
        client.post("/api/watchlist", json={"ticker": "AAPL"})

        assert fake_market_source.added == []

    def test_add_malformed_over_length_ticker_returns_400(self, client):
        response = client.post("/api/watchlist", json={"ticker": "TOOLONG"})

        assert response.status_code == 400
        assert "error" in response.json()

    def test_add_malformed_non_alphanumeric_ticker_returns_400(self, client):
        response = client.post("/api/watchlist", json={"ticker": "AA$PL"})

        assert response.status_code == 400
        assert "error" in response.json()

    def test_add_malformed_empty_ticker_returns_400(self, client):
        response = client.post("/api/watchlist", json={"ticker": ""})

        assert response.status_code == 400
        assert "error" in response.json()

    def test_add_malformed_whitespace_only_ticker_returns_400(self, client):
        response = client.post("/api/watchlist", json={"ticker": "   "})

        assert response.status_code == 400
        assert "error" in response.json()

    def test_add_malformed_ticker_does_not_write_a_row(self, client):
        before = len(client.get("/api/watchlist").json()["watchlist"])
        client.post("/api/watchlist", json={"ticker": "TOOLONG"})
        after = len(client.get("/api/watchlist").json()["watchlist"])

        assert after == before

    def test_add_malformed_ticker_does_not_notify_market_source(
        self, client, fake_market_source
    ):
        fake_market_source.added.clear()
        client.post("/api/watchlist", json={"ticker": "AA$PL"})

        assert fake_market_source.added == []


class TestRemoveWatchlist:
    """`DELETE /api/watchlist/{ticker}` — remove the row and stop the ticker streaming."""

    def test_remove_present_ticker_returns_204_with_empty_body(self, client):
        # AAPL is one of the ten seeded default tickers.
        response = client.delete("/api/watchlist/AAPL")

        assert response.status_code == 204
        assert response.content == b""

    def test_remove_present_ticker_disappears_from_a_subsequent_get(self, client):
        client.delete("/api/watchlist/AAPL")

        tickers = {entry["ticker"] for entry in client.get("/api/watchlist").json()["watchlist"]}
        assert "AAPL" not in tickers

    def test_remove_notifies_market_source_with_the_normalized_ticker_exactly_once(
        self, client, fake_market_source
    ):
        client.delete("/api/watchlist/AAPL")

        assert fake_market_source.removed == ["AAPL"]

    def test_remove_lowercase_path_segment_removes_the_uppercase_ticker(
        self, client, fake_market_source
    ):
        response = client.delete("/api/watchlist/aapl")

        assert response.status_code == 204
        assert fake_market_source.removed == ["AAPL"]

    def test_remove_absent_ticker_returns_404_with_an_error_key(self, client):
        response = client.delete("/api/watchlist/ZZZZ")

        assert response.status_code == 404
        assert "error" in response.json()

    def test_remove_absent_ticker_does_not_change_row_count(self, client):
        before = len(client.get("/api/watchlist").json()["watchlist"])
        client.delete("/api/watchlist/ZZZZ")
        after = len(client.get("/api/watchlist").json()["watchlist"])

        assert after == before

    def test_remove_absent_ticker_does_not_notify_market_source(
        self, client, fake_market_source
    ):
        client.delete("/api/watchlist/ZZZZ")

        assert fake_market_source.removed == []

    def test_remove_twice_returns_404_and_changes_nothing_on_the_second_call(self, client):
        first = client.delete("/api/watchlist/AAPL")
        before = client.get("/api/watchlist").json()["watchlist"]

        second = client.delete("/api/watchlist/AAPL")
        after = client.get("/api/watchlist").json()["watchlist"]

        assert first.status_code == 204
        assert second.status_code == 404
        assert before == after

    def test_remove_does_not_touch_positions_trades_snapshots_or_chat_messages(self, client):
        from app.db.connection import get_connection

        client.delete("/api/watchlist/AAPL")

        conn = get_connection()
        try:
            for table in ("positions", "trades", "portfolio_snapshots", "chat_messages"):
                count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                assert count == 0, f"expected 0 rows in {table}, found {count}"
        finally:
            conn.close()


class TestMarketSourceNotifyFailure:
    """WR-01: a market-source notify failure must not surface as an
    unhandled 500 for a DB mutation that already committed."""

    def test_add_still_returns_201_when_market_source_notify_raises(
        self, client_with_failing_notify
    ):
        response = client_with_failing_notify.post("/api/watchlist", json={"ticker": "PYPL"})

        assert response.status_code == 201
        assert response.json()["ticker"] == "PYPL"

    def test_add_still_persists_the_row_when_market_source_notify_raises(
        self, client_with_failing_notify
    ):
        client_with_failing_notify.post("/api/watchlist", json={"ticker": "PYPL"})

        tickers = {
            entry["ticker"]
            for entry in client_with_failing_notify.get("/api/watchlist").json()["watchlist"]
        }
        assert "PYPL" in tickers

    def test_remove_still_returns_204_when_market_source_notify_raises(
        self, client_with_failing_notify
    ):
        # AAPL is one of the ten seeded default tickers.
        response = client_with_failing_notify.delete("/api/watchlist/AAPL")

        assert response.status_code == 204

    def test_remove_still_deletes_the_row_when_market_source_notify_raises(
        self, client_with_failing_notify
    ):
        client_with_failing_notify.delete("/api/watchlist/AAPL")

        tickers = {
            entry["ticker"]
            for entry in client_with_failing_notify.get("/api/watchlist").json()["watchlist"]
        }
        assert "AAPL" not in tickers

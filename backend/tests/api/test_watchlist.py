"""Tests for GET/POST /api/watchlist and DELETE /api/watchlist/{ticker}."""

DEFAULT_TICKERS = {"AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"}


def test_get_watchlist_default_seed(client):
    response = client.get("/api/watchlist")
    assert response.status_code == 200
    body = response.json()
    tickers = {entry["ticker"] for entry in body["watchlist"]}
    assert tickers == DEFAULT_TICKERS
    assert len(body["watchlist"]) == 10


def test_get_watchlist_no_price_yet_is_null_with_flat_direction(client):
    response = client.get("/api/watchlist")
    entry = response.json()["watchlist"][0]
    assert entry["price"] is None
    assert entry["previous_price"] is None
    assert entry["change"] is None
    assert entry["change_percent"] is None
    assert entry["direction"] == "flat"


def test_get_watchlist_with_live_price(client, price_cache):
    price_cache.update("AAPL", 190.50)
    response = client.get("/api/watchlist")
    entry = next(e for e in response.json()["watchlist"] if e["ticker"] == "AAPL")
    assert entry["price"] == 190.50
    assert entry["direction"] == "flat"  # first update: previous == current


def test_add_watchlist_ticker_success(client, market_source):
    response = client.post("/api/watchlist", json={"ticker": "pypl"})
    assert response.status_code == 201
    body = response.json()
    assert body["ticker"] == "PYPL"
    assert "added_at" in body

    # Notified the market data source so it starts streaming the new ticker.
    assert "PYPL" in market_source.added
    assert "PYPL" in market_source.get_tickers()

    watchlist_tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
    assert "PYPL" in watchlist_tickers


def test_add_watchlist_duplicate_returns_409(client):
    response = client.post("/api/watchlist", json={"ticker": "AAPL"})
    assert response.status_code == 409
    body = response.json()
    assert body["error"] == "AAPL is already on the watchlist"


def test_add_watchlist_duplicate_does_not_notify_market_source(client, market_source):
    client.post("/api/watchlist", json={"ticker": "AAPL"})
    assert "AAPL" not in market_source.added


def test_remove_watchlist_ticker_success(client, market_source):
    response = client.delete("/api/watchlist/AAPL")
    assert response.status_code == 204
    assert response.content == b""

    assert "AAPL" in market_source.removed

    watchlist_tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
    assert "AAPL" not in watchlist_tickers


def test_remove_watchlist_ticker_not_found_returns_404(client):
    response = client.delete("/api/watchlist/ZZZZ")
    assert response.status_code == 404
    assert response.json() == {"error": "ZZZZ not in watchlist"}


def test_remove_watchlist_not_found_does_not_notify_market_source(client, market_source):
    client.delete("/api/watchlist/ZZZZ")
    assert market_source.removed == []


def test_remove_watchlist_lowercase_ticker_is_uppercased(client, market_source):
    response = client.delete("/api/watchlist/aapl")
    assert response.status_code == 204
    assert "AAPL" in market_source.removed


def test_remove_watchlist_ticker_still_held_keeps_it_in_price_cache(
    client, market_source, price_cache
):
    # Buy AAPL, then remove it from the watchlist -- the position must still be priceable
    # (and sellable), so the market data source must NOT drop it from the cache.
    price_cache.update("AAPL", 190.50)
    buy = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1}
    )
    assert buy.status_code == 200

    response = client.delete("/api/watchlist/AAPL")
    assert response.status_code == 204

    # DB watchlist row is gone either way...
    watchlist_tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
    assert "AAPL" not in watchlist_tickers

    # ...but the market data source was NOT told to stop tracking it, so the price cache still
    # has it and the position can still be sold.
    assert "AAPL" not in market_source.removed

    sell = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1}
    )
    assert sell.status_code == 200

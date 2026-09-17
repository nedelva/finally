"""Tests for GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history."""


def test_get_portfolio_empty_shape(client):
    response = client.get("/api/portfolio")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "cash_balance": 10000.0,
        "positions": [],
        "total_value": 10000.0,
        "total_unrealized_pnl": 0.0,
    }


def test_get_portfolio_position_with_no_live_price_falls_back_to_avg_cost(client, price_cache):
    # Buy while a price is live, then simulate the price disappearing from the cache
    # (e.g. removed from watchlist) -- GET /api/portfolio must not 500.
    price_cache.update("AAPL", 100.0)
    buy = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 5}
    )
    assert buy.status_code == 200

    price_cache.remove("AAPL")
    response = client.get("/api/portfolio")
    assert response.status_code == 200
    body = response.json()
    position = body["positions"][0]
    assert position["current_price"] == 100.0  # falls back to avg_cost
    assert position["unrealized_pnl"] == 0.0
    assert position["unrealized_pnl_percent"] == 0.0


def test_buy_success_deducts_cash_and_creates_position(client, price_cache):
    price_cache.update("AAPL", 190.50)

    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["trade"]["ticker"] == "AAPL"
    assert body["trade"]["side"] == "buy"
    assert body["trade"]["quantity"] == 10
    assert body["trade"]["price"] == 190.50

    portfolio = body["portfolio"]
    assert portfolio["cash_balance"] == 10000.0 - 1905.0
    assert len(portfolio["positions"]) == 1
    position = portfolio["positions"][0]
    assert position["ticker"] == "AAPL"
    assert position["quantity"] == 10
    assert position["avg_cost"] == 190.50
    assert position["current_price"] == 190.50
    assert position["market_value"] == 1905.0
    assert position["unrealized_pnl"] == 0.0
    assert portfolio["total_value"] == 10000.0


def test_buy_weighted_average_cost_on_second_buy(client, price_cache):
    price_cache.update("AAPL", 100.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10})

    price_cache.update("AAPL", 200.0)
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10}
    )
    assert response.status_code == 200
    position = response.json()["portfolio"]["positions"][0]
    assert position["quantity"] == 20
    # (10*100 + 10*200) / 20 = 150
    assert position["avg_cost"] == 150.0


def test_buy_insufficient_cash_returns_400(client, price_cache):
    price_cache.update("AAPL", 190.50)

    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1000}
    )
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert "Insufficient cash" in body["error"]

    # No partial state: portfolio unaffected.
    portfolio = client.get("/api/portfolio").json()
    assert portfolio["cash_balance"] == 10000.0
    assert portfolio["positions"] == []


def test_trade_no_live_price_returns_400(client):
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "ZZZZ", "side": "buy", "quantity": 1}
    )
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["error"] == "No live price available for ZZZZ"


def test_trade_non_positive_quantity_returns_400(client, price_cache):
    price_cache.update("AAPL", 190.50)
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 0}
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_sell_success_credits_cash_and_updates_position(client, price_cache):
    price_cache.update("AAPL", 100.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10})

    price_cache.update("AAPL", 120.0)
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 4}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["trade"]["side"] == "sell"
    assert body["trade"]["price"] == 120.0

    portfolio = body["portfolio"]
    # Started with 10000, bought 10 @ 100 (-1000), sold 4 @ 120 (+480)
    assert portfolio["cash_balance"] == 10000.0 - 1000.0 + 480.0
    position = portfolio["positions"][0]
    assert position["quantity"] == 6
    assert position["avg_cost"] == 100.0  # sells never change avg_cost


def test_sell_full_position_removes_it(client, price_cache):
    price_cache.update("AAPL", 100.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 10})

    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 10}
    )
    assert response.status_code == 200
    assert response.json()["portfolio"]["positions"] == []


def test_sell_insufficient_shares_returns_400(client, price_cache):
    price_cache.update("AAPL", 100.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 5})

    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 10}
    )
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert "only" in body["error"]


def test_sell_with_no_position_returns_400(client, price_cache):
    price_cache.update("AAPL", 100.0)
    response = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1}
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_trade_writes_snapshot(client, price_cache):
    price_cache.update("AAPL", 100.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 5})

    history = client.get("/api/portfolio/history")
    assert history.status_code == 200
    snapshots = history.json()["snapshots"]
    assert len(snapshots) == 1
    assert snapshots[0]["total_value"] == 10000.0  # cash+market_value nets out to pre-trade value


def test_history_empty_before_any_trade(client):
    response = client.get("/api/portfolio/history")
    assert response.status_code == 200
    assert response.json() == {"snapshots": []}


def test_history_ordered_ascending(client, price_cache):
    price_cache.update("AAPL", 100.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1})
    price_cache.update("AAPL", 110.0)
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1})

    snapshots = client.get("/api/portfolio/history").json()["snapshots"]
    assert len(snapshots) == 2
    assert snapshots[0]["recorded_at"] <= snapshots[1]["recorded_at"]

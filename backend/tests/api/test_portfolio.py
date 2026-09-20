"""Tests for `GET /api/portfolio` and `POST /api/portfolio/trade`."""

EXPECTED_POSITION_KEYS = {
    "ticker",
    "quantity",
    "avg_cost",
    "current_price",
    "market_value",
    "unrealized_pnl",
    "unrealized_pnl_percent",
}


class TestGetPortfolio:
    """`GET /api/portfolio` against a freshly-seeded database."""

    def test_fresh_database_reports_seed_cash_and_no_positions(self, client):
        response = client.get("/api/portfolio")

        assert response.status_code == 200
        body = response.json()
        assert body["cash_balance"] == 10000.0
        assert body["positions"] == []
        assert body["total_value"] == 10000.0
        assert body["total_unrealized_pnl"] == 0.0


class TestBuyTrade:
    """`POST /api/portfolio/trade` (side=buy) — fills, debits cash, validates."""

    def test_buy_of_watchlisted_ticker_returns_200_and_debits_cash(self, client):
        # AAPL is one of the ten seeded default watchlist tickers.
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 2}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["trade"]["ticker"] == "AAPL"
        assert body["trade"]["price"] == 190.5
        assert body["portfolio"]["cash_balance"] == 10000.0 - round(190.5 * 2, 2)

    def test_buy_response_position_carries_all_seven_field_names(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 2}
        )

        position = response.json()["portfolio"]["positions"][0]
        assert set(position.keys()) == EXPECTED_POSITION_KEYS

    def test_buy_of_ticker_not_on_watchlist_returns_400_and_leaves_state_unchanged(self, client):
        response = client.post(
            "/api/portfolio/trade", json={"ticker": "ZZZZ", "side": "buy", "quantity": 1}
        )

        assert response.status_code == 400
        body = response.json()
        assert body["success"] is False
        assert "error" in body
        assert "portfolio" not in body

        follow_up = client.get("/api/portfolio").json()
        assert follow_up["cash_balance"] == 10000.0

    def test_buy_insufficient_cash_returns_400_with_insufficient_cash_copy(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1000}
        )

        assert response.status_code == 400
        body = response.json()
        assert body["success"] is False
        assert "Insufficient cash" in body["error"]

    def test_buy_non_positive_quantity_returns_400_and_leaves_state_unchanged(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 0}
        )

        assert response.status_code == 400
        assert response.json()["success"] is False
        follow_up = client.get("/api/portfolio").json()
        assert follow_up["cash_balance"] == 10000.0


class TestSellTrade:
    """`POST /api/portfolio/trade` (side=sell) — fills, credits cash, validates."""

    def test_sell_exceeding_holdings_returns_400_and_leaves_state_unchanged(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1}
        )

        assert response.status_code == 400
        body = response.json()
        assert body["success"] is False
        assert "error" in body
        assert "portfolio" not in body

        follow_up = client.get("/api/portfolio").json()
        assert follow_up["cash_balance"] == 10000.0

    def test_sell_of_held_position_credits_cash_and_reduces_quantity(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=100.0)
        client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 4})

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 1}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        positions = body["portfolio"]["positions"]
        assert positions[0]["quantity"] == 3.0

    def test_sell_entire_position_removes_it_from_the_portfolio(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=100.0)
        client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 2})

        response = client.post(
            "/api/portfolio/trade", json={"ticker": "AAPL", "side": "sell", "quantity": 2}
        )

        assert response.status_code == 200
        assert response.json()["portfolio"]["positions"] == []

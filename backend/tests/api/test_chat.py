"""Tests for `POST /api/chat`."""

from types import SimpleNamespace

from app.api.chat import MAX_MESSAGE_CHARS, _execute_watchlist_action
from app.db import get_recent_chat_messages
from app.llm.schema import WatchlistAction

EXPECTED_RESPONSE_KEYS = {"message", "trades", "watchlist_changes"}


class TestPostChat:
    """`POST /api/chat` against a freshly-seeded database, `LLM_MOCK=true`."""

    def test_plain_message_returns_200_with_expected_shape(self, client):
        response = client.post("/api/chat", json={"message": "hello there"})

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == EXPECTED_RESPONSE_KEYS
        assert body["trades"] == []
        assert body["watchlist_changes"] == []
        assert isinstance(body["message"], str) and body["message"] != ""

    def test_portfolio_question_grounds_reply_in_the_real_cash_balance(self, client):
        # Seed a live price so the watchlist half of the prompt context is
        # populated too (CHAT-02's watchlist-grounding half).
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post("/api/chat", json={"message": "how is my portfolio doing?"})

        assert response.status_code == 200
        # Seeded default cash balance is 10000.0 (users_profile default).
        assert "10000.00" in response.json()["message"]

    def test_one_call_persists_exactly_two_messages_user_first(self, client):
        client.post("/api/chat", json={"message": "hello there"})

        messages = get_recent_chat_messages(10)
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "hello there"
        assert messages[1]["role"] == "assistant"

    def test_empty_message_returns_400_and_writes_no_row(self, client):
        response = client.post("/api/chat", json={"message": ""})

        assert response.status_code == 400
        assert "error" in response.json()
        assert get_recent_chat_messages(10) == []

    def test_whitespace_only_message_returns_400_and_writes_no_row(self, client):
        response = client.post("/api/chat", json={"message": "   "})

        assert response.status_code == 400
        assert get_recent_chat_messages(10) == []

    def test_over_length_message_returns_400_and_writes_no_row(self, client):
        response = client.post("/api/chat", json={"message": "a" * (MAX_MESSAGE_CHARS + 1)})

        assert response.status_code == 400
        assert get_recent_chat_messages(10) == []

    def test_exactly_max_length_message_returns_200(self, client):
        response = client.post("/api/chat", json={"message": "a" * MAX_MESSAGE_CHARS})

        assert response.status_code == 200

    def test_multi_byte_message_at_exactly_max_code_points_returns_200(self, client):
        """MAX_MESSAGE_CHARS is measured in Unicode code points via len(),
        not UTF-8 bytes — a message of multi-byte characters at exactly the
        bound must not be rejected as over-length."""
        response = client.post("/api/chat", json={"message": "€" * MAX_MESSAGE_CHARS})

        assert response.status_code == 200


class TestChatTradeDispatch:
    """`POST /api/chat` trade actions — CHAT-03 execution and CHAT-05 failure."""

    def test_buy_message_executes_trade_and_reduces_cash(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=100.0)

        response = client.post("/api/chat", json={"message": "buy 10 aapl"})

        assert response.status_code == 200
        body = response.json()
        assert len(body["trades"]) == 1
        trade = body["trades"][0]
        assert trade == {
            "ticker": "AAPL",
            "side": "buy",
            "quantity": 10.0,
            "status": "executed",
            "price": 100.0,
            "error": None,
        }

        portfolio = client.get("/api/portfolio").json()
        assert portfolio["cash_balance"] == 9000.0
        assert any(p["ticker"] == "AAPL" for p in portfolio["positions"])

    def test_sell_not_held_returns_failed_action_and_changes_nothing(self, client):
        before_portfolio = client.get("/api/portfolio").json()
        before_watchlist = client.get("/api/watchlist").json()

        response = client.post("/api/chat", json={"message": "sell 5 aapl"})

        assert response.status_code == 200
        trade = response.json()["trades"][0]
        assert trade["status"] == "failed"
        assert trade["price"] is None
        assert "own enough shares" in trade["error"]

        assert client.get("/api/portfolio").json() == before_portfolio
        assert client.get("/api/watchlist").json() == before_watchlist

    def test_buy_beyond_cash_returns_failed_action_and_changes_nothing(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=200.0)
        before_portfolio = client.get("/api/portfolio").json()

        response = client.post("/api/chat", json={"message": "buy 1000 aapl"})

        assert response.status_code == 200
        trade = response.json()["trades"][0]
        assert trade["status"] == "failed"
        assert "Insufficient cash" in trade["error"]

        assert client.get("/api/portfolio").json() == before_portfolio


class TestChatWatchlistDispatch:
    """`POST /api/chat` watchlist actions — CHAT-04 execution and D-01 refusal."""

    def test_add_message_executes_and_notifies_market_source(self, client, fake_market_source):
        response = client.post("/api/chat", json={"message": "add pltr"})

        assert response.status_code == 200
        change = response.json()["watchlist_changes"][0]
        assert change == {
            "ticker": "PLTR",
            "action": "add",
            "status": "executed",
            "error": None,
        }

        tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
        assert "PLTR" in tickers
        assert "PLTR" in fake_market_source.added

    def test_remove_held_ticker_returns_failed_action_with_held_message(self, client):
        client.app.state.price_cache.update(ticker="AAPL", price=100.0)
        client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy", "quantity": 1})

        response = client.post("/api/chat", json={"message": "remove aapl"})

        assert response.status_code == 200
        change = response.json()["watchlist_changes"][0]
        assert change["status"] == "failed"
        assert "AAPL" in change["error"]

        tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
        assert "AAPL" in tickers

    async def test_malformed_ticker_add_is_reported_as_failed_action_and_not_inserted(
        self, client
    ):
        # Bypass the mock's own keyword regex (which only ever emits
        # well-formed 1-5-char symbols) to exercise the format-validation
        # branch directly — a real model response is not schema-constrained
        # to a valid ticker (schema.py deliberately carries no ticker-format
        # validator), so this is a real reachable path in production.
        fake_request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(market_source=None))
        )

        result = await _execute_watchlist_action(
            WatchlistAction(ticker="toolongticker", action="add"), fake_request
        )

        assert result["status"] == "failed"
        assert result["error"]
        tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
        assert "TOOLONGTICKER" not in tickers


class TestChatDispatchOrdering:
    """Watchlist changes must run to completion before any trade (Pitfall 3)."""

    def test_add_then_buy_in_same_turn_runs_add_first(self, client):
        response = client.post("/api/chat", json={"message": "add pltr and buy 10 pltr"})

        assert response.status_code == 200
        body = response.json()
        assert body["watchlist_changes"][0]["ticker"] == "PLTR"
        assert body["watchlist_changes"][0]["status"] == "executed"
        trade = body["trades"][0]
        assert trade["ticker"] == "PLTR"
        assert trade["status"] == "failed"
        # Proves the add ran first: if trades ran before watchlist_changes,
        # this would be the not-on-your-watchlist membership error instead.
        assert "No live price" in trade["error"]


class TestChatDispatchResilience:
    """One failing action must not prevent the remaining actions from running."""

    def test_one_failing_action_does_not_block_the_remaining_actions(
        self, client, fake_market_source
    ):
        response = client.post("/api/chat", json={"message": "sell 5 aapl and add pltr"})

        assert response.status_code == 200
        body = response.json()
        assert body["watchlist_changes"][0]["ticker"] == "PLTR"
        assert body["watchlist_changes"][0]["status"] == "executed"
        assert body["trades"][0]["ticker"] == "AAPL"
        assert body["trades"][0]["status"] == "failed"

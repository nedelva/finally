"""Tests for app.llm.schema."""

import pytest
from pydantic import ValidationError

from app.llm.schema import ChatResponse, TradeAction, WatchlistAction


class TestTradeAction:
    def test_valid_buy(self):
        action = TradeAction(ticker="AAPL", side="buy", quantity=10)
        assert action.ticker == "AAPL"
        assert action.side == "buy"
        assert action.quantity == 10

    def test_valid_sell(self):
        action = TradeAction(ticker="TSLA", side="sell", quantity=2.5)
        assert action.side == "sell"
        assert action.quantity == 2.5

    def test_invalid_side_rejected(self):
        with pytest.raises(ValidationError):
            TradeAction(ticker="AAPL", side="hold", quantity=1)

    def test_missing_field_rejected(self):
        with pytest.raises(ValidationError):
            TradeAction(ticker="AAPL", side="buy")


class TestWatchlistAction:
    def test_valid_add(self):
        action = WatchlistAction(ticker="PYPL", action="add")
        assert action.ticker == "PYPL"
        assert action.action == "add"

    def test_valid_remove(self):
        action = WatchlistAction(ticker="PYPL", action="remove")
        assert action.action == "remove"

    def test_invalid_action_rejected(self):
        with pytest.raises(ValidationError):
            WatchlistAction(ticker="PYPL", action="watch")


class TestChatResponse:
    def test_message_only(self):
        resp = ChatResponse(message="Hello")
        assert resp.message == "Hello"
        assert resp.trades == []
        assert resp.watchlist_changes == []

    def test_with_trades_and_watchlist_changes(self):
        resp = ChatResponse(
            message="Executing your request.",
            trades=[{"ticker": "AAPL", "side": "buy", "quantity": 10}],
            watchlist_changes=[{"ticker": "PYPL", "action": "add"}],
        )
        assert len(resp.trades) == 1
        assert isinstance(resp.trades[0], TradeAction)
        assert len(resp.watchlist_changes) == 1
        assert isinstance(resp.watchlist_changes[0], WatchlistAction)

    def test_missing_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatResponse(trades=[], watchlist_changes=[])

    def test_defaults_are_independent_instances(self):
        """Mutable default lists must not be shared across instances."""
        a = ChatResponse(message="a")
        b = ChatResponse(message="b")
        a.trades.append(TradeAction(ticker="AAPL", side="buy", quantity=1))
        assert b.trades == []

    def test_round_trip_json(self):
        resp = ChatResponse(
            message="Buying AAPL.",
            trades=[TradeAction(ticker="AAPL", side="buy", quantity=1)],
            watchlist_changes=[WatchlistAction(ticker="PYPL", action="add")],
        )
        json_str = resp.model_dump_json()
        parsed = ChatResponse.model_validate_json(json_str)
        assert parsed == resp

    def test_rejects_malformed_json(self):
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json("not json at all")

    def test_rejects_missing_required_field_json(self):
        with pytest.raises(ValidationError):
            ChatResponse.model_validate_json('{"trades": [], "watchlist_changes": []}')

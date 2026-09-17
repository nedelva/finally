"""Tests for app.llm.mock -- the deterministic LLM_MOCK=true responder."""

from app.llm.mock import get_mock_response


class TestBuyBranch:
    def test_buy_with_ticker_proposes_trade(self, portfolio_context):
        resp = get_mock_response("Buy AAPL please", portfolio_context, [])
        assert len(resp.trades) == 1
        trade = resp.trades[0]
        assert trade.ticker == "AAPL"
        assert trade.side == "buy"
        assert trade.quantity == 1
        assert resp.watchlist_changes == []

    def test_buy_case_insensitive_keyword_and_ticker(self, portfolio_context):
        resp = get_mock_response("please BUY aapl for me", portfolio_context, [])
        assert resp.trades[0].ticker == "AAPL"
        assert resp.trades[0].side == "buy"

    def test_buy_prefers_watchlist_ticker_over_bare_uppercase_noise(self, portfolio_context):
        # "OK" is a bare uppercase-ish token but AAPL is a known watchlist ticker.
        resp = get_mock_response("OK, buy AAPL now", portfolio_context, [])
        assert resp.trades[0].ticker == "AAPL"

    def test_buy_without_recognizable_ticker_falls_back_to_canned(self, portfolio_context):
        resp = get_mock_response("buy some stock", portfolio_context, [])
        assert resp.trades == []
        assert resp.watchlist_changes == []
        assert "10,955.32" in resp.message or "8,450.32" in resp.message

    def test_buy_ignores_stopword_like_uppercase_prose(self, portfolio_context):
        # "I" is a bare uppercase token but must not be treated as a ticker.
        resp = get_mock_response("I want to buy more", portfolio_context, [])
        assert resp.trades == []
        assert resp.watchlist_changes == []

    def test_buy_all_caps_keyword_does_not_shadow_real_ticker(self, portfolio_context):
        # "BUY" itself is a bare uppercase token; a ticker not on the watchlist
        # should still be found rather than the keyword "BUY" being mistaken for one.
        resp = get_mock_response("BUY IBM", portfolio_context, [])
        assert resp.trades[0].ticker == "IBM"


class TestSellBranch:
    def test_sell_held_position_proposes_full_liquidation(self, portfolio_context):
        resp = get_mock_response("sell my TSLA", portfolio_context, [])
        assert len(resp.trades) == 1
        trade = resp.trades[0]
        assert trade.ticker == "TSLA"
        assert trade.side == "sell"
        assert trade.quantity == 2.5  # full position per fixture
        assert resp.watchlist_changes == []

    def test_sell_unheld_ticker_falls_back_to_canned(self, portfolio_context):
        # GOOGL is on the watchlist but not held as a position.
        resp = get_mock_response("sell GOOGL", portfolio_context, [])
        assert resp.trades == []

    def test_sell_with_no_positions_falls_back_to_canned(self, empty_portfolio_context):
        resp = get_mock_response("sell AAPL", empty_portfolio_context, [])
        assert resp.trades == []
        assert resp.watchlist_changes == []


class TestWatchlistBranch:
    def test_watch_proposes_add(self, portfolio_context):
        resp = get_mock_response("please watch MSFT for me", portfolio_context, [])
        assert resp.trades == []
        assert len(resp.watchlist_changes) == 1
        change = resp.watchlist_changes[0]
        assert change.ticker == "MSFT"
        assert change.action == "add"

    def test_watch_recognizes_existing_watchlist_ticker(self, portfolio_context):
        resp = get_mock_response("keep an eye on the watchlist entry GOOGL", portfolio_context, [])
        assert resp.watchlist_changes[0].ticker == "GOOGL"
        assert resp.watchlist_changes[0].action == "add"

    def test_remove_proposes_watchlist_removal(self, portfolio_context):
        resp = get_mock_response("remove GOOGL from my watchlist", portfolio_context, [])
        assert resp.trades == []
        assert len(resp.watchlist_changes) == 1
        change = resp.watchlist_changes[0]
        assert change.ticker == "GOOGL"
        assert change.action == "remove"

    def test_unwatch_proposes_watchlist_removal(self, portfolio_context):
        resp = get_mock_response("unwatch AAPL", portfolio_context, [])
        assert resp.watchlist_changes[0].action == "remove"
        assert resp.watchlist_changes[0].ticker == "AAPL"

    def test_watch_without_ticker_falls_back_to_canned(self, portfolio_context):
        resp = get_mock_response("what's on my watchlist?", portfolio_context, [])
        assert resp.trades == []
        assert resp.watchlist_changes == []


class TestPlainAnalysisBranch:
    def test_no_keywords_returns_canned_message_referencing_totals(self, portfolio_context):
        resp = get_mock_response("What's my biggest position?", portfolio_context, [])
        assert resp.trades == []
        assert resp.watchlist_changes == []
        assert "10,955.32" in resp.message
        assert "8,450.32" in resp.message

    def test_handles_missing_total_value_gracefully(self):
        resp = get_mock_response("how am I doing?", {}, [])
        assert resp.trades == []
        assert resp.watchlist_changes == []
        assert isinstance(resp.message, str) and resp.message

    def test_deterministic_across_calls(self, portfolio_context):
        r1 = get_mock_response("What's my biggest position?", portfolio_context, [])
        r2 = get_mock_response("What's my biggest position?", portfolio_context, [])
        assert r1 == r2

    def test_history_does_not_affect_output(self, portfolio_context):
        history = [{"role": "user", "content": "irrelevant prior turn"}]
        r1 = get_mock_response("hello there", portfolio_context, [])
        r2 = get_mock_response("hello there", portfolio_context, history)
        assert r1 == r2

"""Tests for app.db.repository."""

from __future__ import annotations

import pytest

from app.db import repository as repo

# --- Cash ---------------------------------------------------------------------


def test_get_cash_balance_default(initialized_db):
    assert repo.get_cash_balance() == 10000.0


def test_set_cash_balance(initialized_db):
    repo.set_cash_balance(4321.5)
    assert repo.get_cash_balance() == 4321.5


# --- Watchlist ------------------------------------------------------------------


def test_add_watchlist_ticker(initialized_db):
    result = repo.add_watchlist_ticker("PYPL")
    assert result["ticker"] == "PYPL"
    assert "added_at" in result

    tickers = {row["ticker"] for row in repo.get_watchlist()}
    assert "PYPL" in tickers


def test_add_duplicate_watchlist_ticker_raises(initialized_db):
    with pytest.raises(ValueError):
        repo.add_watchlist_ticker("AAPL")  # already seeded


def test_remove_watchlist_ticker_returns_true_when_present(initialized_db):
    assert repo.remove_watchlist_ticker("AAPL") is True
    tickers = {row["ticker"] for row in repo.get_watchlist()}
    assert "AAPL" not in tickers


def test_remove_watchlist_ticker_returns_false_when_missing(initialized_db):
    assert repo.remove_watchlist_ticker("NOPE") is False


def test_watchlist_is_scoped_per_user(initialized_db):
    repo.add_watchlist_ticker("PYPL", user_id="other")
    default_tickers = {row["ticker"] for row in repo.get_watchlist()}
    other_tickers = {row["ticker"] for row in repo.get_watchlist(user_id="other")}
    assert "PYPL" not in default_tickers
    assert other_tickers == {"PYPL"}


# --- Positions: buy -------------------------------------------------------------


def test_apply_buy_creates_new_position(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    positions = repo.get_positions()
    assert len(positions) == 1
    assert positions[0]["ticker"] == "AAPL"
    assert positions[0]["quantity"] == 10
    assert positions[0]["avg_cost"] == 100.0


def test_apply_buy_weighted_average_across_multiple_buys(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)  # 10 @ 100 -> avg 100
    repo.apply_buy("AAPL", 10, 200.0)  # +10 @ 200 -> avg (1000+2000)/20 = 150
    positions = repo.get_positions()
    assert len(positions) == 1
    assert positions[0]["quantity"] == 20
    assert positions[0]["avg_cost"] == pytest.approx(150.0)

    repo.apply_buy("AAPL", 20, 50.0)  # +20 @ 50 -> avg (3000+1000)/40 = 100
    positions = repo.get_positions()
    assert positions[0]["quantity"] == 40
    assert positions[0]["avg_cost"] == pytest.approx(100.0)


def test_apply_buy_does_not_touch_cash(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    assert repo.get_cash_balance() == 10000.0


# --- Positions: sell ------------------------------------------------------------


def test_apply_sell_reduces_quantity(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    repo.apply_sell("AAPL", 4, 120.0)
    positions = repo.get_positions()
    assert len(positions) == 1
    assert positions[0]["quantity"] == pytest.approx(6.0)
    # avg_cost untouched on partial sell
    assert positions[0]["avg_cost"] == pytest.approx(100.0)


def test_apply_sell_full_quantity_deletes_position(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    repo.apply_sell("AAPL", 10, 120.0)
    assert repo.get_positions() == []


def test_apply_sell_near_zero_epsilon_deletes_position(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    repo.apply_sell("AAPL", 10 - 1e-10, 120.0)
    assert repo.get_positions() == []


def test_apply_sell_more_than_held_raises(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    with pytest.raises(ValueError):
        repo.apply_sell("AAPL", 11, 120.0)
    # position untouched after failed sell
    positions = repo.get_positions()
    assert positions[0]["quantity"] == 10


def test_apply_sell_with_no_position_raises(initialized_db):
    with pytest.raises(ValueError):
        repo.apply_sell("AAPL", 1, 100.0)


def test_apply_sell_does_not_touch_cash(initialized_db):
    repo.apply_buy("AAPL", 10, 100.0)
    repo.apply_sell("AAPL", 5, 100.0)
    assert repo.get_cash_balance() == 10000.0


# --- Trades ---------------------------------------------------------------------


def test_insert_trade_returns_full_record(initialized_db):
    trade = repo.insert_trade("AAPL", "buy", 10, 190.5)
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["quantity"] == 10
    assert trade["price"] == 190.5
    assert "id" in trade
    assert "executed_at" in trade


# --- Portfolio snapshots ----------------------------------------------------------


def test_get_snapshots_ordered_ascending(initialized_db):
    repo.insert_snapshot(10000.0)
    repo.insert_snapshot(10100.0)
    repo.insert_snapshot(9900.0)

    snapshots = repo.get_snapshots()
    assert [s["total_value"] for s in snapshots] == [10000.0, 10100.0, 9900.0]
    recorded_ats = [s["recorded_at"] for s in snapshots]
    assert recorded_ats == sorted(recorded_ats)


def test_get_snapshots_empty_when_none_recorded(initialized_db):
    assert repo.get_snapshots() == []


# --- Chat messages ----------------------------------------------------------------


def test_insert_and_get_recent_chat_messages_chronological(initialized_db):
    repo.insert_chat_message("user", "hello", None)
    repo.insert_chat_message("assistant", "hi there", '{"trades": []}')
    repo.insert_chat_message("user", "buy 10 AAPL", None)

    messages = repo.get_recent_chat_messages()
    assert [m["content"] for m in messages] == ["hello", "hi there", "buy 10 AAPL"]
    assert messages[1]["role"] == "assistant"
    assert messages[1]["actions"] == '{"trades": []}'
    assert messages[0]["actions"] is None


def test_get_recent_chat_messages_respects_limit_and_order(initialized_db):
    for i in range(5):
        repo.insert_chat_message("user", f"message {i}", None)

    messages = repo.get_recent_chat_messages(limit=3)
    assert [m["content"] for m in messages] == ["message 2", "message 3", "message 4"]

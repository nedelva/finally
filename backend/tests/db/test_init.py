"""Tests for schema creation and seed data."""

from __future__ import annotations

from app.db.connection import get_connection
from app.db.init import init_db
from app.db.repository import get_cash_balance, get_watchlist
from app.db.schema import DEFAULT_WATCHLIST_TICKERS


def test_init_creates_all_tables(db_path):
    init_db()
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        ).fetchall()
        table_names = {row["name"] for row in rows}
    finally:
        conn.close()

    expected = {
        "users_profile",
        "watchlist",
        "positions",
        "trades",
        "portfolio_snapshots",
        "chat_messages",
    }
    assert expected.issubset(table_names)


def test_init_seeds_default_user_with_10k_cash(db_path):
    init_db()
    assert get_cash_balance() == 10000.0


def test_init_seeds_ten_default_watchlist_tickers(db_path):
    init_db()
    watchlist = get_watchlist()
    tickers = {row["ticker"] for row in watchlist}
    assert tickers == set(DEFAULT_WATCHLIST_TICKERS)
    assert len(watchlist) == 10


def test_init_is_idempotent(db_path):
    """Calling init_db() twice must not duplicate seed data or error."""
    init_db()
    init_db()
    assert len(get_watchlist()) == 10
    assert get_cash_balance() == 10000.0


def test_watchlist_rows_ordered_by_added_at(initialized_db):
    watchlist = get_watchlist()
    added_ats = [row["added_at"] for row in watchlist]
    assert added_ats == sorted(added_ats)

"""Tests for `app.db.init.init_db()`."""

from app.db import init_db
from app.db.connection import get_connection
from app.market import DEFAULT_TICKERS

EXPECTED_TABLES = {
    "users_profile",
    "watchlist",
    "positions",
    "trades",
    "portfolio_snapshots",
    "chat_messages",
}


class TestInitDb:
    """Schema creation and seed-data behavior."""

    def test_creates_all_six_tables(self, initialized_db):
        """All six PLAN.md §7 tables exist after init_db()."""
        conn = get_connection()
        try:
            rows = conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        finally:
            conn.close()
        table_names = {row["name"] for row in rows}
        assert EXPECTED_TABLES.issubset(table_names)

    def test_seeds_exactly_one_default_user_profile(self, initialized_db):
        """The seed inserts exactly one users_profile row with $10k cash."""
        conn = get_connection()
        try:
            rows = conn.execute("SELECT id, cash_balance FROM users_profile").fetchall()
        finally:
            conn.close()
        assert len(rows) == 1
        assert rows[0]["id"] == "default"
        assert rows[0]["cash_balance"] == 10000.0

    def test_seeds_exactly_ten_default_watchlist_tickers(self, initialized_db):
        """The seed inserts one watchlist row per DEFAULT_TICKERS entry."""
        conn = get_connection()
        try:
            rows = conn.execute("SELECT ticker FROM watchlist").fetchall()
        finally:
            conn.close()
        tickers = {row["ticker"] for row in rows}
        assert len(rows) == 10
        assert tickers == set(DEFAULT_TICKERS)

    def test_calling_init_db_twice_is_idempotent(self, initialized_db):
        """A second init_db() call leaves user and watchlist counts unchanged."""
        init_db()
        conn = get_connection()
        try:
            user_count = conn.execute("SELECT COUNT(*) AS n FROM users_profile").fetchone()["n"]
            watchlist_count = conn.execute("SELECT COUNT(*) AS n FROM watchlist").fetchone()["n"]
        finally:
            conn.close()
        assert user_count == 1
        assert watchlist_count == 10

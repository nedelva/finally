"""Tests for `app.db.repository.add_watchlist_ticker`/`remove_watchlist_ticker`."""

import pytest

from app.db import add_watchlist_ticker, get_watchlist, remove_watchlist_ticker


class TestAddWatchlistTicker:
    """Synchronous repository-level tests against a freshly-seeded database."""

    def test_add_inserts_row_and_returns_expected_dict_shape(self, initialized_db):
        result = add_watchlist_ticker("PYPL")

        assert result == {"ticker": "PYPL", "added_at": result["added_at"]}
        assert set(result.keys()) == {"ticker", "added_at"}

    def test_add_persists_exactly_one_new_row(self, initialized_db):
        before = get_watchlist()
        add_watchlist_ticker("PYPL")
        after = get_watchlist()

        assert len(after) == len(before) + 1
        assert "PYPL" in {row["ticker"] for row in after}

    def test_add_duplicate_raises_value_error_naming_the_ticker(self, initialized_db):
        add_watchlist_ticker("PYPL")

        with pytest.raises(ValueError, match="PYPL"):
            add_watchlist_ticker("PYPL")

    def test_add_duplicate_does_not_create_a_second_row(self, initialized_db):
        add_watchlist_ticker("PYPL")
        try:
            add_watchlist_ticker("PYPL")
        except ValueError:
            pass

        rows = [row for row in get_watchlist() if row["ticker"] == "PYPL"]
        assert len(rows) == 1


class TestRemoveWatchlistTicker:
    """Synchronous repository-level tests against a freshly-seeded database."""

    def test_remove_deletes_the_row_and_returns_true(self, initialized_db):
        add_watchlist_ticker("PYPL")

        result = remove_watchlist_ticker("PYPL")

        assert result is True
        assert "PYPL" not in {row["ticker"] for row in get_watchlist()}

    def test_remove_absent_ticker_returns_false(self, initialized_db):
        result = remove_watchlist_ticker("ZZZZ")

        assert result is False

    def test_remove_absent_ticker_does_not_change_row_count(self, initialized_db):
        before = len(get_watchlist())
        remove_watchlist_ticker("ZZZZ")
        after = len(get_watchlist())

        assert after == before

    def test_remove_twice_returns_false_on_the_second_call(self, initialized_db):
        add_watchlist_ticker("PYPL")
        remove_watchlist_ticker("PYPL")

        result = remove_watchlist_ticker("PYPL")

        assert result is False

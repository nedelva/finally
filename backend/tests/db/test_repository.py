"""Tests for `app.db.repository.add_watchlist_ticker`/`remove_watchlist_ticker`/
`execute_trade`/`get_positions`/`get_cash_balance`/`total_portfolio_value`."""

import uuid

import pytest

from app.db import (
    add_watchlist_ticker,
    execute_trade,
    get_cash_balance,
    get_positions,
    get_snapshots,
    get_watchlist,
    record_snapshot,
    remove_watchlist_ticker,
    total_portfolio_value,
)
from app.db.connection import get_connection
from app.market import PriceCache


def _seeded_cache(prices: dict[str, float]) -> PriceCache:
    """A PriceCache seeded with prices for tickers already on the default
    seeded watchlist (AAPL, MSFT, ... — see `app.market.DEFAULT_TICKERS`)."""
    cache = PriceCache()
    for ticker, price in prices.items():
        cache.update(ticker=ticker, price=price)
    return cache


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

    def test_remove_held_ticker_raises_value_error_naming_the_ticker(self, initialized_db):
        # D-01/D-02/D-03: AAPL is already on the seeded watchlist.
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)

        with pytest.raises(ValueError, match="AAPL"):
            remove_watchlist_ticker("AAPL")

    def test_remove_held_ticker_leaves_the_watchlist_row_in_place(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)

        with pytest.raises(ValueError):
            remove_watchlist_ticker("AAPL")

        assert "AAPL" in {row["ticker"] for row in get_watchlist()}

    def test_remove_succeeds_when_no_position_row_exists(self, initialized_db):
        # AAPL is watchlisted by seed data but never traded.
        result = remove_watchlist_ticker("AAPL")

        assert result is True
        assert "AAPL" not in {row["ticker"] for row in get_watchlist()}

    def test_remove_succeeds_when_position_quantity_is_just_above_epsilon(self, initialized_db):
        # D-03 boundary: quantity strictly greater than 1e-9 counts as held.
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 1.0 + 2e-9)

        with pytest.raises(ValueError, match="AAPL"):
            remove_watchlist_ticker("AAPL")

    def test_remove_succeeds_when_position_quantity_is_exactly_at_epsilon(self, initialized_db):
        # D-03 boundary: quantity at or below 1e-9 counts as not held.
        # execute_trade deletes the positions row once quantity drops to
        # <= 1e-9 on a sell, so simulate the exact-epsilon case by inserting
        # a positions row directly rather than trading down to it (a trade
        # can't land on exactly 1e-9 through normal buy/sell arithmetic).
        add_watchlist_ticker("ZZZZ")
        conn = get_connection()
        try:
            with conn:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                    "VALUES (?, 'default', 'ZZZZ', 1e-9, 10.0, datetime('now'))",
                    (str(uuid.uuid4()),),
                )
        finally:
            conn.close()

        result = remove_watchlist_ticker("ZZZZ")

        assert result is True
        assert "ZZZZ" not in {row["ticker"] for row in get_watchlist()}


class TestGetCashBalance:
    """Synchronous repository-level tests against a freshly-seeded database."""

    def test_returns_default_seed_balance_on_fresh_db(self, initialized_db):
        assert get_cash_balance() == 10000.0


class TestGetPositions:
    """Synchronous repository-level tests against a freshly-seeded database."""

    def test_returns_empty_list_on_fresh_db(self, initialized_db):
        assert get_positions() == []


class TestExecuteTrade:
    """Synchronous repository-level tests against a freshly-seeded database.

    AAPL and MSFT are already on the seeded watchlist (`DEFAULT_TICKERS`), so
    these tests never need to call `add_watchlist_ticker` themselves — doing
    so would raise a duplicate `ValueError` against the seed data.
    """

    def test_buy_debits_cash_and_creates_position(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})

        execute_trade(cache, "AAPL", "buy", 2)

        assert get_cash_balance() == 9800.0
        positions = get_positions()
        assert len(positions) == 1
        assert positions[0]["ticker"] == "AAPL"
        assert positions[0]["quantity"] == 2.0
        assert positions[0]["avg_cost"] == 100.0

    def test_second_buy_at_different_price_computes_weighted_average(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)
        cache.update(ticker="AAPL", price=200.0)

        execute_trade(cache, "AAPL", "buy", 2)

        positions = get_positions()
        assert positions[0]["quantity"] == 4.0
        assert positions[0]["avg_cost"] == 150.0

    def test_sell_leaves_avg_cost_unchanged(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)
        cache.update(ticker="AAPL", price=500.0)

        execute_trade(cache, "AAPL", "sell", 1)

        positions = get_positions()
        assert positions[0]["quantity"] == 1.0
        assert positions[0]["avg_cost"] == 100.0

    def test_selling_the_entire_fractional_position_removes_the_row(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 1.5)

        execute_trade(cache, "AAPL", "sell", 1.5)

        assert get_positions() == []

    def test_overselling_raises_and_leaves_state_byte_identical(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)
        cash_before = get_cash_balance()
        positions_before = get_positions()

        with pytest.raises(ValueError):
            execute_trade(cache, "AAPL", "sell", 3)

        assert get_cash_balance() == cash_before
        assert get_positions() == positions_before

    def test_buy_exceeding_cash_by_one_cent_raises_and_appends_no_trade_row(self, initialized_db):
        cache = _seeded_cache({"AAPL": 10000.01})

        with pytest.raises(ValueError):
            execute_trade(cache, "AAPL", "buy", 1)

        assert get_cash_balance() == 10000.0
        conn = get_connection()
        try:
            count = conn.execute("SELECT COUNT(*) FROM trades").fetchone()[0]
        finally:
            conn.close()
        assert count == 0

    def test_buy_exactly_affordable_quantity_leaves_cash_at_exactly_zero(self, initialized_db):
        cache = _seeded_cache({"AAPL": 10000.0})

        execute_trade(cache, "AAPL", "buy", 1)

        assert get_cash_balance() == 0.0

    @pytest.mark.parametrize("quantity", [0, -5])
    def test_non_positive_quantity_raises_before_any_write(self, initialized_db, quantity):
        cache = _seeded_cache({"AAPL": 100.0})
        cash_before = get_cash_balance()

        with pytest.raises(ValueError):
            execute_trade(cache, "AAPL", "buy", quantity)

        assert get_cash_balance() == cash_before
        assert get_positions() == []

    @pytest.mark.parametrize("quantity", [float("nan"), float("inf"), float("-inf")])
    def test_non_finite_quantity_raises_before_any_write(self, initialized_db, quantity):
        # CR-01: a NaN/Infinity quantity evaluates every `<=`/`>` comparison
        # as False in Python, so it must be rejected explicitly rather than
        # relying on the numeric guards further down.
        cache = _seeded_cache({"AAPL": 100.0})
        cash_before = get_cash_balance()

        with pytest.raises(ValueError):
            execute_trade(cache, "AAPL", "buy", quantity)

        assert get_cash_balance() == cash_before
        assert get_positions() == []

    def test_concurrent_buys_do_not_lose_an_update(self, initialized_db, monkeypatch):
        # WR-01: force two `execute_trade` calls to open their connections
        # before either proceeds past its first read, deterministically
        # reproducing the interleaving a stray double-click/two-tab race
        # could produce. Before the `BEGIN IMMEDIATE` fix, both threads read
        # the same starting cash balance and the second write clobbers the
        # first's result (a "lost update"): final cash ends up 5000.0
        # instead of the correct 0.0. `BEGIN IMMEDIATE` makes the second
        # connection's transaction block until the first commits, so its
        # SELECT observes the first trade's already-updated balance.
        import threading

        import app.db.repository as repo

        cache = _seeded_cache({"AAPL": 1000.0})
        barrier = threading.Barrier(2)
        call_count = {"n": 0}
        count_lock = threading.Lock()
        orig_get_connection = repo.get_connection

        def synchronized_get_connection():
            conn = orig_get_connection()
            with count_lock:
                call_count["n"] += 1
                n = call_count["n"]
            if n <= 2:
                barrier.wait(timeout=5)
            return conn

        monkeypatch.setattr(repo, "get_connection", synchronized_get_connection)

        results = []

        def do_trade():
            try:
                execute_trade(cache, "AAPL", "buy", 5)
                results.append("ok")
            except Exception as exc:  # pragma: no cover - failure path only
                results.append(f"err:{exc}")

        t1 = threading.Thread(target=do_trade)
        t2 = threading.Thread(target=do_trade)
        t1.start()
        t2.start()
        t1.join(timeout=5)
        t2.join(timeout=5)

        assert results == ["ok", "ok"]
        assert get_cash_balance() == 0.0

    def test_ticker_not_on_watchlist_raises_even_with_a_cache_price(self, initialized_db):
        cache = PriceCache()
        cache.update(ticker="ZZZZ", price=50.0)

        with pytest.raises(ValueError):
            execute_trade(cache, "ZZZZ", "buy", 1)

    def test_successful_trade_writes_a_snapshot_matching_total_portfolio_value(
        self, initialized_db
    ):
        cache = _seeded_cache({"AAPL": 100.0})

        execute_trade(cache, "AAPL", "buy", 2)

        conn = get_connection()
        try:
            snapshot_rows = conn.execute("SELECT total_value FROM portfolio_snapshots").fetchall()
            assert len(snapshot_rows) == 1
            snapshot_value = snapshot_rows[0]["total_value"]
            expected = total_portfolio_value(conn, cache)
        finally:
            conn.close()
        assert snapshot_value == expected

    def test_snapshot_equals_total_value_when_a_held_ticker_has_no_cache_entry(
        self, initialized_db
    ):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)
        cache.remove("AAPL")
        cache.update(ticker="MSFT", price=50.0)

        execute_trade(cache, "MSFT", "buy", 1)

        conn = get_connection()
        try:
            latest = conn.execute(
                "SELECT total_value FROM portfolio_snapshots ORDER BY recorded_at DESC LIMIT 1"
            ).fetchone()
            expected = total_portfolio_value(conn, cache)
        finally:
            conn.close()
        assert latest["total_value"] == expected


class TestRecordSnapshot:
    """Synchronous repository-level tests against a freshly-seeded database."""

    def test_record_snapshot_on_fresh_db_writes_seeded_cash_balance(self, initialized_db):
        cache = PriceCache()

        result = record_snapshot(cache)

        assert result["total_value"] == 10000.0

    def test_record_snapshot_matches_build_portfolio_after_a_buy(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)
        conn = get_connection()
        try:
            expected = total_portfolio_value(conn, cache)
        finally:
            conn.close()

        result = record_snapshot(cache)

        assert result["total_value"] == expected

    def test_record_snapshot_matches_when_held_ticker_has_no_cache_entry(self, initialized_db):
        cache = _seeded_cache({"AAPL": 100.0})
        execute_trade(cache, "AAPL", "buy", 2)
        cache.remove("AAPL")
        conn = get_connection()
        try:
            expected = total_portfolio_value(conn, cache)
        finally:
            conn.close()

        result = record_snapshot(cache)

        assert result["total_value"] == expected

    def test_calling_record_snapshot_twice_produces_two_rows_not_an_upsert(self, initialized_db):
        cache = PriceCache()

        record_snapshot(cache)
        record_snapshot(cache)

        conn = get_connection()
        try:
            count = conn.execute("SELECT COUNT(*) FROM portfolio_snapshots").fetchone()[0]
        finally:
            conn.close()
        assert count == 2


class TestGetSnapshots:
    """Synchronous repository-level tests against a freshly-seeded database."""

    def test_get_snapshots_returns_rows_ascending_by_recorded_at_with_exact_keys(
        self, initialized_db
    ):
        cache = PriceCache()
        record_snapshot(cache)
        record_snapshot(cache)

        rows = get_snapshots()

        assert len(rows) == 2
        assert rows[0]["recorded_at"] <= rows[1]["recorded_at"]
        for row in rows:
            assert set(row.keys()) == {"total_value", "recorded_at"}

    def test_get_snapshots_on_fresh_db_returns_empty_list(self, initialized_db):
        assert get_snapshots() == []

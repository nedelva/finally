"""Repository functions for FinAlly's persistence layer.

Plain, module-level, synchronous functions — every call opens and closes its
own SQLite connection (see `connection.get_connection`). Route handlers must
wrap every call here in `await asyncio.to_thread(...)` to avoid blocking the
event loop. Every SQL statement uses `?` placeholders bound through the
`execute()` parameter tuple — never string interpolation of any kind.
"""

from __future__ import annotations

import json
import math
import sqlite3
import uuid
from datetime import UTC, datetime

from app.db.connection import get_connection
from app.db.schema import DEFAULT_USER_ID


def get_watchlist() -> list[dict]:
    """Return the current user's watchlist rows, ordered by when they were added.

    Each row is converted to a plain dict (via `sqlite3.Row`), carrying
    `id`, `user_id`, `ticker`, `added_at`. Returns an empty list if the
    watchlist has no entries.
    """
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, user_id, ticker, added_at FROM watchlist "
            "WHERE user_id = ? ORDER BY added_at",
            (DEFAULT_USER_ID,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def add_watchlist_ticker(ticker: str) -> dict:
    """Insert a new watchlist row for the current user.

    Expects an already-normalized, already-validated ticker — the format
    gate lives at the API boundary (`app/api/watchlist.py`), not here. On a
    `UNIQUE (user_id, ticker)` constraint violation, raises `ValueError`
    naming the ticker, following this project's convention that a duplicate
    is a caller-level condition the route translates into a status code.
    """
    row_id = str(uuid.uuid4())
    added_at = datetime.now(UTC).isoformat()
    conn = get_connection()
    try:
        try:
            with conn:
                conn.execute(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) "
                    "VALUES (?, ?, ?, ?)",
                    (row_id, DEFAULT_USER_ID, ticker, added_at),
                )
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"{ticker} is already on your watchlist.") from exc
    finally:
        conn.close()
    return {"ticker": ticker, "added_at": added_at}


def remove_watchlist_ticker(ticker: str) -> bool:
    """Delete a watchlist row for the current user.

    Expects an already-normalized ticker. Reads `positions` to enforce the
    held-position guard (D-01/D-02/D-03) but still writes only to the
    `watchlist` table — removal is a display-list change, not a cascading
    purge, so this never writes to `positions`, `trades`,
    `portfolio_snapshots`, or `chat_messages`. Raises `ValueError` if the
    user still holds the ticker, naming it and the held quantity, following
    this repository's convention that a caller-level rejection is a
    `ValueError` (the same convention `add_watchlist_ticker` uses for a
    duplicate on this same table). Otherwise returns whether a row was
    actually deleted (read from the cursor's `rowcount`), following this
    project's convention that absence is a return value, not an exception,
    and giving the route what it needs to distinguish a 204 from a 404.
    """
    conn = get_connection()
    try:
        with conn:
            # BEGIN IMMEDIATE acquires the write lock before the first
            # SELECT, mirroring execute_trade's WR-01 rationale: this
            # function now reads (positions) before it writes (watchlist
            # delete), and sqlite3's default deferred transaction only opens
            # on the first write. Without this escalation, a concurrent buy
            # could commit between this guard's SELECT and the DELETE,
            # removing a ticker that is held by the time the delete lands.
            conn.execute("BEGIN IMMEDIATE")
            position_row = conn.execute(
                "SELECT quantity FROM positions WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            ).fetchone()
            if position_row is not None and position_row["quantity"] > 1e-9:
                raise ValueError(
                    f"You still hold {position_row['quantity']} shares of {ticker} — "
                    "sell first."
                )
            cursor = conn.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            )
            return cursor.rowcount > 0
    finally:
        conn.close()


def get_cash_balance() -> float:
    """Return the current user's cash balance."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?",
            (DEFAULT_USER_ID,),
        ).fetchone()
        return row["cash_balance"]
    finally:
        conn.close()


def get_positions() -> list[dict]:
    """Return the current user's positions, ordered by ticker.

    Each row is a plain dict carrying `ticker`, `quantity`, `avg_cost`,
    `updated_at`. Returns an empty list when the user holds nothing.
    """
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost, updated_at FROM positions "
            "WHERE user_id = ? ORDER BY ticker",
            (DEFAULT_USER_ID,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def total_portfolio_value(conn: sqlite3.Connection, price_cache) -> float:
    """Value cash + positions on an already-open connection (D-03-aware).

    Takes an already-open connection so it can run inside a live
    transaction (the post-trade snapshot write in `execute_trade`) as well
    as standalone (03-04's `record_snapshot`). Each position's contribution
    is rounded to 2 decimals before summing with cash and rounding the
    total — the same round-then-sum order `build_portfolio` in
    `app.api.portfolio` uses, which is what makes the two independently
    computed totals agree to the cent for fractional quantities. A ticker
    absent from `price_cache` falls back to its own `avg_cost` (D-03)
    rather than reporting a stale or null valuation.
    """
    cash_row = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
    ).fetchone()
    total = cash_row["cash_balance"]
    position_rows = conn.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ?",
        (DEFAULT_USER_ID,),
    ).fetchall()
    for row in position_rows:
        current_price = price_cache.get_price(row["ticker"])
        if current_price is None:
            current_price = row["avg_cost"]
        total += round(row["quantity"] * current_price, 2)
    return round(total, 2)


def record_snapshot(price_cache) -> dict:
    """Write one `portfolio_snapshots` row valued through `total_portfolio_value`.

    Opens its own connection and computes the value inside a `with conn:`
    block via the shared `total_portfolio_value(conn, price_cache)` helper
    `execute_trade`'s post-trade write already uses — routing through the
    same helper (rather than re-summing positions here) is what keeps the
    periodic writer, the in-transaction post-trade writer, and
    `build_portfolio` from ever disagreeing on a valuation. Returns the
    written `total_value` and `recorded_at`.
    """
    conn = get_connection()
    try:
        with conn:
            total_value = total_portfolio_value(conn, price_cache)
            recorded_at = datetime.now(UTC).isoformat()
            conn.execute(
                "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
                "VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), DEFAULT_USER_ID, total_value, recorded_at),
            )
    finally:
        conn.close()
    return {"total_value": total_value, "recorded_at": recorded_at}


def get_snapshots() -> list[dict]:
    """Return the current user's snapshots, ascending by `recorded_at`.

    Each row is a plain dict carrying exactly `total_value` and
    `recorded_at` — the two columns match `PortfolioSnapshot` in
    `frontend/lib/types.ts` exactly, so no extra keys are emitted. Ascending
    order means the chart plots forward in time with no client-side sorting.
    Returns an empty list when no snapshot has been recorded yet.
    """
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots "
            "WHERE user_id = ? ORDER BY recorded_at",
            (DEFAULT_USER_ID,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def execute_trade(price_cache, ticker: str, side: str, quantity: float) -> dict:
    """Execute a market-order trade against the live price cache.

    Expects an already-normalized ticker — the format/normalize gate lives
    at the API boundary (`app/api/portfolio.py`), not here, mirroring
    `add_watchlist_ticker`'s own convention. Validates and writes atomically
    inside a single `with conn:` block on one connection: a watchlist
    membership check (D-01), a cash/position read, the buy-or-sell money
    math, and four writes (`users_profile`, `positions`, `trades`,
    `portfolio_snapshots`) — the last of which shares this transaction's
    valuation with `total_portfolio_value` (PORT-06's post-trade half).
    Raises `ValueError` for every caller-level rejection: non-positive
    quantity, an off-watchlist ticker, no cache price, insufficient cash, or
    an over-sell (each leaving cash/positions/trades byte-identical to
    before the call, since the whole block runs inside one transaction).
    """
    if not math.isfinite(quantity) or quantity <= 0:
        raise ValueError("Quantity must be a positive, finite number.")

    conn = get_connection()
    try:
        with conn:
            # BEGIN IMMEDIATE acquires the write lock before the first SELECT,
            # instead of relying on sqlite3's default deferred-transaction
            # behavior (which only opens a transaction before the first
            # write). Without this, two concurrent trade requests can both
            # read the same stale cash/position balance before either has
            # written, producing a lost-update race (WR-01).
            conn.execute("BEGIN IMMEDIATE")
            watchlisted = conn.execute(
                "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            ).fetchone()
            if watchlisted is None:
                raise ValueError(f"{ticker} is not on your watchlist.")

            price = price_cache.get_price(ticker)
            if price is None:
                raise ValueError(f"No live price available for {ticker}.")

            cash_row = conn.execute(
                "SELECT cash_balance FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
            ).fetchone()
            balance = cash_row["cash_balance"]

            position_row = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            ).fetchone()
            prior_quantity = position_row["quantity"] if position_row else 0.0
            prior_avg_cost = position_row["avg_cost"] if position_row else 0.0

            if side == "buy":
                cost = round(price * quantity, 2)
                if cost > balance:
                    raise ValueError(
                        "Insufficient cash for this trade. Lower the quantity and try again."
                    )
                new_quantity = prior_quantity + quantity
                new_avg_cost = round(((prior_quantity * prior_avg_cost) + cost) / new_quantity, 4)
                new_cash = round(balance - cost, 2)
            else:
                if quantity > prior_quantity + 1e-9:
                    raise ValueError(
                        "You don't own enough shares to sell that many. "
                        "Lower the quantity and try again."
                    )
                proceeds = round(price * quantity, 2)
                new_quantity = prior_quantity - quantity
                new_avg_cost = prior_avg_cost
                new_cash = round(balance + proceeds, 2)

            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
                (new_cash, DEFAULT_USER_ID),
            )

            now = datetime.now(UTC).isoformat()
            if new_quantity <= 1e-9:
                conn.execute(
                    "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
                    (DEFAULT_USER_ID, ticker),
                )
            else:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?) "
                    "ON CONFLICT (user_id, ticker) DO UPDATE SET "
                    "quantity = excluded.quantity, avg_cost = excluded.avg_cost, "
                    "updated_at = excluded.updated_at",
                    (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, new_quantity, new_avg_cost, now),
                )

            trade_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (trade_id, DEFAULT_USER_ID, ticker, side, quantity, price, now),
            )

            snapshot_value = total_portfolio_value(conn, price_cache)
            conn.execute(
                "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
                "VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), DEFAULT_USER_ID, snapshot_value, now),
            )
    finally:
        conn.close()

    return {
        "id": trade_id,
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": price,
        "executed_at": now,
    }


def insert_chat_message(role: str, content: str, actions: dict | None) -> dict:
    """Insert one `chat_messages` row for the current user.

    Mirrors `add_watchlist_ticker`'s insert-with-UUID-and-ISO-timestamp
    shape. `actions` is serialized with `json.dumps` when not `None` and
    bound as SQL `NULL` otherwise — the user turn always passes `None`
    here, the assistant turn passes the full response payload dict.
    Returns the inserted row as a plain dict with `actions` still the
    Python object (not the serialized string), matching this module's
    convention of returning caller-friendly values.
    """
    row_id = str(uuid.uuid4())
    created_at = datetime.now(UTC).isoformat()
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    row_id,
                    DEFAULT_USER_ID,
                    role,
                    content,
                    json.dumps(actions) if actions is not None else None,
                    created_at,
                ),
            )
    finally:
        conn.close()
    return {
        "id": row_id,
        "role": role,
        "content": content,
        "actions": actions,
        "created_at": created_at,
    }


def get_chat_history() -> list[dict]:
    """Return every persisted chat turn for the current user, oldest first.

    Selects `id, role, content, actions, created_at` — the five columns named
    explicitly, never a star-select and never a whole-row spread — so
    `user_id` and any future schema column can never leak into the eventual
    HTTP response. No `LIMIT`: this matches `get_snapshots`'s established
    no-pagination baseline for this single-user app, unlike
    `get_recent_chat_messages`'s bounded read, which exists for the prompt's
    token budget — a different concern from what the panel renders on
    reload. `actions` is returned exactly as stored (a JSON string or
    `None`); parsing it into an object is the route's job, not this
    function's, mirroring the rest of this module's raw-row convention.
    """
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, role, content, actions, created_at FROM chat_messages "
            "WHERE user_id = ? ORDER BY created_at",
            (DEFAULT_USER_ID,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_recent_chat_messages(limit: int) -> list[dict]:
    """Return the current user's most recent chat turns, oldest first.

    Selects `role, content` ordered by `created_at` descending with a
    bound `LIMIT ?` (so a large history is never fully scanned just to
    read the tail), then reverses the result in Python so the caller
    receives turns ready to hand straight to `build_messages` — oldest
    conversation turn first, newest last.
    """
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE user_id = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (DEFAULT_USER_ID, limit),
        ).fetchall()
        return [dict(row) for row in reversed(rows)]
    finally:
        conn.close()

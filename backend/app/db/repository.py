"""Public repository API for the `db` module.

`backend-api-engineer` imports these functions directly; treat their signatures as a contract
(see `planning/OWNERSHIP.md` and the task brief). Every function opens its own connection (safe
across FastAPI's threadpool) and returns plain `dict`/`list[dict]`/primitive values — never a raw
`sqlite3.Row` or `Connection` — so callers never need to know this is SQLite.

Mutating functions wrap their writes in `with conn:` so a failure can't leave partial state.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.db.connection import get_connection
from app.db.schema import DEFAULT_USER_ID

_QTY_EPSILON = 1e-9


def _now() -> str:
    return datetime.now(UTC).isoformat()


# --- Cash -------------------------------------------------------------------


def get_cash_balance(user_id: str = DEFAULT_USER_ID) -> float:
    """Return the user's current cash balance."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (user_id,)
        ).fetchone()
        return float(row["cash_balance"]) if row else 0.0
    finally:
        conn.close()


def set_cash_balance(amount: float, user_id: str = DEFAULT_USER_ID) -> None:
    """Set the user's cash balance to `amount`."""
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?", (amount, user_id)
            )
    finally:
        conn.close()


# --- Watchlist ----------------------------------------------------------------


def get_watchlist(user_id: str = DEFAULT_USER_ID) -> list[dict]:
    """Return `[{"ticker", "added_at"}, ...]` ordered by `added_at`."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT ticker, added_at FROM watchlist WHERE user_id = ? "
            "ORDER BY added_at ASC, rowid ASC",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def add_watchlist_ticker(ticker: str, user_id: str = DEFAULT_USER_ID) -> dict:
    """Add `ticker` to the watchlist. Raises `ValueError` if it's already present."""
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?", (user_id, ticker)
        ).fetchone()
        if existing is not None:
            raise ValueError(f"{ticker} is already on the watchlist")

        added_at = _now()
        with conn:
            conn.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), user_id, ticker, added_at),
            )
        return {"ticker": ticker, "added_at": added_at}
    finally:
        conn.close()


def remove_watchlist_ticker(ticker: str, user_id: str = DEFAULT_USER_ID) -> bool:
    """Remove `ticker` from the watchlist. Returns True if a row was deleted."""
    conn = get_connection()
    try:
        with conn:
            cursor = conn.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?", (user_id, ticker)
            )
        return cursor.rowcount > 0
    finally:
        conn.close()


# --- Positions ----------------------------------------------------------------


def get_positions(user_id: str = DEFAULT_USER_ID) -> list[dict]:
    """Return `[{"ticker", "quantity", "avg_cost", "updated_at"}, ...]`."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT ticker, quantity, avg_cost, updated_at FROM positions WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def apply_buy(
    ticker: str, quantity: float, price: float, user_id: str = DEFAULT_USER_ID
) -> None:
    """Upsert a position on a buy, using weighted-average cost. Does not touch cash."""
    conn = get_connection()
    try:
        with conn:
            row = conn.execute(
                "SELECT id, quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (user_id, ticker),
            ).fetchone()
            now = _now()
            if row is None:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), user_id, ticker, quantity, price, now),
                )
            else:
                old_qty = row["quantity"]
                old_avg_cost = row["avg_cost"]
                new_qty = old_qty + quantity
                new_avg_cost = (old_qty * old_avg_cost + quantity * price) / new_qty
                conn.execute(
                    "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? "
                    "WHERE id = ?",
                    (new_qty, new_avg_cost, now, row["id"]),
                )
    finally:
        conn.close()


def apply_sell(
    ticker: str, quantity: float, price: float, user_id: str = DEFAULT_USER_ID
) -> None:
    """Reduce a position's quantity on a sell; delete the row if it hits ~0.

    Raises `ValueError` if no position exists or `quantity` exceeds the held amount. `price` is
    accepted for interface symmetry with `apply_buy` but is not used — sells don't change
    `avg_cost`. Does not touch cash.
    """
    conn = get_connection()
    try:
        with conn:
            row = conn.execute(
                "SELECT id, quantity FROM positions WHERE user_id = ? AND ticker = ?",
                (user_id, ticker),
            ).fetchone()
            if row is None:
                raise ValueError(f"No position in {ticker} to sell")
            if quantity > row["quantity"] + _QTY_EPSILON:
                raise ValueError(
                    f"Cannot sell {quantity} shares of {ticker}: only {row['quantity']} held"
                )

            remaining = row["quantity"] - quantity
            if remaining < _QTY_EPSILON:
                conn.execute("DELETE FROM positions WHERE id = ?", (row["id"],))
            else:
                conn.execute(
                    "UPDATE positions SET quantity = ?, updated_at = ? WHERE id = ?",
                    (remaining, _now(), row["id"]),
                )
    finally:
        conn.close()


# --- Trades ---------------------------------------------------------------------


def insert_trade(
    ticker: str, side: str, quantity: float, price: float, user_id: str = DEFAULT_USER_ID
) -> dict:
    """Insert a trade record and return it as a dict."""
    conn = get_connection()
    try:
        trade_id = str(uuid.uuid4())
        executed_at = _now()
        with conn:
            conn.execute(
                "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (trade_id, user_id, ticker, side, quantity, price, executed_at),
            )
        return {
            "id": trade_id,
            "ticker": ticker,
            "side": side,
            "quantity": quantity,
            "price": price,
            "executed_at": executed_at,
        }
    finally:
        conn.close()


# --- Portfolio snapshots --------------------------------------------------------


def insert_snapshot(total_value: float, user_id: str = DEFAULT_USER_ID) -> None:
    """Insert a portfolio value snapshot."""
    conn = get_connection()
    try:
        with conn:
            conn.execute(
                "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
                "VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), user_id, total_value, _now()),
            )
    finally:
        conn.close()


def get_snapshots(user_id: str = DEFAULT_USER_ID) -> list[dict]:
    """Return `[{"total_value", "recorded_at"}, ...]` ordered ascending by `recorded_at`."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots "
            "WHERE user_id = ? ORDER BY recorded_at ASC, rowid ASC",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


# --- Chat messages ---------------------------------------------------------------


def insert_chat_message(
    role: str, content: str, actions_json: str | None, user_id: str = DEFAULT_USER_ID
) -> dict:
    """Insert a chat message and return it as a dict."""
    conn = get_connection()
    try:
        message_id = str(uuid.uuid4())
        created_at = _now()
        with conn:
            conn.execute(
                "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (message_id, user_id, role, content, actions_json, created_at),
            )
        return {
            "id": message_id,
            "role": role,
            "content": content,
            "actions": actions_json,
            "created_at": created_at,
        }
    finally:
        conn.close()


def get_recent_chat_messages(limit: int = 10, user_id: str = DEFAULT_USER_ID) -> list[dict]:
    """Return the most recent `limit` messages, oldest-first, as `{"role", "content", "actions"}`."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT role, content, actions FROM chat_messages WHERE user_id = ? "
            "ORDER BY created_at DESC, rowid DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(row) for row in reversed(rows)]
    finally:
        conn.close()

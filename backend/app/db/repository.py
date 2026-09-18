"""Repository functions for FinAlly's persistence layer.

Plain, module-level, synchronous functions — every call opens and closes its
own SQLite connection (see `connection.get_connection`). Route handlers must
wrap every call here in `await asyncio.to_thread(...)` to avoid blocking the
event loop. Every SQL statement uses `?` placeholders bound through the
`execute()` parameter tuple — never string interpolation of any kind.
"""

from __future__ import annotations

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

    Expects an already-normalized ticker. Deletes only from the `watchlist`
    table — removal is a display-list change, not a cascading purge, so this
    never touches `positions`, `trades`, `portfolio_snapshots`, or
    `chat_messages`. Returns whether a row was actually deleted (read from
    the cursor's `rowcount`), following this project's convention that
    absence is a return value, not an exception, and giving the route what
    it needs to distinguish a 204 from a 404.
    """
    conn = get_connection()
    try:
        with conn:
            cursor = conn.execute(
                "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            )
            return cursor.rowcount > 0
    finally:
        conn.close()

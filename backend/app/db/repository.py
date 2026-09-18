"""Repository functions for FinAlly's persistence layer.

Plain, module-level, synchronous functions — every call opens and closes its
own SQLite connection (see `connection.get_connection`). Route handlers must
wrap every call here in `await asyncio.to_thread(...)` to avoid blocking the
event loop. Every SQL statement uses `?` placeholders bound through the
`execute()` parameter tuple — never string interpolation of any kind.
"""

from __future__ import annotations

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

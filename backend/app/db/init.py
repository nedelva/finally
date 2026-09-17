"""Idempotent, lazy database initialization.

`init_db()` creates all tables if they don't already exist and seeds default data (the
`"default"` user profile and the ten default watchlist tickers) if `users_profile` is empty.
Safe to call on every app startup / first request.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.db.connection import get_connection
from app.db.schema import (
    ALL_TABLES,
    CREATE_INDEXES,
    DEFAULT_CASH_BALANCE,
    DEFAULT_USER_ID,
    DEFAULT_WATCHLIST_TICKERS,
)


def init_db() -> None:
    """Create tables if missing and seed default data if `users_profile` is empty."""
    conn = get_connection()
    try:
        with conn:
            for ddl in ALL_TABLES:
                conn.execute(ddl)
            for index_ddl in CREATE_INDEXES:
                conn.execute(index_ddl)

            row = conn.execute("SELECT COUNT(*) AS n FROM users_profile").fetchone()
            if row["n"] == 0:
                now = datetime.now(UTC).isoformat()
                conn.execute(
                    "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
                    (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, now),
                )
                for ticker in DEFAULT_WATCHLIST_TICKERS:
                    conn.execute(
                        "INSERT INTO watchlist (id, user_id, ticker, added_at) "
                        "VALUES (?, ?, ?, ?)",
                        (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, now),
                    )
    finally:
        conn.close()

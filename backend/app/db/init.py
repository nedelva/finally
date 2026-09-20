"""Lazy SQLite initialization: create tables and seed default data."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from app.db.connection import get_connection
from app.db.schema import ALL_TABLES, CREATE_INDEXES, DEFAULT_CASH_BALANCE, DEFAULT_USER_ID
from app.market import DEFAULT_TICKERS

logger = logging.getLogger(__name__)


def init_db() -> None:
    """Create tables if missing and seed default data if `users_profile` is empty.

    Idempotent: safe to call on every app startup. Creates all six PLAN.md §7
    tables (and their indexes) unconditionally, then seeds the default user
    profile and the ten-ticker default watchlist only the first time — once
    `users_profile` has at least one row, seeding is skipped on every
    subsequent call, so a restart never duplicates data or clobbers a user's
    own watchlist changes.
    """
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
                for ticker in DEFAULT_TICKERS:
                    conn.execute(
                        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                        (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, now),
                    )
                logger.info(
                    "Seeded default user profile and %d default watchlist tickers",
                    len(DEFAULT_TICKERS),
                )
    finally:
        conn.close()

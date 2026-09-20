"""SQLite schema DDL for FinAlly's persistence layer.

The single source of truth for table structure — every column name and type
below reproduces PLAN.md §7 verbatim. Every other module that needs table
structure imports these constants; none re-declares DDL.

Schema note: PLAN.md §7's preamble states "all tables include a `user_id`
column defaulting to `default`," but its own `users_profile` spec lists only
`id`, `cash_balance`, `created_at` — no `user_id` column. Resolved
deliberately: `users_profile.id` *is* the user key for that one table (a
profile row and a user are the same thing); the preamble describes the other
five tables, each of which carries a separate `user_id` column pointing at a
`users_profile.id`. Do not "fix" this by adding a redundant `user_id` column
to `users_profile`.
"""

from __future__ import annotations

CREATE_USERS_PROFILE = """
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
)
"""

CREATE_WATCHLIST = """
CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE (user_id, ticker)
)
"""

CREATE_POSITIONS = """
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_cost REAL NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, ticker)
)
"""

CREATE_TRADES = """
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    executed_at TEXT NOT NULL
)
"""

CREATE_PORTFOLIO_SNAPSHOTS = """
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    total_value REAL NOT NULL,
    recorded_at TEXT NOT NULL
)
"""

CREATE_CHAT_MESSAGES = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
)
"""

ALL_TABLES = [
    CREATE_USERS_PROFILE,
    CREATE_WATCHLIST,
    CREATE_POSITIONS,
    CREATE_TRADES,
    CREATE_PORTFOLIO_SNAPSHOTS,
    CREATE_CHAT_MESSAGES,
]

# Not specified by PLAN.md §7 — a reasonable addition for the per-user
# lookup patterns every later phase will use, not a requirement.
CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_positions_user ON positions (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_trades_user_executed ON trades (user_id, executed_at)",
    "CREATE INDEX IF NOT EXISTS idx_snapshots_user_recorded ON portfolio_snapshots (user_id, recorded_at)",
    "CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages (user_id, created_at)",
]

DEFAULT_USER_ID = "default"
DEFAULT_CASH_BALANCE = 10000.0

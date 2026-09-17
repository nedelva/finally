"""SQLite connection handling.

Uses stdlib `sqlite3` — no async driver needed for this single-user app. A fresh connection is
opened per call (rather than a shared global) so this is safe to use from FastAPI's threadpool
without connection-sharing bugs.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

# Project root is three levels up from this file: app/db/connection.py -> app/db -> app -> backend
# -> project root. We want `<project_root>/db/finally.db` by default.
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DB_PATH = _PROJECT_ROOT / "db" / "finally.db"


def get_db_path() -> Path:
    """Resolve the SQLite file path from the `DB_PATH` env var, defaulting to `db/finally.db`."""
    raw = os.environ.get("DB_PATH")
    return Path(raw) if raw else _DEFAULT_DB_PATH


def get_connection() -> sqlite3.Connection:
    """Open a new SQLite connection with sane defaults.

    - Creates the parent directory if it doesn't exist.
    - `row_factory = sqlite3.Row` for dict-like access.
    - `PRAGMA foreign_keys=ON`.
    - WAL journal mode for better concurrent read/write behavior.
    """
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

"""SQLite connection management for FinAlly's persistence layer.

One connection per call — `sqlite3.Connection` is not safe to share across
threads, the same reasoning `PriceCache` uses a lock for its shared dict.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

# Explicit escape hatch for the database file path. Also the seam tests use
# to isolate each test run against a temporary file instead of the real
# `db/finally.db`, mirroring `app.main`'s `FINALLY_STATIC_DIR` pattern.
DB_PATH_ENV_VAR = "FINALLY_DB_PATH"

_REPO_ROOT = Path(__file__).resolve().parents[3]


def get_db_path() -> Path:
    """Resolve the SQLite database file path.

    Resolution order:
      1. `FINALLY_DB_PATH` env var, if set and non-empty (stripped, expanded).
      2. `<repo_root>/db/finally.db` — the Docker volume mount target
         PLAN.md section 11 describes.
    """
    env_value = os.environ.get(DB_PATH_ENV_VAR, "").strip()
    if env_value:
        return Path(env_value).expanduser()

    return _REPO_ROOT / "db" / "finally.db"


def get_connection() -> sqlite3.Connection:
    """Open a new SQLite connection to the resolved database path.

    Creates the parent directory if missing (a fresh checkout has no `db/`
    contents until the first connection is opened). Sets `row_factory` to
    `sqlite3.Row` so query results convert cleanly to dicts, and enables WAL
    mode for better reader/writer concurrency with the future snapshot
    writer.
    """
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    return conn

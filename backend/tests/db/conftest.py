"""Fixtures for db module tests.

Every test gets an isolated SQLite file under `tmp_path`, so tests never touch the real
`db/finally.db`. We monkeypatch the `DB_PATH` env var (read lazily by `app.db.connection`)
rather than a global connection, matching how `get_connection()` resolves its path per call.
"""

from __future__ import annotations

import pytest

from app.db.init import init_db


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """Point DB_PATH at a fresh temp file for the duration of a test."""
    path = tmp_path / "test_finally.db"
    monkeypatch.setenv("DB_PATH", str(path))
    return path


@pytest.fixture
def initialized_db(db_path):
    """A DB_PATH pointed at a temp file with schema created and seed data loaded."""
    init_db()
    return db_path

"""Fixtures for the `app.db` test package."""

import pytest

from app.db import init_db


@pytest.fixture
def initialized_db(tmp_path, monkeypatch):
    """Point `FINALLY_DB_PATH` at a fresh temp file and run `init_db()` once."""
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    init_db()

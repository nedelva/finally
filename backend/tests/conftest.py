"""Pytest configuration and fixtures."""

import pytest


@pytest.fixture
def event_loop_policy():
    """Use the default event loop policy for all async tests."""
    import asyncio

    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture(autouse=True)
def isolate_finally_db(tmp_path, monkeypatch):
    """Point every test's SQLite database at a per-test temp file.

    `init_db()` now runs inside the app lifespan, and several existing tests
    enter `with TestClient(app) as client:`. Without this fixture the suite
    would write a real database into the repo checkout and share one file
    across tests, making seed-count and idempotency assertions
    order-dependent.
    """
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))

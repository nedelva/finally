"""Tests for `app.market.snapshot_task.snapshot_loop`.

Uses a short injected interval (never the real 30s) so these tests run in
milliseconds, and `monkeypatch` to substitute a raising recorder for the
error-resilience case rather than patching the clock.
"""

from __future__ import annotations

import asyncio

import pytest

from app.db import init_db
from app.db.connection import get_connection
from app.market import snapshot_task
from app.market.snapshot_task import SNAPSHOT_INTERVAL_SECONDS, snapshot_loop

# asyncio_mode is "auto" (see pyproject.toml) — async test functions are
# collected as asyncio tests automatically, so no `pytestmark` is needed
# (and applying one would warn on this module's sync tests).


@pytest.fixture
def initialized_db(tmp_path, monkeypatch):
    """Point `FINALLY_DB_PATH` at a fresh temp file and run `init_db()` once.

    Mirrors `tests/db/conftest.py`'s fixture of the same name — not shared
    across sibling test packages by pytest's conftest scoping rules, so it
    is duplicated here rather than imported.
    """
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    init_db()


def _count_snapshots() -> int:
    conn = get_connection()
    try:
        return conn.execute("SELECT COUNT(*) FROM portfolio_snapshots").fetchone()[0]
    finally:
        conn.close()


class TestSnapshotLoop:
    async def test_short_interval_writes_at_least_one_row(self, initialized_db):
        cache_stub = object()
        task = asyncio.create_task(snapshot_loop(cache_stub, interval=0.01))
        await asyncio.sleep(0.1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert _count_snapshots() >= 1

    async def test_raising_recorder_on_first_call_still_writes_on_a_later_iteration(
        self, initialized_db, monkeypatch
    ):
        calls = {"count": 0}

        def flaky_record_snapshot(price_cache):
            calls["count"] += 1
            if calls["count"] == 1:
                raise RuntimeError("simulated write failure")
            return {"total_value": 10000.0, "recorded_at": "2026-01-01T00:00:00+00:00"}

        monkeypatch.setattr(snapshot_task, "record_snapshot", flaky_record_snapshot)

        task = asyncio.create_task(snapshot_loop(object(), interval=0.01))
        await asyncio.sleep(0.1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        assert calls["count"] >= 2

    async def test_cancelling_the_task_raises_cancelled_error(self, initialized_db):
        task = asyncio.create_task(snapshot_loop(object(), interval=0.01))
        await asyncio.sleep(0.02)
        task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await task

    def test_snapshot_interval_seconds_is_thirty(self):
        assert SNAPSHOT_INTERVAL_SECONDS == 30.0

    def test_snapshot_loop_default_interval_is_the_constant(self):
        import inspect

        sig = inspect.signature(snapshot_loop)
        assert sig.parameters["interval"].default == SNAPSHOT_INTERVAL_SECONDS

"""Periodic portfolio-value snapshot background task.

Mirrors `simulator.py`'s `SimulatorDataSource._run_loop` shape (sleep, do
work, catch-log-continue) but is not itself a `MarketDataSource` — it writes
to `app.db.repository`, not to the `PriceCache`.

RED stub — `snapshot_loop` raises `NotImplementedError` after its first
sleep until Task 2's GREEN step.
"""

from __future__ import annotations

import asyncio
import logging

from app.db.repository import record_snapshot

logger = logging.getLogger(__name__)

SNAPSHOT_INTERVAL_SECONDS = 30.0


async def snapshot_loop(
    price_cache, interval: float = SNAPSHOT_INTERVAL_SECONDS
) -> None:
    """Record a `portfolio_snapshots` row every `interval` seconds, forever.

    RED stub — raises `NotImplementedError` until Task 2's GREEN step.
    `record_snapshot` is imported (not yet called) so tests can already
    monkeypatch it on this module.
    """
    while True:
        await asyncio.sleep(interval)
        raise NotImplementedError(record_snapshot)

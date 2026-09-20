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

    Mirrors `SimulatorDataSource._run_loop`'s shape: sleep, do work, catch
    and log a failure without exiting. Sleeping before the first write is
    deliberate — the post-trade writer (`execute_trade`) and the frontend's
    D-13 client-side bootstrap point already cover the first interval, so an
    immediate write at startup would add a duplicate. `asyncio.CancelledError`
    is re-raised immediately so `task.cancel()` still propagates to the
    awaiting caller (`main.py`'s lifespan); a broad `Exception` is logged and
    swallowed so one bad write can never silently end the history series.
    """
    while True:
        await asyncio.sleep(interval)
        try:
            await asyncio.to_thread(record_snapshot, price_cache)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Snapshot write failed; will retry next interval")

"""Watchlist REST routes.

This task wires only `GET /api/watchlist`. `POST /api/watchlist` (add) lands
in plan 02-02 and `DELETE /api/watchlist/{ticker}` (remove) lands in 02-03.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter

from app.db import get_watchlist
from app.market import PriceCache

logger = logging.getLogger(__name__)


def build_watchlist(price_cache: PriceCache) -> dict:
    """Join the persisted watchlist rows with live prices from the cache.

    For a ticker with no cache entry yet (e.g. added but not yet ticked by
    the market data source), emits nulls and `direction: "flat"` rather than
    a synthesized number — a null price is the honest answer, and the
    frontend already renders it as an empty cell.
    """
    entries = []
    for item in get_watchlist():
        ticker = item["ticker"]
        price_update = price_cache.get(ticker)
        if price_update is None:
            entries.append(
                {
                    "ticker": ticker,
                    "added_at": item["added_at"],
                    "price": None,
                    "previous_price": None,
                    "change": None,
                    "change_percent": None,
                    "direction": "flat",
                }
            )
        else:
            entries.append(
                {
                    "ticker": ticker,
                    "added_at": item["added_at"],
                    "price": price_update.price,
                    "previous_price": price_update.previous_price,
                    "change": price_update.change,
                    "change_percent": price_update.change_percent,
                    "direction": price_update.direction,
                }
            )
    return {"watchlist": entries}


def create_watchlist_router(price_cache: PriceCache) -> APIRouter:
    """Create the watchlist router with a reference to the price cache.

    Constructs a fresh `APIRouter` on every call, mirroring
    `create_stream_router`'s factory shape — this lets us inject the
    PriceCache without globals, and without two calls ever sharing route
    registrations.
    """
    router = APIRouter(prefix="/api", tags=["watchlist"])

    @router.get("/watchlist")
    async def get_watchlist_route() -> dict:
        """Return the current user's watchlist joined with live prices."""
        return await asyncio.to_thread(build_watchlist, price_cache)

    return router

"""Watchlist REST routes.

`GET /api/watchlist` (02-01), `POST /api/watchlist` (02-02), and
`DELETE /api/watchlist/{ticker}` (02-03) — the full CRUD surface for the
user's persisted watchlist.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import add_watchlist_ticker, get_watchlist, remove_watchlist_ticker
from app.market import PriceCache, is_valid_ticker_format, normalize_ticker

logger = logging.getLogger(__name__)


class WatchlistAddRequest(BaseModel):
    """Request body for `POST /api/watchlist`."""

    ticker: str


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

    @router.post("/watchlist")
    async def post_watchlist_route(body: WatchlistAddRequest, request: Request) -> JSONResponse:
        """Validate, persist, and start streaming a new watchlist ticker.

        Order of operations is load-bearing: normalize -> format-validate
        (no DB write, no notify on failure) -> persist (no notify on a
        duplicate) -> notify the running market data source so the next SSE
        frame carries the new ticker.
        """
        raw = body.ticker
        normalized = normalize_ticker(raw)
        if not is_valid_ticker_format(normalized):
            return JSONResponse(
                status_code=400,
                content={
                    "error": f"{raw} isn't a valid ticker — use 1-5 letters or numbers, "
                    "like AAPL."
                },
            )
        try:
            result = await asyncio.to_thread(add_watchlist_ticker, normalized)
        except ValueError:
            return JSONResponse(
                status_code=409,
                content={"error": f"{normalized} is already on your watchlist."},
            )
        try:
            await request.app.state.market_source.add_ticker(normalized)
        except Exception:
            # The DB write above already committed, so the ticker is
            # persisted watchlist state regardless of what happens here.
            # Log and still return success rather than surface a 500 for a
            # mutation that already succeeded — the price stream will pick
            # the ticker up on the next process restart (lifespan startup
            # reads tickers straight from the DB) even if the running
            # process's market source failed to add it live.
            logger.exception("Failed to notify market source of new ticker %s", normalized)
        return JSONResponse(status_code=201, content=result)

    @router.delete("/watchlist/{ticker}")
    async def delete_watchlist_route(ticker: str, request: Request) -> Response:
        """Remove a watchlist ticker and stop it streaming.

        Order of operations is load-bearing, mirroring the POST handler:
        normalize the path segment -> delete (no notify on a no-op absent
        delete) -> notify the running market data source so the ticker
        stops appearing in the next SSE frame. A 204 carries no body, so the
        frontend's 204 special-case in `removeWatchlistTicker` never
        attempts to parse one.
        """
        normalized = normalize_ticker(ticker)
        removed = await asyncio.to_thread(remove_watchlist_ticker, normalized)
        if not removed:
            return JSONResponse(
                status_code=404,
                content={"error": f"{normalized} is not on your watchlist."},
            )
        try:
            await request.app.state.market_source.remove_ticker(normalized)
        except Exception:
            # The DB delete above already committed, so the ticker is gone
            # from persisted watchlist state regardless of what happens
            # here. Log and still return success rather than surface a 500
            # for a mutation that already succeeded — worst case the price
            # stream keeps ticking this ticker until the next process
            # restart, which is a display-only inconsistency, not a data
            # integrity problem.
            logger.exception("Failed to notify market source of removed ticker %s", normalized)
        return Response(status_code=204)

    return router

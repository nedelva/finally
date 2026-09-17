"""FastAPI application entrypoint for FinAlly.

Wires together the DB module, the market data subsystem, and the LLM-backed chat route behind
a single FastAPI app served on one port, per `planning/PLAN.md` architecture.

Startup (via lifespan, not the deprecated `@app.on_event`):
    1. `init_db()` -- lazy schema creation + seed data.
    2. Start the module-level `PriceCache`-backed market data source against the current
       watchlist.
    3. Launch a background task that records a `portfolio_snapshots` row every 30 seconds.

Shutdown: cancel the snapshot task and stop the market data source cleanly.

Static frontend serving: mounted at `/` with `html=True`, AFTER all `/api/*` routes are
registered, and only if `backend/static/` exists (absent in local dev without a Docker build) --
see the bottom of `planning/API_CONTRACT.md`.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import chat_router, health_router, portfolio_router, watchlist_router
from app.api.portfolio import build_portfolio
from app.db import get_positions, get_watchlist, init_db, insert_snapshot
from app.market import PriceCache, create_market_data_source, create_stream_router

logger = logging.getLogger(__name__)

SNAPSHOT_INTERVAL_SECONDS = 30
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Module-level price cache: created once, shared by the SSE router (bound at import time) and
# every request handler (via `request.app.state.price_cache`).
price_cache = PriceCache()


def record_snapshot(cache: PriceCache) -> None:
    """Compute current portfolio value and write a `portfolio_snapshots` row.

    Shared by the startup snapshot (so `GET /api/portfolio/history` isn't empty for the first
    `SNAPSHOT_INTERVAL_SECONDS` after a fresh boot) and the periodic background loop.
    """
    portfolio = build_portfolio(cache)
    insert_snapshot(portfolio["total_value"])


async def _snapshot_loop() -> None:
    """Record a portfolio value snapshot every `SNAPSHOT_INTERVAL_SECONDS`."""
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
        try:
            record_snapshot(price_cache)
        except Exception:
            logger.exception("Failed to record scheduled portfolio snapshot")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()

    market_data_source = create_market_data_source(price_cache)
    # Track the union of watchlist tickers and *held position* tickers. A position can outlive
    # its watchlist entry (user removes it from the watchlist but still holds shares) -- without
    # this, the price cache would drop that ticker and the user could never sell it again. See
    # the docstring on `app.api.watchlist.remove_from_watchlist` for the companion half of this.
    watchlist_tickers = {item["ticker"] for item in get_watchlist()}
    position_tickers = {item["ticker"] for item in get_positions()}
    tickers = sorted(watchlist_tickers | position_tickers)
    await market_data_source.start(tickers)

    app.state.market_data_source = market_data_source

    try:
        record_snapshot(price_cache)
    except Exception:
        logger.exception("Failed to record startup portfolio snapshot")

    snapshot_task = asyncio.create_task(_snapshot_loop())

    try:
        yield
    finally:
        snapshot_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await snapshot_task
        await market_data_source.stop()


app = FastAPI(title="FinAlly API", lifespan=lifespan)
app.state.price_cache = price_cache

app.include_router(create_stream_router(price_cache))
app.include_router(health_router)
app.include_router(portfolio_router)
app.include_router(watchlist_router)
app.include_router(chat_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.info("Request validation failed for %s %s: %s", request.method, request.url, exc)
    return JSONResponse(status_code=400, content={"error": "Invalid request body"})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception while handling %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
else:
    logger.warning("Static frontend directory not found at %s -- skipping mount", STATIC_DIR)

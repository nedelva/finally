"""Watchlist routes: GET/POST /api/watchlist, DELETE /api/watchlist/{ticker}.

`add_to_watchlist` and `remove_from_watchlist` are the shared, importable building blocks
`app.api.chat` uses so watchlist mutation logic (DB write + market data source notification)
lives in exactly one place, per `planning/API_CONTRACT.md`.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.db import add_watchlist_ticker, get_positions, get_watchlist, remove_watchlist_ticker
from app.market import MarketDataSource, PriceCache

router = APIRouter(tags=["watchlist"])


class WatchlistAddRequest(BaseModel):
    ticker: str


def build_watchlist(price_cache: PriceCache) -> dict[str, Any]:
    """Compute the `GET /api/watchlist` response shape.

    A ticker not yet in the price cache (source just started) reports null price fields and a
    `"flat"` direction, per API_CONTRACT.md.
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


async def add_to_watchlist(ticker: str, market_data_source: MarketDataSource) -> dict[str, Any]:
    """Add `ticker` to the watchlist (DB) and start streaming it (market data source).

    Result shape: `{"success": bool, "ticker": str, "added_at": str|None, "error": str|None}`.
    """
    ticker = ticker.upper().strip()
    try:
        result = add_watchlist_ticker(ticker)
    except ValueError as exc:
        return {"success": False, "ticker": ticker, "added_at": None, "error": str(exc)}

    await market_data_source.add_ticker(ticker)
    return {"success": True, "ticker": ticker, "added_at": result["added_at"], "error": None}


async def remove_from_watchlist(
    ticker: str, market_data_source: MarketDataSource
) -> dict[str, Any]:
    """Remove `ticker` from the watchlist (DB) and stop streaming it (market data source).

    Deliberate deviation from the literal letter of API_CONTRACT.md ("must call
    `market_data_source.remove_ticker()`"): if the user still holds a *position* in `ticker`,
    we keep it in the market data source (skip `remove_ticker`) even though it's off the
    watchlist. Otherwise `PriceCache` loses the ticker's price entirely (`remove_ticker` calls
    `PriceCache.remove`), `GET /api/portfolio` silently freezes that position's P&L at the
    stale `avg_cost`, and `POST /api/portfolio/trade` sell rejects with "No live price
    available" -- the user would hold shares they can no longer sell. The watchlist row itself
    is still deleted per the contract; only the cache-eviction side effect is conditional.

    Result shape: `{"success": bool, "ticker": str, "error": str|None}`.
    """
    ticker = ticker.upper().strip()
    removed = remove_watchlist_ticker(ticker)
    if not removed:
        return {"success": False, "ticker": ticker, "error": f"{ticker} not in watchlist"}

    still_held = any(p["ticker"] == ticker for p in get_positions())
    if not still_held:
        await market_data_source.remove_ticker(ticker)

    return {"success": True, "ticker": ticker, "error": None}


@router.get("/api/watchlist")
async def get_watchlist_route(request: Request) -> dict[str, Any]:
    price_cache: PriceCache = request.app.state.price_cache
    return build_watchlist(price_cache)


@router.post("/api/watchlist")
async def post_watchlist(body: WatchlistAddRequest, request: Request) -> Any:
    market_data_source: MarketDataSource = request.app.state.market_data_source
    result = await add_to_watchlist(body.ticker, market_data_source)

    if not result["success"]:
        return JSONResponse(status_code=409, content={"error": result["error"]})

    return JSONResponse(
        status_code=201,
        content={"ticker": result["ticker"], "added_at": result["added_at"]},
    )


@router.delete("/api/watchlist/{ticker}")
async def delete_watchlist(ticker: str, request: Request) -> Any:
    market_data_source: MarketDataSource = request.app.state.market_data_source
    result = await remove_from_watchlist(ticker, market_data_source)

    if not result["success"]:
        return JSONResponse(status_code=404, content={"error": result["error"]})

    return Response(status_code=204)

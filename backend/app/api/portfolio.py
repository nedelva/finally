"""Portfolio and trade-execution REST routes.

`GET /api/portfolio` and `POST /api/portfolio/trade` — PORT-01/PORT-02/PORT-03
per PLAN.md §8. Mirrors `backend/app/api/watchlist.py`'s router-factory,
request-model, and ValueError-to-JSONResponse shape.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import execute_trade, get_cash_balance, get_positions
from app.market import PriceCache, normalize_ticker

logger = logging.getLogger(__name__)


class TradeRequest(BaseModel):
    """Request body for `POST /api/portfolio/trade`."""

    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


def build_portfolio(price_cache: PriceCache) -> dict:
    """Join persisted positions with live prices from the cache.

    A position whose ticker has no `PriceCache` entry falls back to its own
    `avg_cost` (D-03) so unrealized P&L reports honestly as 0.0 rather than
    null or a stale number. `total_value`'s round-then-sum order matches
    `app.db.repository.total_portfolio_value` exactly — both must agree to
    the cent for the same cache state, which is what this plan's
    snapshot-equals-REST truth asserts. Every emitted key matches `Position`
    and `Portfolio` in `frontend/lib/types.ts` exactly.
    """
    cash_balance = get_cash_balance()
    positions = []
    total_value = cash_balance
    total_unrealized_pnl = 0.0
    for row in get_positions():
        ticker = row["ticker"]
        avg_cost = row["avg_cost"]
        quantity = row["quantity"]
        live_price = price_cache.get_price(ticker)
        current_price = live_price if live_price is not None else avg_cost
        market_value = round(quantity * current_price, 2)
        unrealized_pnl = round((current_price - avg_cost) * quantity, 2)
        unrealized_pnl_percent = (
            round((current_price / avg_cost - 1) * 100, 4) if avg_cost > 0 else 0.0
        )
        positions.append(
            {
                "ticker": ticker,
                "quantity": quantity,
                "avg_cost": avg_cost,
                "current_price": current_price,
                "market_value": market_value,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_pnl_percent": unrealized_pnl_percent,
            }
        )
        total_value += market_value
        total_unrealized_pnl += unrealized_pnl
    return {
        "cash_balance": cash_balance,
        "positions": positions,
        "total_value": round(total_value, 2),
        "total_unrealized_pnl": round(total_unrealized_pnl, 2),
    }


def create_portfolio_router(price_cache: PriceCache) -> APIRouter:
    """Create the portfolio router with a reference to the price cache.

    Constructs a fresh `APIRouter` on every call, mirroring
    `create_watchlist_router`'s factory shape — this lets us inject the
    PriceCache without globals, and without two calls ever sharing route
    registrations.
    """
    router = APIRouter(prefix="/api", tags=["portfolio"])

    @router.get("/portfolio")
    async def get_portfolio_route() -> dict:
        """Return the current user's cash, positions and derived totals."""
        return await asyncio.to_thread(build_portfolio, price_cache)

    @router.post("/portfolio/trade")
    async def post_trade_route(body: TradeRequest) -> JSONResponse:
        """Validate, execute, and report a market-order trade.

        Order of operations mirrors `post_watchlist_route`: normalize the
        ticker before acting, translate a repository-level `ValueError` into
        a 400 with no `portfolio` key, and on success re-fetch the
        refreshed portfolio via its own `to_thread` call on its own line —
        never call `build_portfolio` inline inside the response literal,
        which would block the event loop on a repository-backed read.
        """
        normalized = normalize_ticker(body.ticker)
        try:
            trade = await asyncio.to_thread(
                execute_trade, price_cache, normalized, body.side, body.quantity
            )
        except ValueError as exc:
            return JSONResponse(status_code=400, content={"success": False, "error": str(exc)})
        portfolio = await asyncio.to_thread(build_portfolio, price_cache)
        return JSONResponse(
            status_code=200,
            content={"success": True, "trade": trade, "portfolio": portfolio},
        )

    return router

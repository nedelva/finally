"""Portfolio routes: GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history.

`execute_trade` and `build_portfolio` are the shared, importable building blocks other modules
(namely `app.api.chat`) use so trade execution and portfolio valuation logic lives in exactly one
place, per `planning/API_CONTRACT.md`.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import (
    apply_buy,
    apply_sell,
    get_cash_balance,
    get_positions,
    get_snapshots,
    insert_snapshot,
    insert_trade,
    set_cash_balance,
)
from app.market import PriceCache

router = APIRouter(tags=["portfolio"])

_QTY_EPSILON = 1e-9


class TradeRequest(BaseModel):
    ticker: str
    side: str
    quantity: float


def build_portfolio(price_cache: PriceCache) -> dict[str, Any]:
    """Compute the `GET /api/portfolio` response shape.

    Positions with no live price yet (cache miss) fall back to `avg_cost` as the current price
    and report zero unrealized P&L, per API_CONTRACT.md -- never raises on a missing price.
    """
    cash_balance = get_cash_balance()
    positions = get_positions()

    enriched_positions: list[dict[str, Any]] = []
    total_market_value = 0.0
    total_unrealized_pnl = 0.0

    for position in positions:
        ticker = position["ticker"]
        quantity = position["quantity"]
        avg_cost = position["avg_cost"]

        price_update = price_cache.get(ticker)
        if price_update is None:
            current_price = avg_cost
            unrealized_pnl = 0.0
            unrealized_pnl_percent = 0.0
        else:
            current_price = price_update.price
            cost_basis = quantity * avg_cost
            unrealized_pnl = quantity * (current_price - avg_cost)
            unrealized_pnl_percent = (
                (unrealized_pnl / cost_basis * 100) if cost_basis else 0.0
            )

        market_value = quantity * current_price
        total_market_value += market_value
        total_unrealized_pnl += unrealized_pnl

        enriched_positions.append(
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

    return {
        "cash_balance": cash_balance,
        "positions": enriched_positions,
        "total_value": cash_balance + total_market_value,
        "total_unrealized_pnl": total_unrealized_pnl,
    }


def execute_trade(
    ticker: str, side: str, quantity: float, price_cache: PriceCache
) -> dict[str, Any]:
    """Validate and execute a single trade. Never raises -- always returns a result dict.

    Result shape: `{"success": bool, "trade": dict|None, "error": str|None, "portfolio": dict|None}`.
    On success: upserts the position (weighted-average cost on buy), adjusts cash, appends to
    `trades`, and writes an immediate `portfolio_snapshots` row, as required by
    `planning/API_CONTRACT.md`.
    """
    ticker = ticker.upper().strip()
    side = side.lower().strip()

    if side not in ("buy", "sell"):
        return {"success": False, "trade": None, "error": f"Invalid side: {side}", "portfolio": None}
    if quantity <= 0:
        return {
            "success": False,
            "trade": None,
            "error": "Quantity must be a positive number",
            "portfolio": None,
        }

    price_update = price_cache.get(ticker)
    if price_update is None:
        return {
            "success": False,
            "trade": None,
            "error": f"No live price available for {ticker}",
            "portfolio": None,
        }
    price = price_update.price

    if side == "buy":
        cost = quantity * price
        cash_balance = get_cash_balance()
        if cost > cash_balance + _QTY_EPSILON:
            return {
                "success": False,
                "trade": None,
                "error": f"Insufficient cash: need ${cost:.2f}, have ${cash_balance:.2f}",
                "portfolio": None,
            }
        apply_buy(ticker, quantity, price)
        set_cash_balance(cash_balance - cost)
    else:
        try:
            apply_sell(ticker, quantity, price)
        except ValueError as exc:
            return {"success": False, "trade": None, "error": str(exc), "portfolio": None}
        cash_balance = get_cash_balance()
        set_cash_balance(cash_balance + quantity * price)

    trade = insert_trade(ticker, side, quantity, price)
    portfolio = build_portfolio(price_cache)
    insert_snapshot(portfolio["total_value"])

    return {"success": True, "trade": trade, "error": None, "portfolio": portfolio}


@router.get("/api/portfolio")
async def get_portfolio(request: Request) -> dict[str, Any]:
    price_cache: PriceCache = request.app.state.price_cache
    return build_portfolio(price_cache)


@router.post("/api/portfolio/trade")
async def post_trade(body: TradeRequest, request: Request) -> Any:
    price_cache: PriceCache = request.app.state.price_cache
    result = execute_trade(body.ticker, body.side, body.quantity, price_cache)

    if not result["success"]:
        return JSONResponse(status_code=400, content={"success": False, "error": result["error"]})

    return {
        "success": True,
        "trade": result["trade"],
        "portfolio": result["portfolio"],
    }


@router.get("/api/portfolio/history")
async def get_history() -> dict[str, Any]:
    return {"snapshots": get_snapshots()}

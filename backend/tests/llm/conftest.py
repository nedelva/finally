"""Fixtures for the `app.llm` test package."""

import pytest


@pytest.fixture
def frozen_portfolio() -> dict:
    """A frozen dict with `build_portfolio`'s exact key set.

    Figures are deliberately distinctive (not round numbers like 100.00)
    so a substring assertion on the rendered prompt context cannot pass by
    coincidence.
    """
    return {
        "cash_balance": 4321.55,
        "positions": [
            {
                "ticker": "AAPL",
                "quantity": 3.25,
                "avg_cost": 187.11,
                "current_price": 199.42,
                "market_value": 648.11,
                "unrealized_pnl": 40.01,
                "unrealized_pnl_percent": 6.58,
            }
        ],
        "total_value": 4969.66,
        "total_unrealized_pnl": 40.01,
    }


@pytest.fixture
def frozen_watchlist() -> dict:
    """A frozen dict with `build_watchlist`'s exact key set.

    One priced entry and one entry with a `None` price (added but not yet
    ticked by the market data source).
    """
    return {
        "watchlist": [
            {
                "ticker": "AAPL",
                "added_at": "2026-09-01T00:00:00+00:00",
                "price": 199.42,
                "previous_price": 198.10,
                "change": 1.32,
                "change_percent": 0.67,
                "direction": "up",
            },
            {
                "ticker": "PLTR",
                "added_at": "2026-09-20T00:00:00+00:00",
                "price": None,
                "previous_price": None,
                "change": None,
                "change_percent": None,
                "direction": "flat",
            },
        ]
    }

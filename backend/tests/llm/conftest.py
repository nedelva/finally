"""Shared fixtures for LLM module tests."""

import pytest


@pytest.fixture
def portfolio_context():
    """A representative portfolio_context dict, as backend-api-engineer would pass it."""
    return {
        "cash_balance": 8450.32,
        "positions": [
            {
                "ticker": "AAPL",
                "quantity": 10.0,
                "avg_cost": 185.20,
                "current_price": 190.50,
                "market_value": 1905.00,
                "unrealized_pnl": 53.00,
                "unrealized_pnl_percent": 2.86,
            },
            {
                "ticker": "TSLA",
                "quantity": 2.5,
                "avg_cost": 250.00,
                "current_price": 240.00,
                "market_value": 600.00,
                "unrealized_pnl": -25.00,
                "unrealized_pnl_percent": -4.0,
            },
        ],
        "total_value": 10955.32,
        "total_unrealized_pnl": 28.00,
        "watchlist": [
            {
                "ticker": "AAPL",
                "price": 190.50,
                "previous_price": 189.80,
                "change": 0.70,
                "change_percent": 0.37,
                "direction": "up",
            },
            {
                "ticker": "GOOGL",
                "price": 175.00,
                "previous_price": 176.00,
                "change": -1.00,
                "change_percent": -0.57,
                "direction": "down",
            },
            {
                "ticker": "NVDA",
                "price": None,
                "previous_price": None,
                "change": None,
                "change_percent": None,
                "direction": "flat",
            },
        ],
    }


@pytest.fixture
def empty_portfolio_context():
    """A context with no positions/watchlist -- fresh account state."""
    return {
        "cash_balance": 10000.0,
        "positions": [],
        "total_value": 10000.0,
        "total_unrealized_pnl": 0.0,
        "watchlist": [],
    }

"""Deterministic mock LLM response for `LLM_MOCK=true`.

No network call, no randomness — returns the same `ChatResponse` type the
real path returns so the route never branches on mock-versus-real.
"""

from __future__ import annotations

import re

from .schema import ChatResponse, TradeAction, WatchlistAction

_PORTFOLIO_KEYWORDS = ("portfolio", "cash", "position", "holding")

_GENERIC_REPLY = "Ask me about your portfolio, or tell me to buy, sell, or update your watchlist."

# Trade form: "buy"/"sell", a number, then a 1-5 character alphanumeric
# symbol immediately after — e.g. "buy 10 aapl". `findall` (not `search`) so
# a single message can propose more than one action, which is what makes the
# add-then-buy ordering behaviour testable under LLM_MOCK.
_TRADE_RE = re.compile(r"\b(buy|sell)\b\s+(\d+(?:\.\d+)?)\s+([a-z0-9]{1,5})\b")
# Watchlist form: "add"/"remove", then a 1-5 character alphanumeric symbol.
_WATCHLIST_RE = re.compile(r"\b(add|remove)\b\s+([a-z0-9]{1,5})\b")


def get_mock_response(user_message: str, portfolio_context: str, history: list[dict]) -> ChatResponse:
    """Route on lowercase keyword/regex matches against the user's message.

    Trade and watchlist matches are checked first so every dispatch path
    (CHAT-03/CHAT-04/CHAT-05) is reachable under `LLM_MOCK=true`; a message
    matching neither form falls through to the CHAT-02 grounding reply or the
    generic desk-analyst acknowledgement, exactly as before this plan.
    """
    lowered = user_message.lower()

    watchlist_changes = [
        WatchlistAction(ticker=symbol.upper(), action=action)
        for action, symbol in _WATCHLIST_RE.findall(lowered)
    ]
    trades = [
        TradeAction(ticker=symbol.upper(), side=side, quantity=float(quantity))
        for side, quantity, symbol in _TRADE_RE.findall(lowered)
    ]

    if watchlist_changes or trades:
        parts = [
            f"{change.action.capitalize()}ing {change.ticker} on your watchlist."
            for change in watchlist_changes
        ]
        parts += [
            f"{trade.side.capitalize()}ing {trade.quantity:g} shares of {trade.ticker}."
            for trade in trades
        ]
        return ChatResponse(
            message=" ".join(parts), trades=trades, watchlist_changes=watchlist_changes
        )

    if any(keyword in lowered for keyword in _PORTFOLIO_KEYWORDS):
        cash_line = next(
            (line for line in portfolio_context.splitlines() if line.startswith("Cash balance:")),
            "Cash balance: unknown",
        )
        cash_figure = cash_line.removeprefix("Cash balance: ").strip()
        position_count = sum(
            1 for line in portfolio_context.splitlines() if "shares @ avg cost" in line
        )
        message = f"Cash balance is {cash_figure}, across {position_count} position line(s)."
        return ChatResponse(message=message, trades=[], watchlist_changes=[])

    return ChatResponse(message=_GENERIC_REPLY, trades=[], watchlist_changes=[])

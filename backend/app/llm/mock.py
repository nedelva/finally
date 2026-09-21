"""Deterministic mock LLM response for `LLM_MOCK=true`.

No network call, no randomness — returns the same `ChatResponse` type the
real path returns so the route never branches on mock-versus-real. This
plan's mock always returns empty `trades` and `watchlist_changes`; 04-02
extends this function with the trade and watchlist branches.
"""

from __future__ import annotations

from .schema import ChatResponse

_PORTFOLIO_KEYWORDS = ("portfolio", "cash", "position", "holding")

_GENERIC_REPLY = "Ask me about your portfolio, or tell me to buy, sell, or update your watchlist."


def get_mock_response(user_message: str, portfolio_context: str, history: list[dict]) -> ChatResponse:
    """Route on a lowercase keyword match against the user's message.

    When the message mentions the portfolio, cash, positions or holdings,
    echo the cash figure and the position count read out of
    `portfolio_context` — this is what makes CHAT-02 grounding assertable
    at route level under mock mode. Otherwise return a short generic
    desk-analyst acknowledgement.
    """
    lowered = user_message.lower()
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

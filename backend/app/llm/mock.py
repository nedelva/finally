"""Deterministic mock chat responses, used when ``LLM_MOCK=true``.

Enables fast, free, reproducible E2E tests (PLAN.md section 12) without calling
OpenRouter. This is intentionally simple keyword matching, not an LLM -- it just
needs to exercise the trade / watchlist-action code paths deterministically.

Trigger keywords (case-insensitive, checked in this order -- first match wins):

1. **"buy"** -- looks for a ticker symbol in the message (preferring a ticker
   already on the watchlist, falling back to any bare 1-5 letter uppercase token
   in the original message, e.g. "buy AAPL" or "buy 5 TSLA"). If a ticker is
   found, proposes a ``TradeAction(ticker, side="buy", quantity=1)``. If no
   ticker can be identified, falls through to the canned analytical response.
2. **"sell"** -- looks for a ticker among the user's *current positions*
   (preferring a whole-word match against held tickers, falling back to a bare
   uppercase token). If the user holds a matching position, proposes selling
   the entire position (``quantity`` = the held quantity). If the ticker isn't
   held, falls through to the canned analytical response.
3. **"unwatch"** or **"remove"** -- checked before "watch" so that a message
   like "remove GOOGL from my watchlist" (which contains both "remove" and
   "watch") is correctly treated as a removal, not an add. Looks for a ticker
   token and proposes ``WatchlistAction(ticker, action="remove")``.
4. **"watch"** (but not "watchlist" alone with no ticker, and not already
   claimed by branch 3 above) -- looks for a ticker token in the message and
   proposes ``WatchlistAction(ticker, action="add")``.
5. Otherwise -- returns a canned analytical message referencing
   ``portfolio_context["total_value"]`` and ``portfolio_context["cash_balance"]``,
   with empty ``trades`` and ``watchlist_changes``.

Ticker extraction never guesses randomly: if no recognizable ticker is present,
no action is proposed and the canned response is returned instead. A small
stopword list (see `_STOPWORDS`) filters out common uppercase English words
("I", "OK", "THE", ...) and the trigger keywords themselves so they aren't
mistaken for tickers when no real one is present.
"""

import re

from .schema import ChatResponse, TradeAction, WatchlistAction

_BARE_TICKER_RE = re.compile(r"\b[A-Z]{1,5}\b")

# Short uppercase words that show up in ordinary English prose ("I", "OK") or as
# emphasis (all-caps "THE") and would otherwise be mistaken for a ticker symbol.
_STOPWORDS = {
    "I", "A", "OK", "AM", "PM", "USD", "ALL", "THE", "MY", "IT", "NO", "YES",
    "AI", "TO", "IS", "BUY", "SELL", "ADD", "NOW", "FOR", "AND", "ARE", "CAN",
}


def _bare_ticker(message: str) -> str | None:
    """Find a bare 1-5 letter uppercase token in the original (case-sensitive) text.

    Skips common uppercase English words/abbreviations (see `_STOPWORDS`) so
    prose like "I want to buy more" doesn't get misread as a ticker "I".
    """
    for match in _BARE_TICKER_RE.finditer(message):
        token = match.group(0)
        if token not in _STOPWORDS:
            return token
    return None


def _ticker_from_candidates(upper_message: str, candidates: list[str]) -> str | None:
    """Find a whole-word match for one of `candidates` (already uppercase) in the message."""
    for ticker in candidates:
        if re.search(rf"\b{re.escape(ticker)}\b", upper_message):
            return ticker
    return None


def _extract_ticker(message: str, candidates: list[str]) -> str | None:
    upper_message = message.upper()
    ticker = _ticker_from_candidates(upper_message, candidates)
    if ticker:
        return ticker
    return _bare_ticker(message)


def get_mock_response(
    user_message: str,
    portfolio_context: dict,
    history: list[dict],
) -> ChatResponse:
    """Deterministic, keyword-matched stand-in for the real LLM call."""
    lowered = user_message.lower()
    watchlist_tickers = [
        w.get("ticker", "").upper() for w in (portfolio_context.get("watchlist") or [])
    ]
    positions = portfolio_context.get("positions") or []
    position_tickers = [p.get("ticker", "").upper() for p in positions]

    if "buy" in lowered:
        ticker = _extract_ticker(user_message, watchlist_tickers)
        if ticker:
            return ChatResponse(
                message=f"Buying 1 share of {ticker} at the current market price.",
                trades=[TradeAction(ticker=ticker, side="buy", quantity=1)],
                watchlist_changes=[],
            )

    if "sell" in lowered:
        ticker = _extract_ticker(user_message, position_tickers)
        if ticker:
            held = next(
                (p for p in positions if p.get("ticker", "").upper() == ticker),
                None,
            )
            quantity = held.get("quantity") if held else None
            if quantity:
                return ChatResponse(
                    message=f"Selling your full position in {ticker} ({quantity} shares).",
                    trades=[TradeAction(ticker=ticker, side="sell", quantity=quantity)],
                    watchlist_changes=[],
                )

    if "unwatch" in lowered or "remove" in lowered:
        ticker = _extract_ticker(user_message, watchlist_tickers)
        if ticker:
            return ChatResponse(
                message=f"Removing {ticker} from your watchlist.",
                trades=[],
                watchlist_changes=[WatchlistAction(ticker=ticker, action="remove")],
            )

    if "watch" in lowered:
        ticker = _extract_ticker(user_message, watchlist_tickers)
        if ticker:
            return ChatResponse(
                message=f"Adding {ticker} to your watchlist.",
                trades=[],
                watchlist_changes=[WatchlistAction(ticker=ticker, action="add")],
            )

    total_value = portfolio_context.get("total_value")
    cash_balance = portfolio_context.get("cash_balance")
    value_part = (
        f"your portfolio is worth ${total_value:,.2f}"
        if total_value is not None
        else "your total value isn't available right now"
    )
    cash_part = (
        f", with ${cash_balance:,.2f} in cash available to deploy."
        if cash_balance is not None
        else "."
    )
    return ChatResponse(
        message=f"Here's a quick snapshot: {value_part}{cash_part}",
        trades=[],
        watchlist_changes=[],
    )

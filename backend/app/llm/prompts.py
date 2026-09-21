"""System prompt, portfolio-context rendering, and message-array construction.

`render_portfolio_context` takes the exact dicts `build_portfolio(price_cache)`
(`app.api.portfolio`) and `build_watchlist(price_cache)` (`app.api.watchlist`)
already return — this module never re-derives a portfolio/watchlist view of
its own, so the assistant's numbers can never drift from what the rest of the
terminal shows (CHAT-02).
"""

from __future__ import annotations

# D-07: most-recent conversation turns sent to the model.
HISTORY_LIMIT = 10

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant embedded in a simulated-money \
trading terminal.

Voice: speak like a terse desk analyst. Short, numbers-first sentences. \
No filler openers ("Great question!"), no restating the user's question back \
to them, minimal pleasantries.

Capabilities: you can analyse the user's portfolio composition, risk \
concentration, and P&L using the account context below, and you can request \
trades and watchlist changes — the server executes anything you propose.

Action policy: only propose a trade when the user's own message asks for \
that specific trade, or clearly agrees to a trade you proposed in an earlier \
turn. Never propose an action and execute it in the same turn — if the user \
hasn't asked, suggest it and wait. The exact same rule governs watchlist \
changes: there is no looser rule for watchlist edits just because they carry \
no financial risk.

Output: always respond with valid JSON matching the provided schema. Leave \
`trades` and `watchlist_changes` as empty arrays whenever no action is \
warranted.
"""


def render_portfolio_context(portfolio: dict, watchlist: dict) -> str:
    """Render one plain-text block describing the user's account state.

    Every money figure is formatted to 2 decimals so the numbers the model
    reads match what the terminal itself renders. A watchlist entry whose
    `price` is `None` is marked explicitly (rather than printing a bare
    `None` or a synthesized `0.00`) because that null is the honest answer
    for a ticker added but not yet ticked by the market data source — see
    `build_watchlist`'s own docstring for why that state is legitimate, not
    an error.
    """
    lines: list[str] = []
    lines.append(f"Cash balance: ${portfolio['cash_balance']:.2f}")
    lines.append(f"Total portfolio value: ${portfolio['total_value']:.2f}")
    lines.append(f"Total unrealized P&L: ${portfolio['total_unrealized_pnl']:.2f}")

    positions = portfolio["positions"]
    if positions:
        lines.append("Positions:")
        for position in positions:
            lines.append(
                f"  - {position['ticker']}: {position['quantity']} shares @ avg cost "
                f"${position['avg_cost']:.2f}, current price ${position['current_price']:.2f}, "
                f"unrealized P&L ${position['unrealized_pnl']:.2f} "
                f"({position['unrealized_pnl_percent']:.2f}%)"
            )
    else:
        lines.append("Positions: none")

    entries = watchlist["watchlist"]
    if entries:
        lines.append("Watchlist:")
        for entry in entries:
            if entry["price"] is None:
                lines.append(f"  - {entry['ticker']}: no live price yet")
            else:
                lines.append(f"  - {entry['ticker']}: ${entry['price']:.2f}")
    else:
        lines.append("Watchlist: empty")

    return "\n".join(lines)


def build_messages(user_message: str, portfolio_context: str, history: list[dict]) -> list[dict]:
    """Build the LiteLLM `messages` array for one chat turn.

    Order: a `system` turn holding `SYSTEM_PROMPT` followed by the rendered
    portfolio context, then each history entry mapped to
    `{"role": ..., "content": ...}` oldest first, then the new `user` turn.
    """
    messages: list[dict] = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\n{portfolio_context}"}
    ]
    for entry in history:
        messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages

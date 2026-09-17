"""Prompt construction for the FinAlly chat LLM.

Builds the ``messages`` list handed to ``litellm.completion()``: a system message
establishing the assistant's persona and behavior (per PLAN.md section 9), a
rendering of the current portfolio context, the prior conversation history, and
the new user message appended last.
"""

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant embedded in a simulated \
trading workstation. You help the user understand and manage a virtual portfolio.

Your responsibilities:
- Analyze portfolio composition, risk concentration, and profit/loss.
- Suggest trades with clear, data-driven reasoning.
- Execute trades when the user asks for them, or agrees to a suggestion you made.
- Manage the watchlist proactively -- add tickers worth tracking, remove ones that \
no longer matter to the conversation.
- Be concise. Prefer specific numbers over vague language.
- Always respond with valid structured JSON matching the required schema. Never \
include prose outside the JSON.

This is a simulated environment with fake money and no fees, so there is no need \
to ask for confirmation before proposing trades -- if the user asks for a trade or \
clearly agrees to one, include it in the `trades` list and it will be executed \
automatically. Only propose trades or watchlist changes when they are actually \
warranted by the conversation; leave `trades` and `watchlist_changes` empty \
otherwise.
"""


def _format_money(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"${value:,.2f}"


def _format_percent(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:+.2f}%"


def render_portfolio_context(portfolio_context: dict) -> str:
    """Render the portfolio context dict into readable text for the prompt.

    Expected shape (a merge of GET /api/portfolio and GET /api/watchlist per
    API_CONTRACT.md): cash_balance, positions (list of ticker/quantity/avg_cost/
    current_price/market_value/unrealized_pnl/unrealized_pnl_percent), total_value,
    total_unrealized_pnl, watchlist (list of ticker/price/change_percent/...).

    Missing keys are tolerated -- callers may pass a partial context.
    """
    cash = portfolio_context.get("cash_balance")
    total_value = portfolio_context.get("total_value")
    total_pnl = portfolio_context.get("total_unrealized_pnl")
    positions = portfolio_context.get("positions") or []
    watchlist = portfolio_context.get("watchlist") or []

    lines = ["## Current Portfolio"]
    lines.append(f"Cash balance: {_format_money(cash)}")
    lines.append(f"Total portfolio value: {_format_money(total_value)}")
    lines.append(f"Total unrealized P&L: {_format_money(total_pnl)}")

    if positions:
        lines.append("\n### Positions")
        for p in positions:
            lines.append(
                f"- {p.get('ticker')}: {p.get('quantity')} shares @ avg cost "
                f"{_format_money(p.get('avg_cost'))}, current price "
                f"{_format_money(p.get('current_price'))}, market value "
                f"{_format_money(p.get('market_value'))}, unrealized P&L "
                f"{_format_money(p.get('unrealized_pnl'))} "
                f"({_format_percent(p.get('unrealized_pnl_percent'))})"
            )
    else:
        lines.append("\n### Positions\n(none)")

    if watchlist:
        lines.append("\n### Watchlist")
        for w in watchlist:
            lines.append(
                f"- {w.get('ticker')}: {_format_money(w.get('price'))} "
                f"({_format_percent(w.get('change_percent'))}, "
                f"{w.get('direction', 'flat')})"
            )
    else:
        lines.append("\n### Watchlist\n(empty)")

    return "\n".join(lines)


def build_messages(
    user_message: str,
    portfolio_context: dict,
    history: list[dict],
) -> list[dict]:
    """Build the full messages list for the completion() call.

    Order: system prompt (persona + portfolio context) -> conversation history
    (as-is, most recent last) -> the new user message.
    """
    system_content = SYSTEM_PROMPT + "\n\n" + render_portfolio_context(portfolio_context)

    messages: list[dict] = [{"role": "system", "content": system_content}]

    for turn in history:
        role = turn.get("role")
        content = turn.get("content", "")
        if role not in ("user", "assistant"):
            continue
        messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    return messages

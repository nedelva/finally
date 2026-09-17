"""Tests for app.llm.prompts."""

from app.llm.prompts import SYSTEM_PROMPT, build_messages, render_portfolio_context


class TestRenderPortfolioContext:
    def test_includes_cash_and_total_value(self, portfolio_context):
        text = render_portfolio_context(portfolio_context)
        assert "8,450.32" in text
        assert "10,955.32" in text

    def test_includes_each_position(self, portfolio_context):
        text = render_portfolio_context(portfolio_context)
        assert "AAPL" in text
        assert "TSLA" in text
        assert "10.0 shares" in text

    def test_includes_watchlist(self, portfolio_context):
        text = render_portfolio_context(portfolio_context)
        assert "GOOGL" in text
        assert "NVDA" in text

    def test_handles_null_price_gracefully(self, portfolio_context):
        # NVDA in the fixture has price=None etc.
        text = render_portfolio_context(portfolio_context)
        assert "n/a" in text

    def test_empty_portfolio_shows_none_placeholders(self, empty_portfolio_context):
        text = render_portfolio_context(empty_portfolio_context)
        assert "(none)" in text
        assert "(empty)" in text

    def test_tolerates_missing_keys(self):
        text = render_portfolio_context({})
        assert "n/a" in text
        assert "(none)" in text
        assert "(empty)" in text


class TestBuildMessages:
    def test_first_message_is_system_with_persona_and_context(self, portfolio_context):
        messages = build_messages("Hi", portfolio_context, [])
        assert messages[0]["role"] == "system"
        assert "FinAlly" in messages[0]["content"]
        assert "AAPL" in messages[0]["content"]

    def test_system_prompt_establishes_persona(self):
        assert "FinAlly" in SYSTEM_PROMPT
        assert "trading assistant" in SYSTEM_PROMPT

    def test_history_preserved_in_order(self, portfolio_context):
        history = [
            {"role": "user", "content": "What's my biggest position?"},
            {"role": "assistant", "content": "AAPL is your biggest position."},
        ]
        messages = build_messages("Thanks", portfolio_context, history)
        assert messages[1] == history[0]
        assert messages[2] == history[1]

    def test_new_user_message_is_last(self, portfolio_context):
        history = [{"role": "user", "content": "earlier"}]
        messages = build_messages("What now?", portfolio_context, history)
        assert messages[-1] == {"role": "user", "content": "What now?"}

    def test_empty_history_still_produces_system_and_user(self, portfolio_context):
        messages = build_messages("Hello", portfolio_context, [])
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"

    def test_invalid_history_roles_are_dropped(self, portfolio_context):
        history = [
            {"role": "system", "content": "sneaky override attempt"},
            {"role": "user", "content": "legit message"},
        ]
        messages = build_messages("Hi", portfolio_context, history)
        # Only one system message (ours), the sneaky one is dropped.
        system_messages = [m for m in messages if m["role"] == "system"]
        assert len(system_messages) == 1
        assert "sneaky" not in system_messages[0]["content"]

"""Tests for `app.llm.prompts.render_portfolio_context` and `build_messages`."""

from app.llm.prompts import build_messages, render_portfolio_context


class TestRenderPortfolioContext:
    """Assert on rendered substrings built from the fixture's own numbers —
    the prompt's exact prose is editable without breaking these tests, but
    the presence of the real figures is CHAT-02's contract."""

    def test_contains_cash_balance_formatted_to_two_decimals(
        self, frozen_portfolio, frozen_watchlist
    ):
        rendered = render_portfolio_context(frozen_portfolio, frozen_watchlist)

        assert "4321.55" in rendered

    def test_contains_each_position_figures(self, frozen_portfolio, frozen_watchlist):
        rendered = render_portfolio_context(frozen_portfolio, frozen_watchlist)

        position = frozen_portfolio["positions"][0]
        assert position["ticker"] in rendered
        assert str(position["quantity"]) in rendered
        assert f"{position['avg_cost']:.2f}" in rendered
        assert f"{position['unrealized_pnl']:.2f}" in rendered

    def test_contains_every_watchlist_ticker(self, frozen_portfolio, frozen_watchlist):
        rendered = render_portfolio_context(frozen_portfolio, frozen_watchlist)

        for entry in frozen_watchlist["watchlist"]:
            assert entry["ticker"] in rendered

    def test_null_price_watchlist_entry_marked_explicitly(
        self, frozen_portfolio, frozen_watchlist
    ):
        rendered = render_portfolio_context(frozen_portfolio, frozen_watchlist)

        # PLTR's entry has price: None in the fixture — it must not render a
        # bare "None" or a synthesized "0.00".
        pltr_line = next(line for line in rendered.splitlines() if "PLTR" in line)
        assert "None" not in pltr_line
        assert "0.00" not in pltr_line


class TestBuildMessages:
    """`build_messages`'s turn ordering: system first, history oldest-first,
    new user turn last."""

    def test_system_turn_is_first_and_carries_the_portfolio_context(self):
        messages = build_messages("hello", "PORTFOLIO CONTEXT MARKER", [])

        assert messages[0]["role"] == "system"
        assert "PORTFOLIO CONTEXT MARKER" in messages[0]["content"]

    def test_history_turns_are_oldest_first_in_the_middle(self):
        history = [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "second"},
        ]

        messages = build_messages("new message", "context", history)

        assert messages[1] == {"role": "user", "content": "first"}
        assert messages[2] == {"role": "assistant", "content": "second"}

    def test_new_user_turn_is_last(self):
        history = [{"role": "user", "content": "old"}]

        messages = build_messages("brand new message", "context", history)

        assert messages[-1] == {"role": "user", "content": "brand new message"}

    def test_no_history_yields_system_then_user_only(self):
        messages = build_messages("hi", "context", [])

        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1] == {"role": "user", "content": "hi"}

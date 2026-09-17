"""Tests for app.llm.client.get_chat_response.

Only exercises LLM_MOCK=true paths -- no network calls to OpenRouter are made or
permitted in this test suite (no API key is available in this environment).
"""

import pytest

from app.llm.client import get_chat_response
from app.llm.schema import ChatResponse


@pytest.fixture(autouse=True)
def mock_mode(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")


class TestGetChatResponseMockMode:
    def test_returns_chat_response_instance(self, portfolio_context):
        result = get_chat_response("What's my biggest position?", portfolio_context, [])
        assert isinstance(result, ChatResponse)

    def test_plain_message_has_no_actions(self, portfolio_context):
        result = get_chat_response("How am I doing overall?", portfolio_context, [])
        assert result.trades == []
        assert result.watchlist_changes == []
        assert result.message

    def test_buy_message_produces_trade_action(self, portfolio_context):
        result = get_chat_response("buy AAPL", portfolio_context, [])
        assert len(result.trades) == 1
        assert result.trades[0].ticker == "AAPL"
        assert result.trades[0].side == "buy"

    def test_sell_message_produces_trade_action(self, portfolio_context):
        result = get_chat_response("sell TSLA", portfolio_context, [])
        assert len(result.trades) == 1
        assert result.trades[0].side == "sell"

    def test_watch_message_produces_watchlist_action(self, portfolio_context):
        result = get_chat_response("watch MSFT", portfolio_context, [])
        assert len(result.watchlist_changes) == 1
        assert result.watchlist_changes[0].action == "add"

    def test_history_is_accepted_and_ignored_by_mock(self, portfolio_context):
        history = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello, how can I help?"},
        ]
        result = get_chat_response("hi again", portfolio_context, history)
        assert isinstance(result, ChatResponse)

    def test_no_network_call_needed(self, portfolio_context, monkeypatch):
        """Sanity check that the real completion() is never invoked in mock mode."""
        import app.llm.client as client_module

        def _boom(*args, **kwargs):
            raise AssertionError("completion() must not be called when LLM_MOCK=true")

        monkeypatch.setattr(client_module, "completion", _boom)
        result = get_chat_response("buy AAPL", portfolio_context, [])
        assert isinstance(result, ChatResponse)


class TestGetChatResponseNonMockMode:
    def test_mock_mode_check_reads_env_each_call(self, portfolio_context, monkeypatch):
        """LLM_MOCK is re-checked per call, not cached at import time."""
        monkeypatch.setenv("LLM_MOCK", "false")

        import app.llm.client as client_module

        def _boom(*args, **kwargs):
            raise AssertionError("should not reach network call in this test")

        # We don't actually want to call the network; just confirm that with
        # LLM_MOCK=false the client attempts the real path (raises because our
        # stub isn't a real completion() and we intentionally don't exercise it
        # further -- this test only proves the branch selection, not the network
        # call itself).
        monkeypatch.setattr(client_module, "completion", _boom)
        with pytest.raises(AssertionError):
            get_chat_response("hello", portfolio_context, [])

    @staticmethod
    def _stub_completion(content):
        """Build a fake completion() that returns `content` as the message body."""

        class _Message:
            pass

        class _Choice:
            pass

        class _Response:
            pass

        message = _Message()
        message.content = content
        choice = _Choice()
        choice.message = message
        response = _Response()
        response.choices = [choice]

        def _stub(*args, **kwargs):
            return response

        return _stub

    def test_malformed_json_falls_back_to_apologetic_response(
        self, portfolio_context, monkeypatch
    ):
        """A non-JSON / schema-violating LLM response must not raise -- it must
        degrade to an apologetic ChatResponse with no actions, per PLAN.md section 9
        ("a chat failure must never 500 the whole endpoint if avoidable")."""
        monkeypatch.setenv("LLM_MOCK", "false")
        import app.llm.client as client_module

        monkeypatch.setattr(
            client_module, "completion", self._stub_completion("not valid json at all")
        )

        result = get_chat_response("hello", portfolio_context, [])

        assert isinstance(result, ChatResponse)
        assert result.trades == []
        assert result.watchlist_changes == []
        assert result.message == client_module._FALLBACK_MESSAGE

    def test_empty_choices_falls_back_to_apologetic_response(
        self, portfolio_context, monkeypatch
    ):
        """An empty `choices` list (content extraction itself failing) must also
        degrade gracefully instead of raising IndexError."""
        monkeypatch.setenv("LLM_MOCK", "false")
        import app.llm.client as client_module

        class _EmptyResponse:
            choices = []

        monkeypatch.setattr(
            client_module, "completion", lambda *a, **k: _EmptyResponse()
        )

        result = get_chat_response("hello", portfolio_context, [])

        assert isinstance(result, ChatResponse)
        assert result.trades == []
        assert result.watchlist_changes == []
        assert result.message == client_module._FALLBACK_MESSAGE

    def test_valid_structured_response_is_parsed(self, portfolio_context, monkeypatch):
        monkeypatch.setenv("LLM_MOCK", "false")
        import app.llm.client as client_module

        valid_json = (
            '{"message": "Buying AAPL.", '
            '"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}], '
            '"watchlist_changes": []}'
        )
        monkeypatch.setattr(client_module, "completion", self._stub_completion(valid_json))

        result = get_chat_response("buy AAPL", portfolio_context, [])

        assert result.message == "Buying AAPL."
        assert len(result.trades) == 1
        assert result.trades[0].ticker == "AAPL"

"""Tests for `app.llm.client.get_chat_response`'s three branches.

`completion` is patched on `app.llm.client` — the name as imported into
that module — not on `litellm.completion` at its source, since
`client.py` already holds its own bound reference by the time any test
runs.
"""

from __future__ import annotations

import app.llm.client as client_module
from app.llm.schema import ChatResponse


class _FakeChoice:
    def __init__(self, content: str) -> None:
        self.message = type("Message", (), {"content": content})()


class _FakeCompletionResponse:
    def __init__(self, content: str) -> None:
        self.choices = [_FakeChoice(content)]


class TestGetChatResponseFailureBranches:
    """Neither failure branch may raise — both must degrade to a fallback
    `ChatResponse` with a non-empty message and empty action lists."""

    def test_completion_raising_returns_fallback_response(self, monkeypatch):
        monkeypatch.delenv("LLM_MOCK", raising=False)

        def _raise(*args, **kwargs):
            raise RuntimeError("simulated auth/transport failure")

        monkeypatch.setattr(client_module, "completion", _raise)

        result = client_module.get_chat_response("hi", "context", [])

        assert isinstance(result, ChatResponse)
        assert result.message != ""
        assert result.trades == []
        assert result.watchlist_changes == []

    def test_completion_returning_unparseable_content_returns_fallback_response(
        self, monkeypatch
    ):
        monkeypatch.delenv("LLM_MOCK", raising=False)

        def _fake_completion(*args, **kwargs):
            return _FakeCompletionResponse("not valid json at all")

        monkeypatch.setattr(client_module, "completion", _fake_completion)

        result = client_module.get_chat_response("hi", "context", [])

        assert isinstance(result, ChatResponse)
        assert result.message != ""
        assert result.trades == []
        assert result.watchlist_changes == []


class TestGetChatResponseMockBranch:
    """When `LLM_MOCK` is `"true"` (the autouse default for this suite),
    `completion` must never be reached."""

    def test_mock_mode_never_calls_completion(self, monkeypatch):
        def _fail_if_called(*args, **kwargs):
            raise AssertionError("completion() should not be called while LLM_MOCK=true")

        monkeypatch.setattr(client_module, "completion", _fail_if_called)

        result = client_module.get_chat_response("hi", "Cash balance: $100.00", [])

        assert isinstance(result, ChatResponse)

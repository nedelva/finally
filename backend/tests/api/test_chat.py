"""Tests for POST /api/chat.

Runs with LLM_MOCK=true (set by the `temp_db` fixture) so responses come from
`app.llm.mock.get_mock_response` deterministically -- see that module's docstring for the exact
keyword-matching rules being relied on here.
"""

import json

from app.db import get_recent_chat_messages


def test_chat_returns_message_and_empty_action_lists_by_default(client):
    response = client.post("/api/chat", json={"message": "what's my portfolio worth?"})
    assert response.status_code == 200
    body = response.json()
    assert "message" in body
    assert body["trades"] == []
    assert body["watchlist_changes"] == []


def test_chat_happy_path_trade_executes_and_shows_up_in_portfolio(client, price_cache):
    price_cache.update("AAPL", 190.50)  # AAPL is on the default watchlist

    response = client.post("/api/chat", json={"message": "buy AAPL"})
    assert response.status_code == 200
    body = response.json()

    assert len(body["trades"]) == 1
    trade = body["trades"][0]
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["status"] == "executed"
    assert trade["price"] == 190.50
    assert trade["error"] is None

    portfolio = client.get("/api/portfolio").json()
    assert len(portfolio["positions"]) == 1
    assert portfolio["positions"][0]["ticker"] == "AAPL"
    assert portfolio["positions"][0]["quantity"] == 1


def test_chat_trade_failure_is_reported_as_failed_not_500(client):
    # No live price for AAPL in the cache -> the proposed trade fails validation.
    response = client.post("/api/chat", json={"message": "buy AAPL"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["trades"]) == 1
    trade = body["trades"][0]
    assert trade["status"] == "failed"
    assert trade["error"] == "No live price available for AAPL"
    assert trade["price"] is None

    # Nothing was executed.
    portfolio = client.get("/api/portfolio").json()
    assert portfolio["positions"] == []


def test_chat_watchlist_action_executes(client, market_source):
    response = client.post("/api/chat", json={"message": "remove AAPL"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["watchlist_changes"]) == 1
    change = body["watchlist_changes"][0]
    assert change["ticker"] == "AAPL"
    assert change["action"] == "remove"
    assert change["status"] == "executed"
    assert "AAPL" in market_source.removed

    watchlist_tickers = {e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]}
    assert "AAPL" not in watchlist_tickers


def test_chat_persists_user_and_assistant_messages(client):
    response = client.post("/api/chat", json={"message": "hello there"})
    assert response.status_code == 200
    body = response.json()

    messages = get_recent_chat_messages(limit=10)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "hello there"
    assert messages[0]["actions"] is None
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == body["message"]
    assert json.loads(messages[1]["actions"]) == body


def test_chat_llm_failure_returns_graceful_response_not_500(client, monkeypatch):
    def _raise(*args, **kwargs):
        raise RuntimeError("network failure reaching OpenRouter")

    monkeypatch.setattr("app.api.chat.get_chat_response", _raise)

    response = client.post("/api/chat", json={"message": "hello"})
    assert response.status_code == 200
    body = response.json()
    assert body["trades"] == []
    assert body["watchlist_changes"] == []
    assert "message" in body and body["message"]

    # Both turns are still persisted, including the assistant's fallback message.
    messages = get_recent_chat_messages(limit=10)
    assert len(messages) == 2
    assert messages[0]["content"] == "hello"
    assert messages[1]["content"] == body["message"]

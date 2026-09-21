"""Tests for `POST /api/chat`."""

from app.api.chat import MAX_MESSAGE_CHARS
from app.db import get_recent_chat_messages

EXPECTED_RESPONSE_KEYS = {"message", "trades", "watchlist_changes"}


class TestPostChat:
    """`POST /api/chat` against a freshly-seeded database, `LLM_MOCK=true`."""

    def test_plain_message_returns_200_with_expected_shape(self, client):
        response = client.post("/api/chat", json={"message": "hello there"})

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == EXPECTED_RESPONSE_KEYS
        assert body["trades"] == []
        assert body["watchlist_changes"] == []
        assert isinstance(body["message"], str) and body["message"] != ""

    def test_portfolio_question_grounds_reply_in_the_real_cash_balance(self, client):
        # Seed a live price so the watchlist half of the prompt context is
        # populated too (CHAT-02's watchlist-grounding half).
        client.app.state.price_cache.update(ticker="AAPL", price=190.5)

        response = client.post("/api/chat", json={"message": "how is my portfolio doing?"})

        assert response.status_code == 200
        # Seeded default cash balance is 10000.0 (users_profile default).
        assert "10000.00" in response.json()["message"]

    def test_one_call_persists_exactly_two_messages_user_first(self, client):
        client.post("/api/chat", json={"message": "hello there"})

        messages = get_recent_chat_messages(10)
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "hello there"
        assert messages[1]["role"] == "assistant"

    def test_empty_message_returns_400_and_writes_no_row(self, client):
        response = client.post("/api/chat", json={"message": ""})

        assert response.status_code == 400
        assert "error" in response.json()
        assert get_recent_chat_messages(10) == []

    def test_whitespace_only_message_returns_400_and_writes_no_row(self, client):
        response = client.post("/api/chat", json={"message": "   "})

        assert response.status_code == 400
        assert get_recent_chat_messages(10) == []

    def test_over_length_message_returns_400_and_writes_no_row(self, client):
        response = client.post("/api/chat", json={"message": "a" * (MAX_MESSAGE_CHARS + 1)})

        assert response.status_code == 400
        assert get_recent_chat_messages(10) == []

    def test_exactly_max_length_message_returns_200(self, client):
        response = client.post("/api/chat", json={"message": "a" * MAX_MESSAGE_CHARS})

        assert response.status_code == 200

    def test_multi_byte_message_at_exactly_max_code_points_returns_200(self, client):
        """MAX_MESSAGE_CHARS is measured in Unicode code points via len(),
        not UTF-8 bytes — a message of multi-byte characters at exactly the
        bound must not be rejected as over-length."""
        response = client.post("/api/chat", json={"message": "€" * MAX_MESSAGE_CHARS})

        assert response.status_code == 200

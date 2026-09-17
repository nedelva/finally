"""Public entrypoint for the FinAlly chat LLM module.

Pure function in, structured object out: no DB access, no market data source
access. `backend-api-engineer` loads portfolio/watchlist context from the DB and
market data cache, calls `get_chat_response`, and executes the proposed actions
via the same trade/watchlist code paths as the manual endpoints.
"""

import logging
import os

from litellm import completion

from .mock import get_mock_response
from .prompts import build_messages
from .schema import ChatResponse

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

_FALLBACK_MESSAGE = (
    "Sorry, I had trouble putting together a response just now. Please try again."
)


def _is_mock_mode() -> bool:
    return os.environ.get("LLM_MOCK") == "true"


def get_chat_response(
    user_message: str,
    portfolio_context: dict,
    history: list[dict],
) -> ChatResponse:
    """Get a structured chat response for `user_message`.

    Args:
        user_message: The user's new chat message.
        portfolio_context: cash_balance, positions, watchlist, total_value --
            a plain dict, e.g. GET /api/portfolio + GET /api/watchlist shapes
            merged. Rendered into the prompt; never touched otherwise.
        history: Prior conversation turns, most recent last:
            [{"role": "user"|"assistant", "content": str}, ...]

    Returns:
        A parsed ChatResponse. If LLM_MOCK=true, this is produced deterministically
        by `mock.get_mock_response` with no network call. Otherwise this calls
        Cerebras (via LiteLLM -> OpenRouter) with structured output. A malformed or
        empty response from the LLM is caught and turned into an apologetic
        ChatResponse with no actions rather than raised -- a bad LLM response must
        never 500 the whole /api/chat endpoint. Genuinely unexpected exceptions
        (e.g. network failure) are allowed to propagate for the API layer to handle.
    """
    if _is_mock_mode():
        return get_mock_response(user_message, portfolio_context, history)

    messages = build_messages(user_message, portfolio_context, history)

    response = completion(
        model=MODEL,
        messages=messages,
        response_format=ChatResponse,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )

    try:
        content = response.choices[0].message.content
        return ChatResponse.model_validate_json(content)
    except Exception:
        logger.exception("Failed to parse LLM structured response: %r", response)
        return ChatResponse(message=_FALLBACK_MESSAGE, trades=[], watchlist_changes=[])

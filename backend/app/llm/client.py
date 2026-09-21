"""The only module that calls `litellm.completion()`.

Call shape copied verbatim from `.claude/skills/cerebras/SKILL.md` (locked
project skill). `get_chat_response` is a plain synchronous function — not
`async def` — matching every repository function in this codebase; the
route wraps it in `asyncio.to_thread(...)`.
"""

from __future__ import annotations

import logging
import os

from litellm import completion

from .mock import get_mock_response
from .prompts import build_messages
from .schema import ChatResponse

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

_FALLBACK_MESSAGE = "Sorry, I had trouble putting together a response just now. Please try again."


def get_chat_response(user_message: str, portfolio_context: str, history: list[dict]) -> ChatResponse:
    """Return the assistant's structured reply for one chat turn.

    Delegates to `get_mock_response` when `LLM_MOCK` is `"true"` — no
    network call, no `completion()` reached. Otherwise calls
    `litellm.completion()` against Cerebras via OpenRouter and parses the
    structured JSON payload.

    The `try` block spans both the `completion()` call and the
    `model_validate_json` parse, not the parse alone: a missing or invalid
    `OPENROUTER_API_KEY`, a timeout, or a transport error all raise out of
    `completion()` itself, and narrower wrapping would let any of those
    propagate through `asyncio.to_thread` and out of the route as a 500 —
    which this project's scope note explicitly forbids. Every failure here
    degrades into a readable fallback `ChatResponse`; this function never
    raises.
    """
    if os.environ.get("LLM_MOCK") == "true":
        return get_mock_response(user_message, portfolio_context, history)

    messages = build_messages(user_message, portfolio_context, history)
    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=ChatResponse,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
        return ChatResponse.model_validate_json(response.choices[0].message.content)
    except Exception:
        logger.exception("Failed to get or parse LLM chat response for message: %r", user_message)
        return ChatResponse(message=_FALLBACK_MESSAGE, trades=[], watchlist_changes=[])

"""Integration tests for the SSE streaming endpoint.

`stream.py`'s generator never terminates on its own — it only stops when the
client disconnects — which rules out `httpx.ASGITransport` (and Starlette's
`TestClient`, built on the same mechanism) for any read that doesn't
immediately disconnect: both fully drain an ASGI app's response body before
returning anything to the caller, so `client.stream(...)` deadlocks entering
`__aenter__` against an endpoint that only completes on disconnect (confirmed
empirically this session; the same failure mode `test_main.py`'s
`TestLifespanSSE` already documents for this exact generator). Every test
here that needs to read real bytes off the wire binds a real `uvicorn.Server`
to an OS-assigned port and drives it with a real-socket `httpx.AsyncClient`,
matching the precedent `backend/tests/test_main.py::TestLifespanSSE` already
established. The one test that needs to observe disconnect handling itself
drives the module-private generator directly with a hand-written fake
request, sidestepping `ASGITransport`'s unreliable `http.disconnect`
propagation entirely (also empirically confirmed, and called out in this
plan's own instructions).

Every streaming read here is bounded by both a wall-clock timeout and a
maximum line count, so a missing frame fails the assertion with a traceback
naming the test instead of hanging the suite against the endless generator.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import pytest
import uvicorn
from fastapi import APIRouter, FastAPI
from httpx import AsyncClient

from app.market.cache import PriceCache
from app.market.models import PriceUpdate
from app.market.stream import _generate_events, create_stream_router

_READ_TIMEOUT = 10.0
_MAX_LINES = 50


@asynccontextmanager
async def _running_app(router: APIRouter):
    """Bind `router` on a fresh FastAPI app to a real, OS-assigned port.

    Yields a real-socket `AsyncClient` pointed at that port. Torn down via
    `should_exit` + awaiting the server task, mirroring
    `test_main.py::TestLifespanSSE`'s already-proven pattern.
    """
    app = FastAPI()
    app.include_router(router)
    config = uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    try:
        async with asyncio.timeout(_READ_TIMEOUT):
            while not server.started:
                await asyncio.sleep(0.01)
        port = server.servers[0].sockets[0].getsockname()[1]
        async with AsyncClient(base_url=f"http://127.0.0.1:{port}") as client:
            yield client
    finally:
        server.should_exit = True
        await server_task


async def _read_until(client: AsyncClient, predicate) -> list[str]:
    """Stream `/api/stream/prices` and read lines until `predicate` matches.

    Bounded by both a wall-clock timeout and a maximum line count so a
    missing frame fails the test instead of hanging the whole suite on the
    generator's endless loop.
    """
    lines: list[str] = []
    async with asyncio.timeout(_READ_TIMEOUT):
        async with client.stream("GET", "/api/stream/prices") as response:
            assert response.status_code == 200
            async for line in response.aiter_lines():
                lines.append(line)
                if predicate(line):
                    return lines
                if len(lines) >= _MAX_LINES:
                    pytest.fail(
                        f"read cap ({_MAX_LINES} lines) exceeded without finding target "
                        f"line; lines so far: {lines!r}"
                    )
    pytest.fail("stream ended before the target line arrived")


class _StubCache:
    """Imitates only the two members `_generate_events` actually touches.

    A real `PriceCache` cannot advance its version without gaining
    contents, and the defect under test is precisely about a version
    generation being consumed by an empty read. `version` stays fixed at 1;
    `get_all()` returns an empty dict on its first call and a dict holding
    one real `PriceUpdate` on every call after that.
    """

    def __init__(self, update: PriceUpdate) -> None:
        self._update = update
        self._calls = 0

    @property
    def version(self) -> int:
        return 1

    def get_all(self) -> dict[str, PriceUpdate]:
        self._calls += 1
        if self._calls == 1:
            return {}
        return {self._update.ticker: self._update}


class _FakeRequest:
    """Request double whose `is_disconnected()` flips to `True` after N calls.

    Sidesteps `httpx.ASGITransport`'s unreliable disconnect propagation by
    driving `_generate_events` directly instead of through any client.
    """

    client = None

    def __init__(self, disconnect_after: int) -> None:
        self._calls = 0
        self._disconnect_after = disconnect_after

    async def is_disconnected(self) -> bool:
        self._calls += 1
        return self._calls > self._disconnect_after


@pytest.mark.asyncio
class TestSSEStream:
    """Integration tests for the SSE streaming endpoint."""

    async def test_first_line_is_retry_directive(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        router = create_stream_router(cache, interval=0.01)

        async with _running_app(router) as client:
            lines = await _read_until(client, lambda line: line != "")

        assert lines[0] == "retry: 1000"

    async def test_event_delivery_contains_ticker(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        router = create_stream_router(cache, interval=0.01)

        async with _running_app(router) as client:
            lines = await _read_until(client, lambda line: line.startswith("data:"))

        assert "AAPL" in lines[-1]

    async def test_router_isolation_distinct_objects_and_routes(self):
        cache_a = PriceCache()
        cache_b = PriceCache()

        router_a = create_stream_router(cache_a)
        router_b = create_stream_router(cache_b)

        assert router_a is not router_b
        assert len(router_a.routes) == 1
        assert len(router_b.routes) == 1

    async def test_streaming_no_cross_contamination(self):
        cache_a = PriceCache()
        cache_a.update("AAPL", 190.00)
        cache_b = PriceCache()
        cache_b.update("TSLA", 250.00)

        router_a = create_stream_router(cache_a, interval=0.01)
        async with _running_app(router_a) as client_a:
            lines_a = await _read_until(client_a, lambda line: line.startswith("data:"))
        assert "AAPL" in lines_a[-1]
        assert "TSLA" not in lines_a[-1]

        router_b = create_stream_router(cache_b, interval=0.01)
        async with _running_app(router_b) as client_b:
            lines_b = await _read_until(client_b, lambda line: line.startswith("data:"))
        assert "TSLA" in lines_b[-1]
        assert "AAPL" not in lines_b[-1]

    async def test_empty_cache_version_gating_delivers_once_populated(self):
        update = PriceUpdate(
            ticker="AAPL", price=190.00, previous_price=190.00, timestamp=1234567890.0
        )
        stub = _StubCache(update)
        router = create_stream_router(stub, interval=0.01)

        async with _running_app(router) as client:
            lines = await _read_until(client, lambda line: line.startswith("data:"))

        assert "AAPL" in lines[-1]

    async def test_keepalive_comment_during_silence(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        router = create_stream_router(cache, interval=0.01, keepalive_interval=0.05)

        async with _running_app(router) as client:
            lines = await _read_until(client, lambda line: line.startswith(":"))

        assert lines[-1].startswith(":")

    async def test_disconnect_stops_generator_without_hanging(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        request = _FakeRequest(disconnect_after=2)
        generator = _generate_events(cache, request, interval=0.01)

        lines: list[str] = []
        async with asyncio.timeout(_READ_TIMEOUT):
            async for line in generator:
                lines.append(line)
                if len(lines) >= _MAX_LINES:
                    pytest.fail("generator did not stop after disconnect")

        assert len(lines) >= 1

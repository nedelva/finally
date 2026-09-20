"""End-to-end tests for the FastAPI application entrypoint.

Covers the health endpoint, static-file serving (present, absent, and the
real frontend export), and a real SSE frame produced by driving the
application's actual lifespan — proving the market data engine, PriceCache,
FastAPI, and SSE streaming all wire together correctly.
"""

import asyncio
import json
from pathlib import Path

import pytest
import uvicorn
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import DEFAULT_TICKERS, create_app
from app.main import app as module_app


@pytest.mark.asyncio
class TestHealthEndpoint:
    """`GET /api/health` always returns 200 with exactly one key."""

    async def test_health_returns_ok(self, tmp_path):
        app = create_app(static_dir=tmp_path)
        with TestClient(app) as client:
            response = client.get("/api/health")

        assert response.status_code == 200
        body = response.json()
        assert set(body.keys()) == {"status"}
        assert body["status"] == "ok"


@pytest.mark.asyncio
class TestStaticServing:
    """The static mount serves a directory, and is absent gracefully."""

    async def test_serves_index_html_from_directory(self, tmp_path):
        marker = "FinAlly-test-marker-12345"
        (tmp_path / "index.html").write_text(f"<html><body>{marker}</body></html>")

        app = create_app(static_dir=tmp_path)
        with TestClient(app) as client:
            response = client.get("/")

        assert response.status_code == 200
        assert marker in response.text

    async def test_boots_without_frontend_export(self, tmp_path):
        missing_dir = tmp_path / "does-not-exist"

        app = create_app(static_dir=missing_dir)
        with TestClient(app) as client:
            health_response = client.get("/api/health")
            root_response = client.get("/")

        assert health_response.status_code == 200
        assert root_response.status_code == 404

    @pytest.mark.requires_frontend_build
    async def test_serves_real_frontend_export(self):
        repo_root = Path(__file__).resolve().parents[2]
        frontend_out = repo_root / "frontend" / "out"
        assert (frontend_out / "index.html").exists(), (
            "frontend/out/index.html is missing — run `npm --prefix frontend run build` first"
        )

        app = create_app(static_dir=frontend_out)
        with TestClient(app) as client:
            response = client.get("/")

        assert response.status_code == 200
        assert "FinAlly" in response.text


@pytest.mark.asyncio
class TestLifespanSnapshotTask:
    """The lifespan's snapshot task starts and is cleanly cancelled on shutdown."""

    async def test_enter_and_exit_lifespan_leaves_no_pending_snapshot_task(self, tmp_path):
        app = create_app(static_dir=tmp_path)
        with TestClient(app) as client:
            response = client.get("/api/health")
            assert response.status_code == 200
        # No assertion beyond "this didn't hang or raise" — a stray, never
        # awaited snapshot task would otherwise surface as a pytest warning
        # in this test's captured output (RUF-100/asyncio task-not-retrieved).


@pytest.mark.asyncio
class TestLifespanSSE:
    """A real SSE frame, produced by driving the module-level `app.main:app`
    singleton through a real, bound server — the exact object `uvicorn
    app.main:app` serves in production.

    `httpx.ASGITransport` (and Starlette's `TestClient`, built on the same
    mechanism) fully drains an ASGI app's response body before returning
    anything to the caller — fine for ordinary request/response endpoints,
    but this SSE generator only terminates on client disconnect, so both
    transports deadlock on it. A real, bound uvicorn server plus a
    real-socket `httpx.AsyncClient` streams incrementally, exactly as a
    browser's `EventSource` would. Driving the module-level `app` object
    (instead of a fresh `create_app()` instance) also makes this the more
    faithful proof: it exercises the literal ASGI target Phase 5's
    container `CMD` runs.
    """

    async def test_first_frame_contains_all_default_tickers(self):
        config = uvicorn.Config(module_app, host="127.0.0.1", port=0, log_level="warning")
        server = uvicorn.Server(config)
        server_task = asyncio.create_task(server.serve())
        data = None
        try:
            async with asyncio.timeout(10):
                while not server.started:
                    await asyncio.sleep(0.01)
                port = server.servers[0].sockets[0].getsockname()[1]

                async with AsyncClient(base_url=f"http://127.0.0.1:{port}") as client:
                    async with client.stream("GET", "/api/stream/prices") as response:
                        assert response.status_code == 200
                        line_count = 0
                        async for line in response.aiter_lines():
                            line_count += 1
                            if line.startswith("data:"):
                                data = json.loads(line[len("data:") :].strip())
                                break
                            if line_count > 20:
                                break
        finally:
            server.should_exit = True
            await server_task

        assert data is not None, "No data frame received from the SSE stream"
        assert set(data.keys()) == set(DEFAULT_TICKERS)

        one_tick = next(iter(data.values()))
        assert set(one_tick.keys()) == {
            "ticker",
            "price",
            "previous_price",
            "timestamp",
            "change",
            "change_percent",
            "direction",
        }

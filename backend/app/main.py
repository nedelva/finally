"""FastAPI application entrypoint for FinAlly.

Assembles the market-data engine (PriceCache + a MarketDataSource selected by
`create_market_data_source`) into a running server, mounts the existing SSE
router, exposes a health endpoint, and serves the built Next.js static export
from the same origin and port. This is the first FastAPI application in the
project — `app = create_app()` below is the `uvicorn app.main:app` target
Phase 5's container CMD binds to.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.market import DEFAULT_TICKERS, PriceCache, create_market_data_source, create_stream_router

logger = logging.getLogger(__name__)

# Explicit escape hatch for the static export directory. Set this to force a
# specific directory regardless of the backend/static or frontend/out
# fallbacks below.
STATIC_DIR_ENV_VAR = "FINALLY_STATIC_DIR"

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = Path(__file__).resolve().parents[2]


def resolve_static_dir() -> Path | None:
    """Resolve the directory to serve the built frontend from.

    Resolution order:
      1. `FINALLY_STATIC_DIR` env var, if set and non-empty (expanded, not
         existence-checked here — a wrong override surfaces as a warning at
         mount time rather than being silently ignored).
      2. `backend/static/`, if it is a directory — the container layout
         PLAN.md section 11 describes ("Copy frontend build output into a
         static/ directory").
      3. `<repo>/frontend/out/`, if it is a directory — the development
         checkout fallback so a local `npm run build` gets single-port
         serving with no copy step.
      4. `None` if none of the above resolve to a directory.
    """
    env_value = os.environ.get(STATIC_DIR_ENV_VAR, "").strip()
    if env_value:
        return Path(env_value).expanduser()

    backend_static = _BACKEND_DIR / "static"
    if backend_static.is_dir():
        return backend_static

    frontend_out = _REPO_ROOT / "frontend" / "out"
    if frontend_out.is_dir():
        return frontend_out

    return None


def create_app(*, static_dir: Path | None = None) -> FastAPI:
    """Build the FastAPI application.

    Args:
        static_dir: Directory to serve the built frontend from. Defaults to
            `None`, meaning "auto-resolve via `resolve_static_dir()`". Tests
            pass an explicit path to isolate the static-mount behaviour from
            whatever happens to exist on disk.
    """
    price_cache = PriceCache()
    source = create_market_data_source(price_cache)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Start the market data source on boot, stop it on shutdown."""
        await source.start(DEFAULT_TICKERS)
        app.state.price_cache = price_cache
        app.state.market_source = source
        logger.info("Market data source started with %d default tickers", len(DEFAULT_TICKERS))
        yield
        await source.stop()
        logger.info("Market data source stopped")

    app = FastAPI(title="FinAlly", lifespan=lifespan)

    # Registration order matters: Starlette resolves routes in registration
    # order, and a mount at "/" matches everything by prefix. API routers
    # must be registered before the static mount, or it would swallow them.
    app.include_router(create_stream_router(price_cache))

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    resolved_static_dir = static_dir if static_dir is not None else resolve_static_dir()
    if resolved_static_dir is not None and resolved_static_dir.is_dir():
        # StaticFiles(html=True) already normalises and rejects path
        # traversal (verified against the installed starlette.staticfiles
        # source) — do not hand-write a competing file-serving route.
        app.mount(
            "/",
            StaticFiles(directory=resolved_static_dir, html=True),
            name="static",
        )
    else:
        logger.warning(
            "Static export directory not found (tried: %s) — API-only mode, "
            "run `npm run build` in frontend/ to enable single-port serving",
            resolved_static_dir,
        )

    return app


app = create_app()

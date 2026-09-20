---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
# Technology Stack

**Analysis Date:** 2026-09-17

## Languages

**Primary:**

- Python 3.12+ - Backend application, market data simulation, API routes, tests

**Secondary:**

- TypeScript/JavaScript - Frontend scaffolding only (Next.js build output in `frontend/out/`)

## Runtime

**Environment:**

- Python 3.12+ (required by `pyproject.toml`)
- ASGI server: uvicorn

**Package Manager:**

- uv (Python project manager, modern and fast)
- Lockfile: `backend/uv.lock` (present and maintained)

## Frameworks

**Core:**

- FastAPI 0.128.7 - REST API framework, SSE streaming
- Uvicorn 0.40.0 - ASGI application server, handles HTTP/HTTPS requests

**Testing:**

- pytest 8.3.0 - Test runner and framework
- pytest-asyncio 0.24.0 - Async test support for FastAPI async code
- pytest-cov 5.0.0 - Code coverage measurement

**Build/Dev:**

- ruff 0.7.0 - Python linter and formatter

## Key Dependencies

**Critical:**

- numpy 2.4.2 - Geometric Brownian Motion calculations in market simulator, correlation matrix operations
- massive 2.2.0 - Polygon.io REST client for real market data retrieval (conditional on `MASSIVE_API_KEY`)
- rich 14.3.2 - Terminal UI rendering for market data demo (`market_data_demo.py`), colored output

**Infrastructure:**

- fastapi 0.128.7 - Web framework foundation
- uvicorn[standard] 0.40.0 - ASGI server with standard extras (uvloop, httptools)
- hatchling - Python build backend for packaging

## Configuration

**Environment:**

- Configured via `.env` file (gitignored, `.env.example` should be committed)
- Key variables: `MASSIVE_API_KEY` (optional, switches data source)
- Read via `os.environ.get()` in `app/market/factory.py`

**Build:**

- `backend/pyproject.toml` - Project metadata, dependencies, tool config
- `backend/uv.lock` - Reproducible dependency lockfile (always committed)
- `tool.pytest.ini_options` - Test discovery and async mode configuration
- `tool.ruff.lint` - Linting rules (E, F, I, N, W; ignore line-length)
- `tool.coverage` - Code coverage settings

## Platform Requirements

**Development:**

- Python 3.12 or later
- uv package manager
- git (for version control)
- bash or zsh (for running scripts)

**Production:**

- Python 3.12+ runtime
- Single-container deployment (FastAPI + static files)
- Volume mount for database persistence (`db/` directory)
- No external services required (simulator runs in-process)
- Optional: `MASSIVE_API_KEY` for real market data

---

*Stack analysis: 2026-09-17*

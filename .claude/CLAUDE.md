<!-- GSD:project-start source:PROJECT.md -->

## Project

**FinAlly — AI Trading Workstation**

FinAlly (Finance Ally) is a visually stunning, single-user AI-powered trading workstation: a browser-based terminal that streams live (simulated or real) market data, lets the user trade a $10,000 virtual portfolio with instant market-order fills, and includes an LLM chat copilot that can analyze the portfolio and execute trades/watchlist changes on the user's behalf. It looks and feels like a Bloomberg terminal with an AI copilot. It ships as a single Docker container on port 8000 — no login, no signup.

This is the capstone project for an agentic AI coding course, built entirely by coding agents. `planning/PLAN.md` is the full, authoritative specification (vision, architecture, DB schema, API contract, LLM integration design, frontend design, Docker/deployment, and testing strategy). This PROJECT.md tracks scope and status against that spec — it does not restate it.

**Core Value:** The user can watch live prices stream, place simulated trades, and have an AI assistant that can see the portfolio and act on it in natural language — all in one dependency-free `docker run`.

### Constraints

- **Tech stack**: FastAPI + uv (Python 3.12+) backend, Next.js (TypeScript, static export) frontend, SQLite, SSE (not WebSockets), LiteLLM → OpenRouter/Cerebras — all fixed by PLAN.md, not open for reconsideration
- **Single container, single port**: Everything (API + static frontend) must serve from one FastAPI process on port 8000 — per PLAN.md §3
- **No auth**: Single-user, hardcoded `user_id="default"` — per PLAN.md §7

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- Python 3.12+ - Backend application, market data simulation, API routes, tests
- TypeScript/JavaScript - Frontend scaffolding only (Next.js build output in `frontend/out/`)

## Runtime

- Python 3.12+ (required by `pyproject.toml`)
- ASGI server: uvicorn
- uv (Python project manager, modern and fast)
- Lockfile: `backend/uv.lock` (present and maintained)

## Frameworks

- FastAPI 0.128.7 - REST API framework, SSE streaming
- Uvicorn 0.40.0 - ASGI application server, handles HTTP/HTTPS requests
- pytest 8.3.0 - Test runner and framework
- pytest-asyncio 0.24.0 - Async test support for FastAPI async code
- pytest-cov 5.0.0 - Code coverage measurement
- ruff 0.7.0 - Python linter and formatter

## Key Dependencies

- numpy 2.4.2 - Geometric Brownian Motion calculations in market simulator, correlation matrix operations
- massive 2.2.0 - Polygon.io REST client for real market data retrieval (conditional on `MASSIVE_API_KEY`)
- rich 14.3.2 - Terminal UI rendering for market data demo (`market_data_demo.py`), colored output
- fastapi 0.128.7 - Web framework foundation
- uvicorn[standard] 0.40.0 - ASGI server with standard extras (uvloop, httptools)
- hatchling - Python build backend for packaging

## Configuration

- Configured via `.env` file (gitignored, `.env.example` should be committed)
- Key variables: `MASSIVE_API_KEY` (optional, switches data source)
- Read via `os.environ.get()` in `app/market/factory.py`
- `backend/pyproject.toml` - Project metadata, dependencies, tool config
- `backend/uv.lock` - Reproducible dependency lockfile (always committed)
- `tool.pytest.ini_options` - Test discovery and async mode configuration
- `tool.ruff.lint` - Linting rules (E, F, I, N, W; ignore line-length)
- `tool.coverage` - Code coverage settings

## Platform Requirements

- Python 3.12 or later
- uv package manager
- git (for version control)
- bash or zsh (for running scripts)
- Python 3.12+ runtime
- Single-container deployment (FastAPI + static files)
- Volume mount for database persistence (`db/` directory)
- No external services required (simulator runs in-process)
- Optional: `MASSIVE_API_KEY` for real market data

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Overview

## Naming Patterns

- Lowercase with underscores: `price_cache.py`, `market_data_source.py`
- Test files: `test_cache.py`, `test_simulator.py`
- Module docstrings describe public API and exports
- Lowercase with underscores: `create_market_data_source()`, `get_price()`, `_rebuild_cholesky()`
- Public functions: no leading underscore
- Private/internal functions: leading `_` to indicate internal use
- Async functions: no special naming, use `async def`
- Lowercase with underscores: `ticker`, `price`, `update_interval`, `api_key`
- Private attributes: leading underscore: `self._cache`, `self._tickers`, `self._lock`
- Constants: `UPPERCASE_WITH_UNDERSCORES`: `DEFAULT_DT`, `TRADING_SECONDS_PER_YEAR`, `SPARK_CHARS`
- Computed properties: no prefix: `@property def direction(self):`
- PascalCase: `PriceUpdate`, `PriceCache`, `GBMSimulator`, `SimulatorDataSource`, `MassiveDataSource`
- Abstract base: `MarketDataSource` (inherits from `ABC`)

## Code Style

- Line length: 100 characters (enforced by ruff)
- Indentation: 4 spaces
- Imports: organized with `from __future__ import annotations` at the top
- Type hints: always used, using Python 3.10+ union syntax (`float | None` not `Optional[float]`)
- Tool: ruff
- Rules enabled: E (errors), F (pyflakes), I (isort), N (naming), W (warnings)
- Config: `backend/pyproject.toml` under `[tool.ruff]`
- Line length error (E501) is ignored — handled by formatter
- None defined. Use relative imports (`from .cache import`) or absolute from `app` root.

## Error Handling

- Specific exception catching: catch only expected exceptions
- Background tasks (async loops): catch `Exception` broadly but log and do not re-raise
- Async task cancellation: catch `asyncio.CancelledError` when cleaning up
- Return `None` for "not found" cases (not exceptions)
- Always use `logger.exception()` in except blocks to capture full traceback

## Logging

- **INFO** (`logger.info()`): important lifecycle events (start/stop, resource creation)
- **DEBUG** (`logger.debug()`): per-iteration detail (every step, every poll)
- **WARNING** (`logger.warning()`): recoverable issues (malformed data, skipped items)
- **ERROR** (`logger.error()`): failures but continuing (API error in background loop)
- **EXCEPTION** (`logger.exception()`): in except blocks to capture full traceback
- Use `%` formatting for all log messages (not f-strings)
- Include context where helpful (ticker name, count of items, etc.)
- Avoid logging PII or secrets

## Comments

- Complex algorithms (e.g., GBM math, Cholesky decomposition, correlation logic)
- Non-obvious design decisions
- Workarounds and hacks (though these should be rare)
- Assumptions about behavior (e.g., "PriceUpdate is immutable and hashable")
- Code that reads clearly on its own
- Obvious loops and conditionals
- "This gets the price" comments when `get_price()` is self-documenting
- All public classes: full docstring with purpose and lifecycle
- All public functions: docstring with purpose, args (if needed), return type (if not obvious)
- Private methods: short docstring (one sentence) if non-obvious
- Example (from `cache.py`):

## Function Design

- Keep functions focused: one responsibility per function
- If a function exceeds ~50 lines, consider splitting it
- Example: `GBMSimulator.step()` is the hot path and ~40 lines; `_rebuild_cholesky()` is separate
- Use positional for required args: `update(ticker, price)`
- Use keyword-only for optional/config: `__init__(..., update_interval: float = 0.5)`
- Type hints on all parameters
- Type hints on all return types (include `| None` if applicable)
- Prefer returning values over raising exceptions for non-error conditions
- Return `None` for "not found" cases; raise exceptions for bugs
- Use `async def` for functions that call `await` or are entry points to async tasks
- Use `await asyncio.sleep()` for delays, never `time.sleep()`
- Use `await asyncio.to_thread()` to run sync code without blocking the event loop

## Module Design

- Define `__all__` in every module's `__init__.py`
- Example (`app/market/__init__.py`):
- Use `__init__.py` to re-export public types and factories
- Include a module docstring listing the public API
- Clients import from `app.market`, not `app.market.cache`, etc.

## Special Patterns

- Use `@dataclass(frozen=True, slots=True)` for immutable value objects
- Define interface in a separate `interface.py` file
- Inherit from `ABC` and use `@abstractmethod` decorators
- Docstring describes the contract and lifecycle
- Use `threading.Lock` for shared mutable state
- Always acquire the lock around read-modify-write operations
- Create sources via factory functions, not direct constructors
- Example (`factory.py`):

## Type Hints

- Every function has a return type hint
- Every parameter has a type hint
- Use `from __future__ import annotations` for forward references
- Use `| None` instead of `Optional[...]`
- Use `type[X]` for type parameters, not `Type[X]`
- Use collection types: `list[str]`, `dict[str, float]`, `AsyncGenerator[str, None]`

## Magic Methods

- `__len__`: implement for container-like classes
- `__contains__`: implement for membership testing
- `__repr__`: implement for debugging if needed (commented out for now)
- `__str__`: unless you need a user-facing string representation
- `__eq__`, `__hash__`: auto-generated by frozen dataclasses

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **MarketDataSource** (ABC) | Abstract contract for price providers | `backend/app/market/interface.py` |
| **SimulatorDataSource** | GBM-based price generation with correlations | `backend/app/market/simulator.py` |
| **MassiveDataSource** | Polygon.io REST API polling | `backend/app/market/massive_client.py` |
| **PriceCache** | Thread-safe central price store, version tracking | `backend/app/market/cache.py` |
| **PriceUpdate** | Immutable price snapshot with computed deltas | `backend/app/market/models.py` |
| **SSE Stream Router** | FastAPI router factory for `/api/stream/prices` | `backend/app/market/stream.py` |
| **Factory** | Selects simulator or Massive based on env var | `backend/app/market/factory.py` |

## Pattern Overview

- Two implementations of `MarketDataSource` ABC; selection via environment variable (`MASSIVE_API_KEY`)
- All producers write to `PriceCache`; all consumers read from it (no direct coupling)
- Shared data model: `PriceUpdate` immutable dataclass with computed fields (direction, change %, etc.)
- Background task (async) updates cache on a fixed cadence; SSE streams read cache and emit events
- Designed for future multi-user scale: all schema includes `user_id` (currently hardcoded to `"default"`)

## Layers

- Purpose: Generate or fetch prices on a schedule
- Location: Dual implementations per `interface.py` ABC
- Contains: GBM math + state management (simulator) OR REST polling logic (Massive)
- Depends on: `PriceCache` for writes
- Used by: FastAPI app (startup) to initialize background task
- Purpose: Central thread-safe price store; single source of truth
- Location: In-memory dictionary with lock
- Contains: `{ticker: PriceUpdate}`, version counter
- Depends on: Nothing (no imports from market submodules)
- Used by: All producers (write), all consumers (read)
- Purpose: Expose prices to clients via SSE
- Location: FastAPI router factory
- Contains: `/api/stream/prices` SSE endpoint, async event generator
- Depends on: `PriceCache` (reads only), FastAPI
- Used by: Frontend via `EventSource` API
- Purpose: Immutable data structures
- Location: Dataclass definitions
- Contains: `PriceUpdate` with computed properties (direction, change, change_percent)
- Depends on: Nothing
- Used by: Everywhere

## Data Flow

### Primary Request Path: Price Streaming to Frontend

- State lives in `PriceCache` only; no global variables or module-level singletons (except the anti-pattern noted below)
- Async background task writes; multiple async SSE clients read
- Thread-safe via `threading.Lock()` on cache

## Key Abstractions

- Purpose: Defines the contract for price producers (start, stop, add_ticker, remove_ticker, get_tickers)
- Examples: `SimulatorDataSource`, `MassiveDataSource`
- Pattern: Strategy; allows swapping implementations without changing consumer code
- Purpose: Immutable snapshot of a ticker's price + derived metrics (direction, change %)
- Examples: Created by `cache.update()`, serialized to JSON for SSE/API
- Pattern: Value object / immutable data class; frozen with `@dataclass(frozen=True)`
- Purpose: Central, thread-safe in-memory store for all active tickers
- Examples: Shared by simulator, Massive client, SSE endpoint, future trade execution
- Pattern: Observer/notification via version counter (for detecting updates without polling)

## Entry Points

- Location: `backend/market_data_demo.py:1-end`
- Triggers: Manual `uv run market_data_demo.py` (terminal demo, NOT the web app)
- Responsibilities: Instantiate cache + simulator, start background task, display live Rich dashboard for 60 seconds or until Ctrl+C
- Location: 6 test modules, 73 tests
- Triggers: `uv run pytest` or CI/CD
- Responsibilities: Unit + integration testing of all market data components (84% coverage)
- Location: `create_stream_router(price_cache) → APIRouter`
- Triggers: Called by FastAPI app startup (not yet implemented in codebase)
- Responsibilities: Returns configured router with `/api/stream/prices` endpoint; awaits host app to mount it
- Location: `create_market_data_source(cache) → MarketDataSource`
- Triggers: Called by app startup to decide which data source to use
- Responsibilities: Inspect `MASSIVE_API_KEY` env var; return Massive client or simulator

## Architectural Constraints

- **Threading Model:** `PriceCache` uses `threading.Lock()` (not asyncio-aware). All producers and consumers are async tasks, but no `await` happens inside critical sections. Lock is held only for brief dict operations (typical hold time: <1ms).
- **Global State (Anti-Pattern):** `backend/app/market/stream.py:17` declares `router = APIRouter(...)` at module level. The factory `create_stream_router()` (line 20) decorates onto this singleton. **Calling the factory twice registers handlers twice on the same router, with the second call's `price_cache` closure shadowing the first.** See Anti-Patterns section below.
- **Single Writer:** By design, only one data source (simulator or Massive) writes to a given `PriceCache`. No race conditions between writers by construction.
- **No Persistent State:** Current implementation keeps all prices in memory. No database persistence layer yet (planned in `backend/app/db/`).
- **Market Data Cadence:** Simulator: ~500ms (hardcoded in `GBMSimulator` and `stream.py`). Massive: 2-15 seconds depending on API tier (configurable in `MassiveDataSource`).

## Anti-Patterns

### Module-Level Router Singleton

```python

```

- Violates the principle of "factory creates new instances"
- Prevents testing multiple cache instances with the same router factory
- Makes dependency injection impossible; claims to "let us inject without globals" while using a global

```python

```

## Error Handling

- Data sources handle errors gracefully (timeouts, API errors) by catching and logging, then continuing the update loop
- SSE stream detects client disconnect and exits cleanly
- Cache operations are atomic (lock-protected)
- Massive client: catch `Exception` on REST call, log, skip update, retry next cycle
- Simulator: no external errors possible (pure math); always generates valid prices
- SSE: catch `asyncio.CancelledError` on stream cancellation, log, exit

## Cross-Cutting Concerns

- Each module uses `logging.getLogger(__name__)` (per-module logger)
- Key events logged: data source selection, SSE client connect/disconnect, errors in Massive polling
- No debug logging for every price update (too noisy; would spam logs)
- `PriceCache.update()` rounds prices to 2 decimals
- Simulator ensures prices stay > $0 (GBM is lognormal; never negative by math)
- Massive client validates API responses (type checking, null checks)
- All async (FastAPI tasks, background simulator task, SSE clients)
- Cache uses `threading.Lock()` for state protection
- No deadlocks: locks are always released (even on exception, via context manager)

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras-inference | Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

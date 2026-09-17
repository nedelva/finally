---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
# Codebase Structure

**Analysis Date:** 2026-09-17

## Directory Layout

```
finally/
├── backend/                          # Python backend (uv project)
│   ├── app/
│   │   ├── __init__.py               # Package marker
│   │   ├── market/                   # IMPLEMENTED: Market data subsystem
│   │   │   ├── __init__.py           # Public API exports
│   │   │   ├── models.py             # PriceUpdate dataclass
│   │   │   ├── interface.py          # MarketDataSource ABC
│   │   │   ├── cache.py              # PriceCache (thread-safe store)
│   │   │   ├── simulator.py          # GBMSimulator + SimulatorDataSource
│   │   │   ├── massive_client.py     # MassiveDataSource (Polygon.io)
│   │   │   ├── factory.py            # create_market_data_source()
│   │   │   ├── stream.py             # SSE endpoint router factory
│   │   │   └── seed_prices.py        # Realistic seed prices + GBM params
│   │   ├── api/                      # PLACEHOLDER: REST API routes (empty)
│   │   ├── db/                       # PLACEHOLDER: Database schema + queries (empty)
│   │   └── llm/                      # PLACEHOLDER: LLM integration (empty)
│   ├── tests/
│   │   ├── conftest.py               # Pytest fixtures
│   │   └── market/                   # 73 tests for market data (84% coverage)
│   │       ├── test_models.py        # PriceUpdate tests
│   │       ├── test_cache.py         # PriceCache thread-safety tests
│   │       ├── test_simulator.py     # GBM math + state management
│   │       ├── test_simulator_source.py  # SimulatorDataSource integration
│   │       ├── test_factory.py       # Data source selection logic
│   │       └── test_massive.py       # MassiveDataSource (mocked API)
│   ├── market_data_demo.py           # Standalone Rich terminal demo
│   ├── pyproject.toml                # Project manifest + uv config
│   ├── uv.lock                       # Lockfile (committed)
│   ├── README.md                     # Backend-specific setup
│   ├── CLAUDE.md                     # Backend developer guide
│   └── .venv/                        # Virtual environment (generated)
│
├── frontend/                         # Next.js TypeScript project (static export)
│   ├── lib/                          # Utility modules (only current code)
│   │   ├── types.ts                  # Type definitions (mirrors backend API)
│   │   ├── api.ts                    # HTTP client for /api/* endpoints
│   │   ├── hooks.ts                  # React hooks (usePrice, usePortfolio, etc.)
│   │   ├── positionMath.ts           # Portfolio calculations
│   │   ├── usePriceFlash.ts          # CSS animation for price changes
│   │   └── format.ts                 # Number/currency formatting
│   ├── out/                          # Static export build output (generated)
│   │   ├── _next/                    # Next.js client bundle
│   │   ├── 404.html, index.html      # Entry points
│   │   └── ... (other static files)
│   ├── .next/                        # Next.js dev build cache (generated)
│   ├── next-env.d.ts                 # TypeScript declarations (generated)
│   ├── node_modules/                 # Dependencies (generated)
│   ├── package.json                  # Node project manifest
│   ├── tsconfig.json                 # TypeScript config
│   ├── next.config.js                # Next.js config (output: 'export')
│   └── ... (pages/, components/, etc. not yet created)
│
├── test/                             # E2E tests (Playwright)
│   └── node_modules/                 # Dependencies (generated, not yet populated)
│
├── planning/                         # Project documentation (shared)
│   ├── PLAN.md                       # Full system specification
│   ├── MARKET_DATA_SUMMARY.md        # Market data implementation notes
│   └── archive/                      # Historical design docs
│       ├── MARKET_DATA_DESIGN.md
│       ├── MARKET_DATA_REVIEW.md
│       ├── MARKET_INTERFACE.md
│       ├── MARKET_SIMULATOR.md
│       └── MASSIVE_API.md
│
├── scripts/                          # Deployment & convenience scripts
│   ├── start_mac.sh                  # Docker build + run (macOS/Linux)
│   ├── stop_mac.sh                   # Docker stop (macOS/Linux)
│   ├── start_windows.ps1             # Docker build + run (Windows)
│   └── stop_windows.ps1              # Docker stop (Windows)
│
├── db/                               # Runtime SQLite volume mount point
│   ├── .gitkeep                      # Ensures dir exists in git
│   └── finally.db                    # SQLite database (created at runtime, gitignored)
│
├── .planning/codebase/               # Codebase maps (this directory)
│   ├── ARCHITECTURE.md               # System patterns, layers, data flow
│   └── STRUCTURE.md                  # This file: directory layout, conventions
│
├── .claude/                          # Claude Code configuration
│   ├── .gsd-profile                  # GSD agent profile
│   ├── gsd-core/                     # GSD framework
│   ├── gsd-file-manifest.json        # Tracked files
│   ├── gsd-install-state.json        # Agent state
│   ├── skills/
│   │   └── cerebras/                 # LLM integration skill
│   ├── agents/                       # Agent configurations
│   └── hooks/                        # Git/editor hooks
│
├── .github/                          # GitHub Actions workflows
├── .git/                             # Version control
├── .gitignore                        # Standard Python/Node ignore patterns
├── Dockerfile                        # Multi-stage build (Node → Python)
├── docker-compose.yml                # Optional orchestration wrapper
├── .env.example                      # Environment template (committed)
├── CLAUDE.md                         # Project-wide instructions
├── LICENSE                           # MIT or chosen license
├── README.md                         # Top-level project overview
└── planning/                         # Planning documents
```

## Directory Purposes

**Backend Source Code (`backend/app/market/`)**:

- Purpose: Implemented market data subsystem (data sources, cache, SSE streaming)
- Contains: 8 Python modules, ~600 lines
- Key files: `cache.py`, `interface.py`, `simulator.py`, `factory.py`
- Status: Complete, tested, reviewed

**Backend Tests (`backend/tests/market/`)**:

- Purpose: Unit + integration tests for market data
- Contains: 6 test modules, 73 tests, 84% code coverage
- Runs on: `uv run pytest`

**Placeholder Directories (`backend/app/api/`, `backend/app/db/`, `backend/app/llm/`)**:

- Purpose: Reserved for future implementation
- Status: Empty (contain only `__pycache__` from previous imports)
- These are intentional structure — downstream code knows where to add new features

**Frontend Utilities (`frontend/lib/`)**:

- Purpose: Shared TypeScript utilities (types, API client, hooks, math)
- Contains: 6 modules, utility functions for frontend app
- Status: Scaffolding only — frontend components not yet implemented

**Frontend Output (`frontend/out/`)**:

- Purpose: Static HTML/JS export from Next.js build
- Generated by: `npm run build` (output: 'export' in next.config.js)
- Contains: `_next/` bundle, `index.html`, static assets
- Status: Committed (allows deployment without Node at runtime)

**Planning (`planning/`)**:

- Purpose: Shared project documentation
- Contains: PLAN.md (full spec), MARKET_DATA_SUMMARY.md (component status), archive/ (design history)
- Audience: All agents + developers

## Key File Locations

**Entry Points:**

- `backend/market_data_demo.py`: Terminal demo (run standalone with `uv run`)
- `backend/tests/`: Pytest suite (run with `uv run pytest`)
- (FastAPI app entry point not yet created; will go in `backend/app/main.py` or `backend/app/server.py`)

**Data Models & Types:**

- Backend source-of-truth: `backend/app/market/models.py` (`PriceUpdate` dataclass)
- Frontend mirror: `frontend/lib/types.ts` (`PriceTick`, `PriceStreamEvent`, etc.)

**Core Logic:**

- Market Data Cache: `backend/app/market/cache.py`
- Data Source Interface: `backend/app/market/interface.py`
- GBM Simulator: `backend/app/market/simulator.py`
- Massive API Client: `backend/app/market/massive_client.py`
- SSE Streaming: `backend/app/market/stream.py`

**Configuration:**

- Python: `backend/pyproject.toml` (dependencies, pytest config, ruff settings)
- Frontend: `frontend/package.json`, `frontend/next.config.js`
- Docker: `Dockerfile`, `docker-compose.yml`
- Environment: `.env` (gitignored), `.env.example` (template, committed)

**Testing:**

- Backend tests: `backend/tests/market/test_*.py`
- E2E tests: `test/` (Playwright, currently empty)
- Pytest config: `backend/pyproject.toml` ([tool.pytest.ini_options])

## Naming Conventions

**Files:**

- Python: `snake_case.py` (modules), with related tests in `tests/{module_name}/test_{module}.py`
  - Example: `backend/app/market/simulator.py` → `backend/tests/market/test_simulator.py`
- TypeScript: `camelCase.ts` (utilities, hooks), `PascalCase.tsx` (components — not yet created)
- Tests: `test_*.py` (pytest discovery)

**Directories:**

- Package dirs: lowercase + underscores (e.g., `app`, `market`, `tests`)
- Feature dirs: lowercase + hyphens or underscores (e.g., `planning`, `scripts`)
- Build output: conventional (`.next`, `out`, `node_modules`, `.venv`, `__pycache__`)

**Functions & Classes:**

- Python: `snake_case()` for functions, `PascalCase` for classes and ABCs
  - Example: `create_market_data_source()`, `class PriceCache`, `class MarketDataSource(ABC)`
- TypeScript: `camelCase()` for functions, `PascalCase` for types/interfaces
  - Example: `function getPrice()`, `interface PriceUpdate`, `type TradeSide`

**Constants:**

- Python: `UPPER_SNAKE_CASE` (e.g., `TRADING_SECONDS_PER_YEAR`, `DEFAULT_PARAMS`)
- TypeScript: `UPPER_SNAKE_CASE` or `camelCase` depending on scope (module exports use `UPPER_SNAKE_CASE`)

## Where to Add New Code

**New REST API Endpoint** (e.g., `/api/portfolio`, `/api/chat`):

- Primary code: `backend/app/api/{feature}.py` (create new file per feature)
- Tests: `backend/tests/api/test_{feature}.py`
- Integration: Import router in main app entry point (currently nonexistent; will be `backend/app/main.py` or `backend/app/server.py`)
- Type contract: Update `frontend/lib/types.ts` with request/response types

**New Database Schema** (e.g., users, trades, positions):

- Schema: `backend/app/db/schema.sql` or `backend/app/db/{feature}_schema.py`
- Queries: `backend/app/db/{feature}_queries.py`
- Models: `backend/app/db/models.py` (dataclasses mirroring schema)
- Tests: `backend/tests/db/test_{feature}.py`
- Initialization: Add to database setup logic (currently no setup script; planned for `backend/app/db/__init__.py`)

**New LLM Feature** (e.g., chat endpoint, structured output parsing):

- LLM client/integration: `backend/app/llm/client.py`
- Structured outputs: `backend/app/llm/schemas.py` (Pydantic models for structured responses)
- Prompts: `backend/app/llm/prompts.py`
- Tests: `backend/tests/llm/test_*.py`
- Skills: Use `cerebras` skill from `.claude/skills/cerebras/` for LiteLLM via OpenRouter

**New Frontend Component** (e.g., Watchlist widget, Chart):

- Component: `frontend/components/{feature}/index.tsx` or `frontend/components/{feature}.tsx`
- Styles: Tailwind CSS (inline) or `frontend/styles/{feature}.css`
- Hooks: If needed, add to `frontend/lib/hooks.ts` or create `frontend/lib/use{Feature}.ts`
- Tests: `frontend/__tests__/{feature}.test.tsx` (React Testing Library)

**New Utility/Helper**:

- Backend: `backend/app/utils/{feature}.py` (create `backend/app/utils/` if needed)
- Frontend: `frontend/lib/{feature}.ts` or `frontend/utils/{feature}.ts`

## Special Directories

**`.venv/` (Backend Virtual Environment)**:

- Purpose: Python dependencies for local development + CI
- Generated: Yes (created by `uv sync`)
- Committed: No (gitignored via `.venv` in .gitignore)
- Safety: Safe to delete and regenerate

**`backend/node_modules/`, `frontend/node_modules/`, `test/node_modules/`**:

- Purpose: Node.js package dependencies
- Generated: Yes (created by `npm install` or `npm ci`)
- Committed: No (gitignored via `node_modules` in .gitignore)
- Safety: Safe to delete and regenerate; use lockfiles (`package-lock.json`, `uv.lock`)

**`frontend/.next/`, `frontend/out/`**:

- Purpose: Next.js build cache (`.next/`) and static export output (`out/`)
- Generated: `.next/` during dev; `out/` during build
- Committed: `out/` is committed (contains deployable artifacts); `.next/` is gitignored
- Safety: Both safe to delete; will regenerate on next build

**`backend/.pytest_cache/`, `backend/.ruff_cache/`**:

- Purpose: pytest and ruff tool caches
- Generated: Yes (created during test runs and linting)
- Committed: No (gitignored)
- Safety: Safe to delete; regenerates on next use

**`db/`**:

- Purpose: Runtime volume mount for SQLite database file
- Generated: Yes (backend creates `finally.db` on first run)
- Committed: `.gitkeep` only (ensures directory exists in git)
- `finally.db`: Created at runtime, gitignored

**`.planning/codebase/`**:

- Purpose: Codebase architecture/structure maps
- Contains: ARCHITECTURE.md, STRUCTURE.md (this file)
- Committed: Yes (used by downstream agents like `/gsd-plan-phase`)
- Safety: Human-writable; updated by gsd-map-codebase skill

## Import Conventions

**Backend (Python):**

- Absolute imports from package root: `from app.market import PriceCache, MarketDataSource`
- No relative imports in top-level files (they complicate PYTHONPATH)
- Tests use absolute imports: `from app.market.cache import PriceCache`

**Frontend (TypeScript):**

- Path aliases (if configured in tsconfig.json): `import { PriceCache } from '@/lib/types'`
- Relative imports for sibling files: `import { usePrice } from './hooks'`
- Barrel files: `frontend/lib/__init__.ts` (planned) or direct imports from specific files

---

*Structure analysis: 2026-09-17*

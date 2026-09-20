# FinAlly — AI Trading Workstation

## What This Is

FinAlly (Finance Ally) is a visually stunning, single-user AI-powered trading workstation: a browser-based terminal that streams live (simulated or real) market data, lets the user trade a $10,000 virtual portfolio with instant market-order fills, and includes an LLM chat copilot that can analyze the portfolio and execute trades/watchlist changes on the user's behalf. It looks and feels like a Bloomberg terminal with an AI copilot. It ships as a single Docker container on port 8000 — no login, no signup.

This is the capstone project for an agentic AI coding course, built entirely by coding agents. `planning/PLAN.md` is the full, authoritative specification (vision, architecture, DB schema, API contract, LLM integration design, frontend design, Docker/deployment, and testing strategy). This PROJECT.md tracks scope and status against that spec — it does not restate it.

## Core Value

The user can watch live prices stream, place simulated trades, and have an AI assistant that can see the portfolio and act on it in natural language — all in one dependency-free `docker run`.

## Requirements

### Validated

- ✓ Market data pipeline: pluggable `MarketDataSource` (GBM simulator by default, Massive/Polygon.io REST client when `MASSIVE_API_KEY` is set), selected via factory — existing
- ✓ Thread-safe in-memory `PriceCache` with version-based change detection (single writer, many readers) — existing
- ✓ SSE price-stream endpoint factory (`/api/stream/prices`, not yet mounted into a running app) — existing
- ✓ Backend test suite for the market-data subsystem: 73 tests, 84% coverage (pytest + pytest-asyncio) — existing
- ✓ FastAPI app assembled and wired to serve the frontend static export + mount the SSE router; module-level router-singleton anti-pattern fixed — Phase 1
- ✓ Dark terminal UI: watchlist grid with live SSE-streamed prices, price-flash animations, sparklines, connection status indicator — Phase 1
- ✓ SQLite DB with lazy initialization: `users_profile`, `watchlist`, `positions`, `trades`, `portfolio_snapshots`, `chat_messages` tables, seeded with $10k cash and the 10 default tickers, per PLAN.md §7 — Phase 2
- ✓ Watchlist REST API: `GET/POST /api/watchlist`, `DELETE /api/watchlist/{ticker}`, per PLAN.md §8 — Phase 2
- ✓ Watchlist UI: add/remove tickers, loading/error states, scroll-bounded panel decoupled from chart height, accessible remove-button hit target — Phase 2
- ✓ Portfolio REST API: `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history`, per PLAN.md §8 — Phase 3
- ✓ Trading engine: atomic SQLite buy/sell fills, `BEGIN IMMEDIATE` write-lock, `math.isfinite()` quantity guard, post-trade + 30s periodic `portfolio_snapshots` — Phase 3
- ✓ Frontend portfolio UI: trade bar, live header cash/total-value, positions table, P&L-colored heatmap with click-to-select, P&L chart with pre-first-tick bootstrap point — per PLAN.md §10 — Phase 3

(See `.planning/codebase/ARCHITECTURE.md` and `STACK.md` for full detail on what's built. `planning/MARKET_DATA_SUMMARY.md` is the original component summary.)

### Active

- [ ] LLM chat integration: `POST /api/chat` via LiteLLM → OpenRouter (Cerebras inference, `openrouter/openai/gpt-oss-120b`), structured-output trade/watchlist auto-execution, `LLM_MOCK` mode for tests, per PLAN.md §9
- [ ] AI chat panel UI (Next.js static export, Tailwind dark theme) — per PLAN.md §10
- [ ] Docker packaging: multi-stage Dockerfile, start/stop scripts (mac + Windows), volume-mounted SQLite — per PLAN.md §11
- [ ] E2E test suite (Playwright, `LLM_MOCK=true`) per PLAN.md §12
- [ ] Version-counter-skipped-on-empty-cache bug, daily-vs-tick-to-tick % change spec mismatch — see `.planning/codebase/CONCERNS.md` (router singleton fixed in Phase 1)
- [ ] Mobile tap-target confirmation for trade bar controls and stale local-validation copy outside the Copywriting Contract — see 03-UI-REVIEW.md fixes #2/#3 (advisory, non-blocking)

### Out of Scope

- User accounts / login / multi-user auth — single hardcoded `user_id="default"` throughout, per PLAN.md §7
- Limit orders, order book, partial fills — market orders only, instant fill, per PLAN.md §2/§6
- Postgres or any external DB server — SQLite only, per PLAN.md §3
- Trade confirmation dialogs or fees — deliberate zero-friction design for the AI-driven demo, per PLAN.md §9
- Cloud deployment automation (Terraform/App Runner) — explicitly a stretch goal, not core build, per PLAN.md §11

## Context

- **Prior work:** The market-data component (`backend/app/market/`) was built and reviewed in an earlier milestone (see `planning/archive/` and `planning/MARKET_DATA_SUMMARY.md`). It is solid in isolation (84% test coverage) but was never wired into a real FastAPI application — there is currently no `app = FastAPI()` entrypoint, no Docker config, and no DB, portfolio, watchlist, or LLM code anywhere in the repo.
- **Frontend state:** `frontend/` currently contains only Next.js scaffolding (`lib/`, `next-env.d.ts`, build output in `out/`) — no application UI has been built yet.
- **Test state:** `test/` (Playwright E2E) has only `node_modules/` installed — no tests written yet.
- **Codebase map:** Full technical detail lives in `.planning/codebase/` (STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, INTEGRATIONS.md, CONCERNS.md), generated via `/gsd-map-codebase` immediately before this PROJECT.md was written.
- **Known backend gaps** (from `.planning/codebase/CONCERNS.md`), to be fixed opportunistically while building the API layer rather than as a dedicated phase:
  - `backend/app/market/stream.py` declares its `APIRouter` at module level; the factory decorates handlers onto this shared singleton, so calling it twice would double-register routes.
  - Cache version counter can be skipped when the cache is empty.
  - Spec ambiguity between daily % change and tick-to-tick % change in `PriceUpdate`.

## Constraints

- **Tech stack**: FastAPI + uv (Python 3.12+) backend, Next.js (TypeScript, static export) frontend, SQLite, SSE (not WebSockets), LiteLLM → OpenRouter/Cerebras — all fixed by PLAN.md, not open for reconsideration
- **Single container, single port**: Everything (API + static frontend) must serve from one FastAPI process on port 8000 — per PLAN.md §3
- **No auth**: Single-user, hardcoded `user_id="default"` — per PLAN.md §7

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `planning/PLAN.md` remains the single authoritative spec; PROJECT.md tracks scope/status against it rather than re-deriving vision | Spec is already comprehensive and was confirmed unchanged during project init questioning | ✓ Good |
| Codebase mapped via `/gsd-map-codebase` before defining requirements | Existing market-data backend needed to be understood precisely (what's built vs. what CONCERNS.md flags as gaps) before scoping the roadmap | ✓ Good |
| Known market-data backend gaps (router singleton, version-counter bug, % change spec mismatch) folded into the upcoming API-layer phase rather than a dedicated cleanup phase | User's explicit choice during init questioning — fix while wiring, don't block on a separate pass | — Pending |
| No scope changes from PLAN.md; build in dependency order (DB → API/portfolio → frontend → LLM chat → Docker) | User confirmed no priority changes during init questioning | — Pending |
| Watchlist remove-button hit target sized to ~24x24px with a permanent (not hover-only) background affordance, and the watchlist panel bounded with internal scroll decoupled from main-chart height | UAT surfaced both as real usability gaps (sub-24px WCAG-violating hit box; unbounded panel driving page scroll and stretching the chart) — fixed in gap-closure plan 02-05, reconfirmed live | ✓ Good |
| `workflow.use_worktrees` set to `false` for the project (Phase 3 execution) | Claude Code's worktree isolation forks from `origin/HEAD`, which kept lagging behind local `HEAD` mid-phase with no push in the loop; every wave's worktree would have missed the phase's own plan files | ✓ Good — re-enabled after the branch was merged into `main` and local caught back up |
| Trade quantity validated with `math.isfinite()`, not just `> 0`; `execute_trade`'s transaction opens with `BEGIN IMMEDIATE` | Phase 3 code review found a `NaN` quantity crashed the trade endpoint with an unhandled 500 (comparisons against `NaN` are always `False`), and a read-then-write race window across concurrent trades | ✓ Good — both independently reproduced pre-fix and re-verified post-fix |
| The `03-VALIDATION.md` and `03-SECURITY.md` drafts (authored at plan time, before code existed) were corrected in place rather than treated as fresh audits | One planned test name (`test_get_portfolio_fresh_db`) never matched the executor's actual name; the underlying coverage existed, only the draft's guess was stale | ✓ Good — 12/12 mapped commands re-verified green, `threats_open: 0` |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-20 after Phase 3*

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
- ✓ LLM chat integration: `POST /api/chat` via LiteLLM → OpenRouter (Cerebras inference, `openrouter/openai/gpt-oss-120b`), structured-output trade/watchlist auto-execution, `LLM_MOCK` mode for tests, per PLAN.md §9 — Phase 4
- ✓ AI chat panel UI (Next.js static export, Tailwind dark theme), inline trade/watchlist-change confirmation pills, persisted chat history — per PLAN.md §10 — Phase 4
- ✓ Docker packaging: two-stage Dockerfile (build-time path assertions, non-root runtime user, no secrets/DB in image layers), `.env.example`, zero-key simulator fallback — per PLAN.md §11 — Phase 5
- ✓ Idempotent operator lifecycle: `scripts/start_mac.sh`/`stop_mac.sh` (bash), `start_windows.ps1`/`stop_windows.ps1` (PowerShell), `docker-compose.yml` as a third equivalent encoding — never destroys the `finally-data` volume, verified restart-persistence round trip against a real Docker daemon — Phase 5
- ✓ Production dependency hygiene: `rich` demoted to a `demo` extra, `massive` SDK import made lazy so the default simulator path no longer depends on it at module load — Phase 5
- ✓ E2E test suite (Playwright, `LLM_MOCK=true`, sequential/non-parallel) covering fresh-start, watchlist, trading, portfolio viz, chat, and SSE reconnect — 6 spec files, 10 tests, run via `docker compose -f test/docker-compose.test.yml up --build` — per PLAN.md §12 — Phase 5

(See `.planning/codebase/ARCHITECTURE.md` and `STACK.md` for full detail on what's built. `planning/MARKET_DATA_SUMMARY.md` is the original component summary.)

### Active

None — all `planning/PLAN.md` requirements (MKT, WTCH, TRADE, CHAT, OPS) are shipped and validated as of Phase 5. See Out of Scope / Context below for known non-blocking residue.

### Out of Scope

**Deliberate design non-goals:**
- User accounts / login / multi-user auth — single hardcoded `user_id="default"` throughout, per PLAN.md §7
- Limit orders, order book, partial fills — market orders only, instant fill, per PLAN.md §2/§6
- Postgres or any external DB server — SQLite only, per PLAN.md §3
- Trade confirmation dialogs or fees — deliberate zero-friction design for the AI-driven demo, per PLAN.md §9
- Cloud deployment automation (Terraform/App Runner) — explicitly a stretch goal, not core build, per PLAN.md §11

**Known residue, carried forward, non-blocking (no phase ever revisited these code paths):**
- Version-counter-skipped-on-empty-cache bug, daily-vs-tick-to-tick % change spec mismatch — see `.planning/codebase/CONCERNS.md` (router singleton fixed in Phase 1; these two remain unaddressed through Phase 5)
- Mobile tap-target confirmation for trade bar controls and stale local-validation copy outside the Copywriting Contract — see 03-UI-REVIEW.md fixes #2/#3
- `MassiveDataSource._poll_once()` reads `snap.last_trade.timestamp`, which does not exist on the installed `massive==2.2.0` `LastTrade` model (real field is `sip_timestamp`) — every snapshot silently drops, so the *optional* real-market-data path (`MASSIVE_API_KEY` set) delivers no prices. Traced to a pre-Phase-5 commit, not introduced by any shipped phase. Does not affect the default GBM simulator path. Flagged CR-01 in `05-REVIEW.md`, user chose to defer rather than fix in-phase.
- `scripts/start_mac.sh` / `start_windows.ps1`'s `--build`/`-Build` flag doesn't force-recreate an already-running container, so a rebuilt image silently has no effect until the container is stopped first — WR-01 in `05-REVIEW.md`, deferred alongside CR-01

## Current State

**v1.0 MVP shipped 2026-09-25** (tag `v1.0`). `docker build -t finally . && ./scripts/start_mac.sh` (or `start_windows.ps1`, or `docker compose up -d`) brings up the full workstation at `http://localhost:8000` — streaming watchlist, trading, AI chat copilot, portfolio persisted across restarts. 224 backend tests + 158 frontend tests + 10 Playwright E2E tests, all green. `05-VERIFICATION.md` independently re-proved all four Phase 5 success criteria against real Docker containers. Phase artifacts archived to `.planning/milestones/v1.0-phases/`; roadmap/requirements archived to `.planning/milestones/v1.0-ROADMAP.md` / `v1.0-REQUIREMENTS.md`.

## Next Milestone Goals

No fresh requirements defined yet — run `/gsd-new-milestone` to scope v1.1. Candidates surfaced by v1.0's known residue (not pre-decided, just visible from this milestone's Out of Scope / Blockers list):

- Fix `MassiveDataSource._poll_once()`'s `snap.last_trade.timestamp` bug (CR-01) so the optional real-market-data path actually delivers prices
- Fix `--build`/`-Build` not force-recreating an already-running container (WR-01)
- Mobile tap-target sizing and stale validation copy in the trade bar (03-UI-REVIEW.md #2/#3)
- Version-counter-skipped-on-empty-cache and daily-vs-tick-to-tick % change spec mismatch (pre-existing, never touched through Phase 5)
- DEPL-01: one-command cloud deployment (Terraform/App Runner) — explicit v2 stretch goal in REQUIREMENTS.md

## Context

**Milestone complete (2026-09-24):** all 5 phases shipped. See Current State above for the live-system summary.

- **Origin:** The market-data component (`backend/app/market/`) was built and reviewed in an earlier milestone (see `planning/archive/` and `planning/MARKET_DATA_SUMMARY.md`) before this milestone wired it into a real FastAPI application, added the DB/portfolio/watchlist/LLM layers, and packaged it for one-command delivery.
- **Codebase map:** Full technical detail lives in `.planning/codebase/` (STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, INTEGRATIONS.md, CONCERNS.md) — current as of Phase 5's own audits (`05-VALIDATION.md`, `05-SECURITY.md`, `05-REVIEW.md`).
- **Known backend gaps carried through to milestone close** (see Out of Scope above for full detail): the original router-singleton bug was fixed in Phase 1; the version-counter-skipped-on-empty-cache bug and the daily-vs-tick-to-tick % change spec mismatch were never revisited and remain open; a new pre-existing bug (CR-01, `MassiveDataSource` reading a nonexistent SDK attribute) was found and deliberately deferred during Phase 5 closeout.

## Constraints

- **Tech stack**: FastAPI + uv (Python 3.12+) backend, Next.js (TypeScript, static export) frontend, SQLite, SSE (not WebSockets), LiteLLM → OpenRouter/Cerebras — all fixed by PLAN.md, not open for reconsideration
- **Single container, single port**: Everything (API + static frontend) must serve from one FastAPI process on port 8000 — per PLAN.md §3
- **No auth**: Single-user, hardcoded `user_id="default"` — per PLAN.md §7

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `planning/PLAN.md` remains the single authoritative spec; PROJECT.md tracks scope/status against it rather than re-deriving vision | Spec is already comprehensive and was confirmed unchanged during project init questioning | ✓ Good |
| Codebase mapped via `/gsd-map-codebase` before defining requirements | Existing market-data backend needed to be understood precisely (what's built vs. what CONCERNS.md flags as gaps) before scoping the roadmap | ✓ Good |
| Known market-data backend gaps (router singleton, version-counter bug, % change spec mismatch) folded into the upcoming API-layer phase rather than a dedicated cleanup phase | User's explicit choice during init questioning — fix while wiring, don't block on a separate pass | ⚠️ Partial — router singleton fixed in Phase 1; version-counter-skipped-on-empty-cache and daily-vs-tick-to-tick % change mismatch never revisited through Phase 5, carried as known residue |
| No scope changes from PLAN.md; build in dependency order (DB → API/portfolio → frontend → LLM chat → Docker) | User confirmed no priority changes during init questioning | ✓ Good — all 5 phases shipped in exactly this order, zero PLAN.md scope changes |
| Watchlist remove-button hit target sized to ~24x24px with a permanent (not hover-only) background affordance, and the watchlist panel bounded with internal scroll decoupled from main-chart height | UAT surfaced both as real usability gaps (sub-24px WCAG-violating hit box; unbounded panel driving page scroll and stretching the chart) — fixed in gap-closure plan 02-05, reconfirmed live | ✓ Good |
| `workflow.use_worktrees` set to `false` for the project (Phase 3 execution) | Claude Code's worktree isolation forks from `origin/HEAD`, which kept lagging behind local `HEAD` mid-phase with no push in the loop; every wave's worktree would have missed the phase's own plan files | ✓ Good — re-enabled after the branch was merged into `main` and local caught back up |
| Trade quantity validated with `math.isfinite()`, not just `> 0`; `execute_trade`'s transaction opens with `BEGIN IMMEDIATE` | Phase 3 code review found a `NaN` quantity crashed the trade endpoint with an unhandled 500 (comparisons against `NaN` are always `False`), and a read-then-write race window across concurrent trades | ✓ Good — both independently reproduced pre-fix and re-verified post-fix |
| The `03-VALIDATION.md` and `03-SECURITY.md` drafts (authored at plan time, before code existed) were corrected in place rather than treated as fresh audits | One planned test name (`test_get_portfolio_fresh_db`) never matched the executor's actual name; the underlying coverage existed, only the draft's guess was stale | ✓ Good — 12/12 mapped commands re-verified green, `threats_open: 0` |
| Phase 4: `litellm` and `pydantic` (both SUS-flagged by the Package Legitimacy Audit) approved after human review of PyPI/GitHub provenance; `get_chat_response` wraps the LLM call and JSON parse in one try/except so the route never raises on a malformed model response | Blocking human checkpoint per protocol; degrade-to-readable-message is safer than a 500 on an LLM integration | ✓ Good |
| Phase 4: removing a watchlist ticker with an open position now blocks (Phase 4 D-01 supersedes the Phase 3 03-01 truth that allowed it), enforced once in `remove_watchlist_ticker()` so both the manual DELETE route and the new chat-dispatch path inherit it identically | Chat gave the AI a second way to remove a watched ticker; the guard needed to live below both entry points, not be duplicated in each | ✓ Good — no previously-passing test broken |
| Phase 5: local `main` was pushed to `origin/main` (17 commits) mid-phase, before dispatching Wave 3's executors | Claude Code's `isolation="worktree"` forks from `origin/HEAD`; local had drifted 17 commits ahead with no push in the loop, which would have forced sequential execution directly on the protected `main` branch (executor's own commit guard refuses to commit on a protected branch without `git.allow_default_branch_commits: true`). Pushing restored `origin/HEAD == HEAD`, and worktree isolation resumed normally — same pattern as the Phase 3 decision above, this time resolved by pushing rather than disabling worktrees. | ✓ Good — both Wave 3 plans executed in real parallel worktrees as designed |
| Phase 5: `docker-compose.yml`'s named volume pinned explicitly (`name: finally-data`) rather than left to Compose's default project-name-prefixed naming | Compose's default naming is derived from the containing directory name, which differs between the worktree checkout and the operator's real checkout — would have silently mounted a second, empty volume, contradicting the "same store either way" requirement | ✓ Good — caught and fixed during 05-02 execution, re-verified against a real Docker daemon |
| Phase 5: `MassiveDataSource._poll_once()`'s `snap.last_trade.timestamp` bug (CR-01, pre-existing, not introduced by any shipped phase) left unfixed | User chose "defer and continue" when code review surfaced it during Phase 5 closeout — doesn't affect the default simulator path the milestone's success criteria depend on | — Deferred, tracked in Out of Scope |

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
*Last updated: 2026-09-25 after v1.0 milestone close*

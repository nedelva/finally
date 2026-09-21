---
gsd_state_version: "1.0"
current_phase: 04
current_phase_name: AI Copilot
status: executing
stopped_at: Phase 4 context gathered
last_updated: "2026-09-21T13:32:39.516Z"
last_activity: 2026-09-21
last_activity_desc: Phase 04 execution started
state_head: d765f6e2a279d921ef5ca3d606d839f820b0d81c
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 17
  completed_plans: 14
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-20)

**Core value:** The user can watch live prices stream, place simulated trades, and have an AI assistant that can see the portfolio and act on it in natural language — all in one dependency-free `docker run`.
**Current focus:** Phase 04 — AI Copilot

## Current Position

Phase: 04 (AI Copilot) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 04
Last activity: 2026-09-21 — Phase 04 execution started

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**

- Total plans completed: 14
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 5 | - | - |
| 03 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 20min | 3 tasks | 19 files |
| Phase 01 P02 | 28min | 2 tasks | 10 files |
| Phase 01 P03 | 13min | 2 tasks | 6 files |
| Phase 01 P04 | 35min | 2 tasks | 6 files |
| Phase 01 P05 | 30min | 2 tasks | 9 files |
| Phase 02 P01 | 15min | 3 tasks | 21 files |
| Phase 02 P02 | 13min | 3 tasks | 11 files |
| Phase 02 P03 | 20min | 2 tasks | 9 files |
| Phase 02 P05 | 15min | 2 tasks | 5 files |
| Phase 03 P01 | 23min | 2 tasks | 11 files |
| Phase 03 P02 | 18min | 2 tasks | 7 files |
| Phase 03 P03 | 15min | 2 tasks | 5 files |
| Phase 03 P04 | 55min | 3 tasks | 15 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: `planning/PLAN.md` stays the authoritative spec; PROJECT.md and ROADMAP.md track scope against it, never re-derive it.
- [Init]: Known market-data defects (router singleton, empty-cache version counter, tick-to-tick vs daily % change) are fixed inside the phase that touches them — no dedicated cleanup phase.
- [Roadmap]: Phase 1 stands up the FastAPI app and serves the static export via `StaticFiles`, so every phase exercises the production single-port serving path before Docker packaging in Phase 5.
- [Roadmap]: Full PLAN.md §7 schema (including `positions`, `trades`, `portfolio_snapshots`, `chat_messages`) is created in Phase 2, avoiding a second schema pass later.
- [Phase 01]: Anchored .gitignore lib/ rule to repo root (/lib/) rather than adding a negation line — Narrower single-character fix per plan's explicit instruction; leaves no second rule to reason about
- [Phase 01]: Accepted Next.js build-time tsconfig.json auto-correction (jsx: preserve -> react-jsx) — Next 16 Turbopack mandates react-jsx for the App Router's automatic JSX runtime; fighting it would break the build
- [Phase 01]: SSE integration test drives app.main's own module-level app via a real bound uvicorn server (not httpx.ASGITransport/TestClient, which fully drain streaming responses and deadlock on this endpoint's disconnect-only generator)
- [Phase 01]: Confirmed the pre-existing stream.py module-level router singleton (CONCERNS.md) causes a second create_app() call in-process to silently route to the wrong, unstarted PriceCache -- worked around in the test without touching stream.py, left for plan 01-03 to fix
- [Phase 01]: SSE tests against the endless generator use a real bound uvicorn.Server, never httpx.ASGITransport/TestClient — ASGITransport fully drains the response body before returning anything, deadlocking on this disconnect-only generator; confirmed empirically, matching 01-02's identical finding for test_main.py
- [Phase 01]: PriceUpdate splits previous_price (direction/flash) from a new session_open_price (change/change_percent) — One field cannot serve both the tick-to-tick flash trigger and the daily-style watchlist percentage; to_dict()'s seven-key shape is unchanged so no frontend type changes are required
- [Phase 01]: [Phase 01]: Watchlist.tsx's header ships all four columns (Symbol, Price, Chg %, Chart) in Task 1, ahead of WatchlistRow's fourth cell landing in Task 2 - matches the plan's own Task 1 action text and keeps Task 2 within its declared file list
- [Phase 01]: [Phase 01]: Sparkline's line stroke is a literal hex (#209dd7), not var(--color-primary-blue) - SVG presentation attributes don't reliably resolve CSS custom properties, matching RESEARCH.md's own code example
- [Phase 01]: [Phase 01]: WatchlistRow passes explicit width/height to Sparkline in production, not just in tests - deterministic table-cell sizing and exercises the same explicit-dimension path the tests verify
- [Phase 01]: Amber connecting/reconnecting states share one CSS animate-pulse class rather than differentiating them — From the user's point of view both mean 'not yet live, not yet given up on'; the plan's three-distinct-class grouping assertion depends on this
- [Phase 01]: Watchlist.test.tsx's row-role assertion split into row(1)+button(10) after WatchlistRow gained a required button role — role=button on the tr overrides its implicit row role for the ten body rows; the header row keeps role=row — Rule 3 fix, not a scope change
- [Phase 02]: [Phase 02]: users_profile.id IS the user key for that table (no redundant user_id column) — matches PLAN.md §7's own column list
- [Phase 02]: [Phase 02]: simulator.py/massive_client.py normalize_ticker() call sites deferred to plan 02-02, not this plan — 02-01's own files_modified list and Task 2 action text are authoritative over RESEARCH.md/PATTERNS.md
- [Phase 02]: [Phase 02]: page.tsx's selectedTicker-reset-on-removal guard deferred to plan 02-03 — not in 02-01's files_modified list, and inert until the remove button ships
- [Phase 02]: [Phase 02]: Repository-level TDD RED tests use a raise-NotImplementedError stub (not an unresolved import) so pytest collection succeeds and the named test fails on the planned behavior, not at collection time
- [Phase 02]: [Phase 02]: Watchlist.tsx panel border/background classes moved from <table> to a wrapper <div> since a <form> cannot be a child of <table> before <thead>
- [Phase 02]: DELETE /api/watchlist/{ticker} mirrors POST's normalize->act->notify ordering; empty state replaces the whole table, not just tbody; failed DELETE reuses the existing add-ticker error slot — Consistency with 02-02's established route pattern and the plan's own backstop guidance to avoid inventing a second error-rendering mechanism
- [Phase 02]: [Phase 02]: Wrapped only the loading/loadError/empty/table branch in watchlist-scroll-container, not the whole panel div - keeps the add-ticker form always visible above the scrollable region, deliberate deviation from the debug session's literal Watchlist.tsx:92 fix location
- [Phase 02]: [Phase 02]: Left the remove <td>'s py-1.5 padding untouched when giving the remove button a 24x24px hit box - the sparkline <td> (36px) was already the row's tallest cell and remains tied, not exceeded
- [Phase 02]: [Phase 02]: Did not modify MainChart.tsx to fix the chart/watchlist height coupling - lg:items-start on page.tsx's row container alone removes the stretch constraint MainChart's h-full needed to couple against
- [Phase 03]: [Phase 03]: avg_cost recomputed only on buy (weighted average); untouched on sell — recomputing on sell would corrupt every later unrealized-P&L figure
- [Phase 03]: [Phase 03]: D-01 watchlist membership enforced via a SELECT on the trade's own transaction connection, not via get_watchlist() or a PriceCache hit
- [Phase 03]: [Phase 03]: 1e-9 epsilon governs both the over-sell rejection and the close-out delete so float dust can never strand a position
- [Phase 03]: useLiveTotalValue routes every position through deriveLivePosition rather than recomputing inline, guaranteeing the header total and positions table always agree — Shared math is the only way both consumers stay in sync with the D-03 no-live-tick fallback
- [Phase 03]: Header cash/total-value figures are neutral gray-100/tabular-nums with no color or flash animation — Per-position P&L coloring already lives in the positions table/heatmap; a second color signal for the same number would compete with it
- [Phase 03]: [Phase 03]: record_snapshot routes through the shared total_portfolio_value helper so the periodic writer, post-trade writer, and build_portfolio can never disagree on a valuation
- [Phase 03]: [Phase 03]: snapshot_loop sleeps before its first write — the post-trade writer and the frontend's D-13 bootstrap point already cover the first interval, avoiding a duplicate write at startup
- [Phase 03]: [Phase 03]: PnLChart's dot renders at r={2} (not MainChart's dot={false}) purely for jsdom testability, asserting an exact plotted-point count via .recharts-dot

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Seed prices in `backend/app/market/seed_prices.py` are stale (NVDA 800, MSFT 420); simulator demos will look dated until refreshed.
- `.env.example` does not exist; `OPENROUTER_API_KEY` is required from Phase 4 onward.
- Cache version-counter-skipped-on-empty-cache bug and daily-vs-tick-to-tick % change spec mismatch (`.planning/codebase/CONCERNS.md`) remain unfixed — deferred to whichever future phase touches that code path.
- [Phase 3] Mobile tap-target confirmation for trade bar controls and a local validation-copy string outside the Copywriting Contract remain open (03-UI-REVIEW.md fixes #2/#3) — advisory, non-blocking.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Deployment | DEPL-01: one-command cloud deploy (Terraform/App Runner) | v2 | 2026-09-17 | v1 |

## Session Continuity

Last session: 2026-09-21T08:22:08.230Z
Stopped at: Phase 4 context gathered
Resume file: /Users/valeriu/AICourses/finally/.planning/phases/04-ai-copilot/04-CONTEXT.md

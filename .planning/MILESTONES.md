# Milestones

## v1.0 MVP (Shipped: 2026-09-25)

**Phases completed:** 5 phases, 22 plans, 53 tasks

**Key accomplishments:**

- Repaired the `.gitignore` bug that silently excluded `frontend/lib/` from git, then authored the entire missing Next.js 16 + Tailwind v4 + Vitest scaffold from scratch, closing with 7 passing behavioural tests for the pre-existing `usePriceFlash` hook (MKT-02).
- Mounted the previously-dead-code market-data engine into a real FastAPI app for the first time (lifespan-managed source, `/api/health`, last-registered `StaticFiles` mount) and gave the frontend its first live data via a single shared `EventSource` behind a React context, proven end to end by a real bound uvicorn server rather than a buffered ASGI test transport.
- Per-call SSE router construction with an emptiness-gated version counter and keepalive comments, plus a session-anchored change/change_percent split from the tick-anchored direction — all four ROADMAP.md-assigned market-data defects closed with the subsystem's first SSE integration tests.
- Replaced plan 01-02's deliberately plain price table with a real terminal-style watchlist grid: a container/pure-row split reading the shared SSE context once, per-cell price-flash driven by the existing 01-01 hook, session-change colour independent of the flash (per 01-03's split anchors), and an axis-free Recharts sparkline per row that is explicitly guarded for the zero-point and one-point states every row passes through on first paint.
- Four-state connection dot (colour + text + data attribute) and a click-driven, labelled-axis main chart close out Phase 1's Walking Skeleton — every watchlist row is now keyboard-selectable, and the header carries the terminal's sole liveness signal with no placeholder portfolio figures.
- SQLite persistence layer (all six PLAN.md §7 tables), `GET /api/watchlist` REST endpoint, and a database-driven app lifespan, wired end-to-end so the browser's watchlist grid now renders from the database instead of the SSE stream's ever-growing ticker set.
- `POST /api/watchlist` (validate → persist → notify), shared ticker normalization repaired across both `MarketDataSource` implementations, and an add-ticker form wired end-to-end in the watchlist panel — all three tasks built RED-then-GREEN with separate commits per phase.
- `DELETE /api/watchlist/{ticker}` (204/404, watchlist-table-only deletion), a stopPropagation-guarded per-row `×` remove button, a "Watchlist is empty" state, and a `page.tsx` selection guard that moves the main chart off a ticker the moment it leaves the watchlist — closing the last open loop from the tracer.
- Watchlist.tsx now reads `loading`/`error` from `useWatchlist()` and renders three distinct states (loading, load-error, genuine-empty) instead of silently collapsing every non-populated case into the same empty-state copy.
- 24x24px accessible remove hit-area with a permanent visible affordance, plus an lg:-scoped internal watchlist scroll bounded to 440px, decoupled from the main chart's height via lg:items-start.
- SQLite trade engine with atomic buy/sell fills, a shared D-03-aware valuation helper for the post-trade snapshot, and a live trade bar wired end-to-end in the terminal UI.
- Live header cash + portfolio value via a pure `useLiveTotalValue` derivation over `deriveLivePosition`, closing the `hooks.ts` gap `usePortfolio`'s own docstring had reserved.
- Live six-column positions table and a P&L-coloured recharts Treemap heatmap, both recomputing off the same `deriveLivePosition` math the header total already uses, with heatmap tiles wired into the existing click-to-select callback.
- Periodic 30-second portfolio snapshot background task, a shared-valuation-verified `GET /api/portfolio/history` endpoint, and a full-history P&L chart with a pre-first-tick bootstrap point — closing out PORT-06 and completing Phase 3.
- End-to-end `POST /api/chat` grounded in the real portfolio via LiteLLM/OpenRouter/Cerebras (mock-backed in tests), persisted to `chat_messages`, and surfaced through a docked, collapsible AI Copilot panel in the terminal's new right column.
- Closed the held-position watchlist-removal gap in the shared repository function, built the chat dispatch loop that lets the assistant execute trades and watchlist changes through the exact Phase 2/3 validation paths, and rendered every executed/failed action as an inline colour-coded pill in the conversation.
- Closed the read half of CHAT-06: `GET /api/chat/history` returns every persisted turn with actions already parsed, and `ChatPanel` now hydrates from it on mount instead of always starting from the seed greeting.
- A two-stage Dockerfile (node:20-slim -> uv:python3.12-trixie-slim) that builds, runs non-root, serves the full FinAlly workstation on port 8000 with a volume-persisted SQLite DB, plus the zero-key simulator-fallback path proven end to end via `.env.example`.
- Idempotent start/stop scripts (bash + PowerShell) and a docker-compose.yml wrapper, all verified against real Docker containers to reach the exact same `finally-data` store, with trades, watchlist edits, and chat history proven to survive a full stop/start cycle.
- Moved `rich` out of `backend/pyproject.toml`'s core dependencies into a new `demo` extra and deferred the Polygon (`massive`) SDK's imports in `MassiveDataSource` from module scope into `start()`/`_fetch_snapshots()`, so a simulator-only container no longer loads the Polygon SDK to import its market module.
- Stood up a two-service Playwright/Docker Compose E2E harness that builds the real production image and proves, in both directions, that the fresh-start scenario (default watchlist, $10,000.00 cash, streaming prices) passes against the packaged container and the gate fails loudly when it should.
- Completed the PLAN.md section 12 E2E matrix — watchlist, trading, portfolio visuals, mocked AI chat, and SSE reconnect — all six scenarios green against the packaged container, with two scenarios rewritten mid-execution after their planned techniques were verified empirically not to work.

---

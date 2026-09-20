# Phase 3: Trading & Portfolio - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The user can buy and sell shares at the live streaming price and watch a $10,000 portfolio respond — cash, holdings, P&L, weight, and value over time. Delivers `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history` (PORT-01..06), plus the frontend positions table, portfolio heatmap, P&L chart, and trade bar. Depends on Phase 2 (SQLite schema and watchlist already exist). Trade execution reads fill price from `PriceCache`, writes an append-only `trades` row, upserts `positions` with recomputed average cost, and records a `portfolio_snapshots` row every 30s plus immediately after each trade.

</domain>

<decisions>
## Implementation Decisions

### Trade scope
- **D-01:** `POST /api/portfolio/trade` only accepts tickers already on the user's watchlist — guarantees a live `PriceCache` entry exists at fill time; no auto-add-to-tracking side effect on trade.
- **D-02:** The trade bar's ticker field is a dropdown/select populated from the current watchlist, not free text — makes an invalid-ticker trade unreachable from the UI rather than caught only at submit.

### Held-ticker price fallback
- **D-03:** If a position's ticker is later removed from the watchlist (Phase 2 permits removing any ticker, including ones held), `GET /api/portfolio` falls back `current_price` to that position's `avg_cost` — unrealized P&L reads as $0/flat rather than a stale or wrong number. — **Reversibility:** costly — **rationale:** the positions table, heatmap coloring, and `positionMath.ts`'s live-price recompute must all treat "ticker not in `PriceCache`" as "use avg_cost," not null/zero; changing this fallback later means touching all three call sites plus their tests.
- **D-04:** Watchlist removal behavior is Claude's discretion for this phase — default to leaving it unrestricted (removal always succeeds, per Phase 2's existing behavior) unless implementing the avg_cost fallback turns out to require otherwise.

### Trade bar interaction
- **D-05:** Quantity input accepts fractional shares (matches `positions.quantity REAL` and PLAN.md §2/§7) — plain decimal-capable number input, not integer-only.
- **D-06:** After a successful fill, the trade bar form clears (ticker and quantity reset to empty) — ready for the next order, avoids accidental double-submission of the same trade.
- **D-07:** No confirmation dialog (per PLAN.md §2). Fill confirmation is an inline flash near the trade bar (e.g. "Bought 2 AAPL @ $190.32") that fades like the existing watchlist price-flash pattern; cash and positions update live from the trade response / next portfolio fetch, so no separate modal or toast is introduced.
- **D-08:** Failed trades (insufficient cash/shares) surface inline near the trade bar using the same error-slot pattern already established for watchlist add/remove failures (Phase 2) — no new error-display mechanism.

### Heatmap & P&L chart
- **D-09:** Heatmap reuses `recharts`'s built-in `Treemap` component (already an installed dependency — no new library needed).
- **D-10:** Clicking a heatmap tile selects that ticker in the main chart area, identical to clicking a watchlist row — one consistent click-to-select interaction across the terminal.
- **D-11:** Empty portfolio (fresh $10k cash, zero positions) renders an empty-state message in the heatmap panel ("No positions yet — buy a ticker to see it here"), not a hidden panel.
- **D-12:** The P&L chart shows the full snapshot history with no time-range selector — simplest for a single-session demo; no decimation or windowing logic needed this phase.
- **D-13:** Before any `portfolio_snapshots` row exists (first ~30s after a fresh start), the P&L chart plots a single point from the current `GET /api/portfolio` total_value fetched on load, rather than showing an empty chart until the background task's first tick.

### Claude's Discretion
- Exact mechanics of watchlist removal when a position is open (see D-04) — implement whatever is simplest given the avg_cost fallback.
- Positions table column formatting/sorting order — not discussed; use existing table conventions from the watchlist.
- Whether the existing (but undocumented) `frontend/lib/types.ts` / `api.ts` / `positionMath.ts` contract shapes are treated as binding for the backend build — not explicitly discussed with the user this session, but these files are already committed production code from Phase 1 (not scratch/draft), so backend implementation should match their field names and shapes exactly (`Position.quantity/avg_cost/current_price/market_value/unrealized_pnl/unrealized_pnl_percent`, `TradeResponse` discriminated by `success` with both 200 and 400 as valid HTTP statuses, `PortfolioHistoryResponse.snapshots[]`) unless research surfaces a concrete reason to diverge.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `planning/PLAN.md` §2, §6, §7, §8 — trading UX rules (market orders, instant fill, no fees/confirmation), DB schema for `positions`/`trades`/`portfolio_snapshots`, portfolio/trade API endpoint definitions
- `.planning/ROADMAP.md` (Phase 3 section) — goal, success criteria, scope notes (30s snapshot cadence + post-trade snapshot both required)
- `.planning/REQUIREMENTS.md` — PORT-01..06 requirement text
- `.planning/codebase/CONCERNS.md` — known market-data defects (router singleton already fixed in Phase 1; version-counter-on-empty-cache bug and daily-vs-tick-to-tick % change ambiguity remain open, fix opportunistically if this phase's code path touches them)

### Existing frontend contract (undocumented but binding — see Claude's Discretion above)
- `frontend/lib/types.ts` — full existing `Position`, `Portfolio`, `TradeRequest`, `Trade`, `TradeResponse` (success/error union), `PortfolioSnapshot`, `PortfolioHistoryResponse` type definitions, committed in Phase 1. Its header comment references `planning/API_CONTRACT.md` and an `OWNERSHIP.md` — **neither file exists in the repo.** Treat `types.ts` itself as the source of truth for shape; consider authoring the missing `planning/API_CONTRACT.md` as part of this phase to stop the dangling reference, but this was not directly discussed with the user.
- `frontend/lib/api.ts` — existing `getPortfolio()`, `getPortfolioHistory()`, `postTrade()`, `addWatchlistTicker()`/`removeWatchlistTicker()` REST client functions and their exact status-code handling (note: `postTrade` treats both HTTP 200 and 400 as valid JSON bodies to parse, discriminated by the `success` field — not by status code alone)
- `frontend/lib/positionMath.ts` — existing `deriveLivePosition()` that recomputes market value/P&L/P&L% against a live SSE price, falling back to the REST snapshot's fields when no live tick exists — this is the frontend half of the D-03 avg_cost-fallback decision; backend must supply a `current_price` on positions that makes this fallback behave correctly server-side too

### Backend persistence layer (existing, Phase 2)
- `backend/app/db/schema.py` — `positions`, `trades`, `portfolio_snapshots` table DDL (already created; do not re-declare)
- `backend/app/db/repository.py` — existing repository function conventions (plain sync functions, own connection per call, `?` placeholders, `ValueError` for caller-level conditions) — new portfolio/trade repository functions should follow this same pattern
- `backend/app/db/connection.py` — `get_connection()` helper

### Market data (existing, prior milestone + Phase 1)
- `backend/app/market/cache.py` — `PriceCache.get_price(ticker)` / `get(ticker)` for reading fill prices
- `backend/app/market/simulator.py` — `add_ticker`/`remove_ticker` semantics (removing a ticker deletes its `PriceCache` entry — relevant to D-03)
- `backend/CLAUDE.md` — market data API usage reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/lib/types.ts`, `api.ts`, `positionMath.ts` — the entire client-side portfolio/trade data layer already exists and is tested-shape-compatible; new frontend components (positions table, heatmap, trade bar, P&L chart) should consume these as-is rather than inventing parallel types.
- `recharts` (already a frontend dependency) — has both the chart primitives already used for `MainChart` and a `Treemap` component for the heatmap; no new charting library needed.
- `backend/app/db/repository.py` watchlist functions — direct pattern template for new `positions`/`trades`/`portfolio_snapshots` repository functions (own connection per call, `with conn:` for writes, `ValueError` for validation failures translated at the route layer).
- Existing error-slot UI pattern from Watchlist.tsx (Phase 2) for inline add/remove failures — reuse for trade bar failures (D-08) and fill confirmations (D-07).

### Established Patterns
- Route handlers wrap all repository calls in `await asyncio.to_thread(...)` (per `repository.py`'s module docstring) — same pattern applies to new portfolio/trade routes.
- Price-flash CSS animation pattern (Phase 1, watchlist) — reused for trade-fill inline confirmation (D-07).
- Empty-state UI pattern for empty watchlist (Phase 2) — reused for empty heatmap (D-11).

### Integration Points
- New `backend/app/api/portfolio.py` (analogous to existing `backend/app/api/watchlist.py`) mounted in `backend/app/main.py`.
- Background snapshot task added alongside the existing market-data background task startup in `main.py`'s lifespan.
- Frontend `page.tsx` gains portfolio state (cash, positions, history) fetched via existing `lib/api.ts` functions, and a click-to-select wiring shared between watchlist rows and new heatmap tiles (D-10).

</code_context>

<specifics>
## Specific Ideas

- Trade-fill confirmation text should read naturally, e.g. "Bought 2 AAPL @ $190.32" / "Sold 1.5 NVDA @ $812.10" (D-07).
- Heatmap empty-state copy: "No positions yet — buy a ticker to see it here" (D-11).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Trading & Portfolio*
*Context gathered: 2026-09-20*

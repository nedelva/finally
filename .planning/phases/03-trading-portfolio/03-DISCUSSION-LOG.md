# Phase 3: Trading & Portfolio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 3-Trading & Portfolio
**Areas discussed:** Held-ticker price fallback, Trade bar interaction, Heatmap & P&L chart specifics

---

## Held-ticker price fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Watchlist-only | POST /api/portfolio/trade only accepts tickers already on the watchlist | ✓ |
| Any valid ticker | Trade endpoint auto-adds an untracked ticker on first trade | |

**User's choice:** Watchlist-only
**Notes:** Guarantees a live PriceCache entry always exists at fill time.

| Option | Description | Selected |
|--------|-------------|----------|
| Freeze at avg_cost | current_price falls back to avg_cost, P&L reads $0/flat | ✓ |
| Freeze at last known price | Snapshot the last PriceCache value before removal | |
| Block the removal | Prevent removing a watchlist ticker with an open position | |

**User's choice:** Freeze at avg_cost

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | Claude picks the simplest approach consistent with the fallback | ✓ |
| Must keep removal unrestricted | Explicitly confirm removal always succeeds | |

**User's choice:** You decide

---

## Trade bar interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Fractional allowed | Matches schema (quantity REAL) and PLAN.md | ✓ |
| Whole shares only | Simpler input, diverges from schema/PLAN.md | |

**User's choice:** Fractional allowed

| Option | Description | Selected |
|--------|-------------|----------|
| Clear the form | Ticker/quantity reset after a successful fill | ✓ |
| Keep values, show inline confirmation | Form stays filled for quick repeat trades | |

**User's choice:** Clear the form

| Option | Description | Selected |
|--------|-------------|----------|
| Inline flash + rely on live updates | Brief inline success text, fades like price-flash | ✓ |
| Toast notification | Transient corner toast | |

**User's choice:** Inline flash + rely on live updates

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown/select of watchlist tickers | Prevents invalid submissions entirely | ✓ |
| Free-text input, validated on submit | Simpler control, error shown after submit | |

**User's choice:** Dropdown/select of watchlist tickers

---

## Heatmap & P&L chart specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, selects main chart | Clicking a tile selects the ticker, same as watchlist | ✓ |
| No, heatmap is display-only | Heatmap doesn't drive chart selection | |

**User's choice:** Yes, selects main chart

| Option | Description | Selected |
|--------|-------------|----------|
| Empty-state message | Placeholder text when zero positions | ✓ |
| Hide the panel entirely | Panel doesn't render until a position exists | |

**User's choice:** Empty-state message

| Option | Description | Selected |
|--------|-------------|----------|
| Show all snapshots, no selector | Full history, no time-range controls | ✓ |
| Rolling window (last N points) | Caps chart to recent snapshots | |

**User's choice:** Show all snapshots, no selector

| Option | Description | Selected |
|--------|-------------|----------|
| Single point at $10,000 | Plot current portfolio value immediately on load | ✓ |
| Empty chart until first snapshot | Blank until GET /api/portfolio/history returns a row | |

**User's choice:** Single point at $10,000

---

## Claude's Discretion

- Watchlist-removal mechanics when a position is open in the removed ticker (default: leave unrestricted).
- Positions table column formatting/sorting order.
- Whether to author `planning/API_CONTRACT.md` to replace the dangling reference in `frontend/lib/types.ts` (existing types treated as binding regardless).

## Deferred Ideas

None — discussion stayed within phase scope.

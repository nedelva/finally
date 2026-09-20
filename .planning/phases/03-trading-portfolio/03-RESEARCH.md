# Phase 3: Trading & Portfolio - Research

**Researched:** 2026-09-20
**Domain:** Server-authoritative portfolio/trade ledger (SQLite) fed by an existing in-memory `PriceCache`; Recharts-based portfolio visualization on an existing Next.js/Tailwind terminal UI.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Trade scope**
- **D-01:** `POST /api/portfolio/trade` only accepts tickers already on the user's watchlist — guarantees a live `PriceCache` entry exists at fill time; no auto-add-to-tracking side effect on trade.
- **D-02:** The trade bar's ticker field is a dropdown/select populated from the current watchlist, not free text — makes an invalid-ticker trade unreachable from the UI rather than caught only at submit.

**Held-ticker price fallback**
- **D-03:** If a position's ticker is later removed from the watchlist (Phase 2 permits removing any ticker, including ones held), `GET /api/portfolio` falls back `current_price` to that position's `avg_cost` — unrealized P&L reads as $0/flat rather than a stale or wrong number. **Reversibility:** costly. **Rationale:** the positions table, heatmap coloring, and `positionMath.ts`'s live-price recompute must all treat "ticker not in `PriceCache`" as "use avg_cost," not null/zero; changing this fallback later means touching all three call sites plus their tests.
- **D-04:** Watchlist removal behavior is Claude's discretion for this phase — default to leaving it unrestricted (removal always succeeds, per Phase 2's existing behavior) unless implementing the avg_cost fallback turns out to require otherwise.

**Trade bar interaction**
- **D-05:** Quantity input accepts fractional shares (matches `positions.quantity REAL` and PLAN.md §2/§7) — plain decimal-capable number input, not integer-only.
- **D-06:** After a successful fill, the trade bar form clears (ticker and quantity reset to empty) — ready for the next order, avoids accidental double-submission of the same trade.
- **D-07:** No confirmation dialog (per PLAN.md §2). Fill confirmation is an inline flash near the trade bar (e.g. "Bought 2 AAPL @ $190.32") that fades like the existing watchlist price-flash pattern; cash and positions update live from the trade response / next portfolio fetch, so no separate modal or toast is introduced.
- **D-08:** Failed trades (insufficient cash/shares) surface inline near the trade bar using the same error-slot pattern already established for watchlist add/remove failures (Phase 2) — no new error-display mechanism.

**Heatmap & P&L chart**
- **D-09:** Heatmap reuses `recharts`'s built-in `Treemap` component (already an installed dependency — no new library needed).
- **D-10:** Clicking a heatmap tile selects that ticker in the main chart area, identical to clicking a watchlist row — one consistent click-to-select interaction across the terminal.
- **D-11:** Empty portfolio (fresh $10k cash, zero positions) renders an empty-state message in the heatmap panel ("No positions yet — buy a ticker to see it here"), not a hidden panel.
- **D-12:** The P&L chart shows the full snapshot history with no time-range selector — simplest for a single-session demo; no decimation or windowing logic needed this phase.
- **D-13:** Before any `portfolio_snapshots` row exists (first ~30s after a fresh start), the P&L chart plots a single point from the current `GET /api/portfolio` total_value fetched on load, rather than showing an empty chart until the background task's first tick.

### Claude's Discretion
- Exact mechanics of watchlist removal when a position is open (see D-04) — implement whatever is simplest given the avg_cost fallback.
- Positions table column formatting/sorting order — not discussed; use existing table conventions from the watchlist.
- Whether the existing (but undocumented) `frontend/lib/types.ts` / `api.ts` / `positionMath.ts` contract shapes are treated as binding for the backend build — treated as **binding** (see below): backend implementation must match their field names and shapes exactly (`Position.quantity/avg_cost/current_price/market_value/unrealized_pnl/unrealized_pnl_percent`, `TradeResponse` discriminated by `success` with both 200 and 400 as valid HTTP statuses, `PortfolioHistoryResponse.snapshots[]`) unless research surfaces a concrete reason to diverge. **Research did not surface a reason to diverge — see Code Examples.**

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-01 | $10,000 cash shown in header, updating live | `GET /api/portfolio` returns `cash_balance`/`total_value`; frontend computes live total via `deriveLivePosition` (already exists) fed by the shared SSE context — see Code Examples: `useLiveTotalValue` |
| PORT-02 | Buy shares at current market price, instant fill, no fees/confirmation | `POST /api/portfolio/trade` reads `PriceCache.get_price(ticker)`, validates cash, upserts `positions`, appends `trades` row — see Architecture Patterns: Trade Execution |
| PORT-03 | Sell shares at current market price, instant fill, no fees/confirmation | Same endpoint, `side="sell"`, validates held quantity, reduces/deletes `positions` row — see Common Pitfalls: Average-Cost Recompute and Epsilon Close-Out |
| PORT-04 | Positions table: ticker, qty, avg cost, current price, unrealized P&L, %change, live-updating | `GET /api/portfolio` supplies the REST snapshot; `positionMath.deriveLivePosition` (already exists) recomputes against SSE ticks — see Code Examples: PositionsTable |
| PORT-05 | Portfolio heatmap: treemap sized by weight, colored green/red by P&L | `recharts` `Treemap` with a custom `content` renderer — see Code Examples: Heatmap |
| PORT-06 | P&L chart: total portfolio value over time from snapshots | `GET /api/portfolio/history` + a 30s-interval background task + post-trade snapshot write — see Architecture Patterns: Snapshot Writer |
</phase_requirements>

## Summary

This phase adds a persistence-backed trading and portfolio-valuation layer on top of two already-complete subsystems: the SQLite repository layer (Phase 2, `backend/app/db/`) and the live `PriceCache`/SSE market-data engine (Phase 1, `backend/app/market/`). No new libraries are required on either side — `fastapi` 0.128.7 / `pydantic` 2.12.5 (backend) and `recharts` 3.10.1 (frontend) are already installed and already used for structurally identical work (the watchlist CRUD routes and `MainChart`'s line chart, respectively). The work is almost entirely **connecting** existing pieces in a new shape: a `portfolio.py` repository module and API router that mirror `watchlist.py`'s exact conventions (plain sync repository functions, one connection per call, `with conn:` for writes, `ValueError` translated to a 4xx at the route layer, `await asyncio.to_thread(...)` at every call site), plus four new frontend components (`TradeBar`, `PositionsTable`, `Heatmap`, `PnLChart`) that consume a frontend data-contract (`types.ts`, `api.ts`, `positionMath.ts`) that was **already built and committed in Phase 1** and must be treated as fixed.

The one genuinely new piece of domain logic is the trade-execution math: weighted-average-cost recompute on buy, epsilon-based zero-quantity close-out on sell, and cash-balance debit/credit — all inside a single SQLite transaction per trade to keep the read-current-state → validate → write sequence atomic. A second new piece is the background snapshot writer, which follows the same "async task started in `lifespan`, cancelled on shutdown" shape the market data source already establishes, just with its own 30-second cadence plus an explicit post-trade call from inside the trade route.

**Primary recommendation:** Build `backend/app/db/repository.py` additions (`get_positions`, `get_portfolio`, `execute_trade`, `record_snapshot`, `get_snapshots`) and `backend/app/api/portfolio.py` as direct structural mirrors of the existing watchlist repository/route pair, wire a snapshot background task into `main.py`'s `lifespan` alongside the market-source `start()`/`stop()` calls, and build the four new frontend components against the **already-existing** `types.ts`/`api.ts`/`positionMath.ts`/`hooks.ts` contract without modifying those files' shapes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trade validation & execution (cash/share checks, avg-cost recompute) | API / Backend | Database / Storage | Money math must be server-authoritative; SQLite transaction is the atomicity boundary |
| Fill-price lookup | API / Backend | — | Reads `PriceCache` (in-process, already owned by the backend tier) — never re-fetches or re-derives a price client-side |
| Portfolio valuation (cash + positions × current price) | API / Backend | Browser / Client | Backend computes the REST snapshot (`GET /api/portfolio`); browser recomputes a *live* variant client-side from SSE ticks via `deriveLivePosition` — both must agree when no live tick exists (the fallback contract) |
| Snapshot history for P&L chart | Database / Storage | API / Backend | `portfolio_snapshots` is an append-only time series; the API only reads/writes rows, it does not compute charting data |
| Positions table / heatmap / P&L chart rendering | Browser / Client | — | Pure presentation over `GET /api/portfolio` + `GET /api/portfolio/history` + SSE ticks; no server-side rendering in this Next.js static-export architecture |
| Trade bar (dropdown, quantity input, buy/sell buttons) | Browser / Client | — | Client-only form state; submission is a single `POST /api/portfolio/trade` call |

## Standard Stack

### Core
No new libraries required. This phase is 100% additive within the existing stack.

| Library | Version | Purpose | Why Standard (already established in this repo) |
|---------|---------|---------|--------------|
| fastapi | 0.128.7 [VERIFIED: backend/uv.lock] | `POST/GET /api/portfolio*` routers | Already the framework for `watchlist.py`, `stream.py`, `main.py` |
| pydantic | 2.12.5 [VERIFIED: backend/uv.lock] | `TradeRequest` request-body validation | Already used for `WatchlistAddRequest` in `watchlist.py:23-26` |
| sqlite3 (stdlib) | Python 3.14.7 stdlib [VERIFIED: `python3 -c "import sys; print(sys.version)"`] | `positions`/`trades`/`portfolio_snapshots` reads/writes | Already the persistence layer (`app/db/connection.py`, `app/db/repository.py`) — no ORM introduced |
| recharts | 3.10.1 [VERIFIED: frontend/node_modules/recharts/package.json:3] | `Treemap` (heatmap), `LineChart` (P&L chart) | Already used for `MainChart`'s `LineChart`; `Treemap` confirmed exported at the package's top-level entry point (03-UI-SPEC.md's own grep against `recharts/types/index.d.ts`) |

### Supporting
None needed — `asyncio.to_thread`, `threading.Lock` (already inside `PriceCache`), and Python's stdlib `uuid`/`datetime` cover every new backend need, matching `repository.py`'s existing conventions exactly.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `recharts` `Treemap` | A dedicated treemap library (`d3-hierarchy` direct, `@visx/hierarchy`) | Would add a new dependency for a component `recharts` already ships; rejected per D-09 and UI-SPEC's own verification |
| SQLite transaction (`with conn:`) for trade atomicity | Application-level locking (Python `threading.Lock` around trade execution) | SQLite's own writer serialization inside a single `with conn:` block is simpler and matches the existing repository pattern; an app-level lock would be redundant for a single-process, single-user app |
| Weighted-average cost basis | FIFO/LIFO lot tracking | PLAN.md's schema (`positions.avg_cost REAL`, one row per ticker) has no lot table — weighted-average is the only method the schema supports, and it's what every other retail paper-trading simulator uses for market-order-only portfolios |

**Installation:** None — every package used in this phase is already present in `backend/uv.lock` and `frontend/package.json`.

## Package Legitimacy Audit

**Not applicable this phase.** No new external packages are introduced on either the backend or frontend. All libraries used (`fastapi`, `pydantic`, `recharts`, Python stdlib `sqlite3`/`asyncio`/`uuid`/`datetime`) are already installed, already verified in prior phases, and confirmed present again above via `uv.lock` / `package.json` inspection this session.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────┐
                         │           Browser (Next.js SPA)           │
                         │                                           │
  EventSource ───────────▶  usePriceStreamContext (existing, shared) │
  GET /api/portfolio ─┐  │        │                                  │
  GET /api/.../history│  │        ▼                                  │
  (usePortfolio,      │  │  ┌───────────────┐   click-to-select      │
   usePortfolioHistory│  │  │ PositionsTable│◀──────────┐            │
   — already exist)   │  │  │   Heatmap     │───────────┤            │
                       │  │  │   PnLChart    │           ▼           │
                       │  │  └───────────────┘   setSelectedTicker   │
                       │  │        ▲                (shared w/       │
                       │  │        │ deriveLivePosition() (existing) │
                       │  │  ┌───────────────┐        Watchlist)     │
  POST /api/portfolio/ │  │  │   TradeBar    │                       │
  trade ───────────────┼──┼─▶│ (dropdown +   │                       │
                       │  │  │  qty + buy/   │                       │
                       │  │  │  sell)        │                       │
                       │  │  └───────────────┘                       │
                         └─────────────────────────────────────────┘
                                        │
                                        ▼ (same-origin /api/*)
┌───────────────────────────────────────────────────────────────────┐
│                        FastAPI (backend/app)                        │
│                                                                       │
│  api/portfolio.py                                                    │
│   ├── GET  /api/portfolio          → build_portfolio(price_cache)   │
│   ├── POST /api/portfolio/trade    → execute_trade(...)             │
│   └── GET  /api/portfolio/history  → get_snapshots()                │
│              │                              │                       │
│              ▼                              ▼                       │
│      PriceCache.get_price(ticker)   db/repository.py (new fns)      │
│      (existing, market/cache.py)    ├── get_positions()             │
│                                      ├── upsert_position()           │
│                                      ├── insert_trade()              │
│                                      ├── get_cash_balance() / set…   │
│                                      └── record_snapshot() /         │
│                                          get_snapshots()             │
│                                              │                       │
│  main.py lifespan                           ▼                       │
│   ├── source.start()  (existing)     SQLite (db/finally.db)         │
│   └── snapshot_task = asyncio.create_task(   │positions│trades│      │
│         snapshot_loop(interval=30s))         │portfolio_snapshots│   │
│       (new — same shutdown pattern as source.stop())                │
└───────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
backend/app/
├── api/
│   ├── watchlist.py         # existing, unmodified
│   └── portfolio.py         # NEW — GET/POST portfolio+trade+history routes
├── db/
│   ├── repository.py        # EXTEND — add positions/trades/snapshot functions
│   └── schema.py            # unmodified — tables already exist (Phase 2)
├── market/
│   └── cache.py             # unmodified — PriceCache.get_price() read-only consumer
└── main.py                  # EXTEND — mount portfolio router, start snapshot task

frontend/
├── components/
│   ├── TradeBar.tsx          # NEW
│   ├── PositionsTable.tsx    # NEW
│   ├── Heatmap.tsx            # NEW
│   └── PnLChart.tsx           # NEW
├── lib/
│   ├── hooks.ts               # EXTEND — add useLiveTotalValue (name already referenced
│   │                             in hooks.ts's own usePortfolio docstring, not yet defined)
│   ├── types.ts / api.ts / positionMath.ts   # already complete — DO NOT modify shapes
│   └── usePriceFlash.ts       # reuse as-is for trade-fill inline confirmation fade
```

### Pattern 1: Repository/Route Mirroring (established convention)
**What:** Every new backend capability is a plain sync repository function (own connection, `with conn:` for writes, `ValueError` for caller-level conditions) plus a router-factory function taking `price_cache: PriceCache` and returning a fresh `APIRouter`, wrapped at every call site in `await asyncio.to_thread(...)`.
**When to use:** All three new portfolio endpoints.
**Example (backend, following `watchlist.py`'s exact shape):**
```python
# Source: backend/app/api/watchlist.py (existing, verified this session)
def create_portfolio_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["portfolio"])

    @router.get("/portfolio")
    async def get_portfolio_route() -> dict:
        return await asyncio.to_thread(build_portfolio, price_cache)

    @router.post("/portfolio/trade")
    async def post_trade_route(body: TradeRequest) -> JSONResponse:
        try:
            result = await asyncio.to_thread(execute_trade, price_cache, body.ticker, body.side, body.quantity)
        except ValueError as exc:
            return JSONResponse(status_code=400, content={"success": False, "error": str(exc)})
        return JSONResponse(status_code=200, content=result)

    @router.get("/portfolio/history")
    async def get_history_route() -> dict:
        return await asyncio.to_thread(lambda: {"snapshots": get_snapshots()})

    return router
```

### Pattern 2: Trade Execution as a Single SQLite Transaction
**What:** Read the current `users_profile.cash_balance` and (if selling) the current `positions` row, validate, then perform all writes (`users_profile` update, `positions` upsert/delete, `trades` insert, `portfolio_snapshots` insert) inside one `with conn:` block so a crash mid-trade cannot leave cash debited without a position, or vice versa.
**When to use:** `execute_trade()` — the single most safety-critical function in this phase.
**Example:**
```python
# Pattern: mirrors add_watchlist_ticker's own connection lifecycle
# (backend/app/db/repository.py:39-63, verified this session) — one
# connection per call, `with conn:` wraps every write for atomic commit.
def execute_trade(price_cache: PriceCache, ticker: str, side: str, quantity: float) -> dict:
    price = price_cache.get_price(ticker)
    if price is None:
        raise ValueError(f"No live price available for {ticker}.")
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    conn = get_connection()
    try:
        with conn:
            profile = conn.execute(
                "SELECT cash_balance FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
            ).fetchone()
            position = conn.execute(
                "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
                (DEFAULT_USER_ID, ticker),
            ).fetchone()

            if side == "buy":
                cost = round(price * quantity, 2)
                if cost > profile["cash_balance"]:
                    raise ValueError(f"Insufficient cash for this trade.")
                new_qty = (position["quantity"] if position else 0.0) + quantity
                # Weighted-average cost recompute — only on buys.
                old_basis = (position["quantity"] * position["avg_cost"]) if position else 0.0
                new_avg_cost = round((old_basis + cost) / new_qty, 4)
                new_cash = round(profile["cash_balance"] - cost, 2)
            else:  # sell
                held = position["quantity"] if position else 0.0
                if quantity > held + 1e-9:  # epsilon guards float dust
                    raise ValueError("You don't own enough shares to sell that many.")
                proceeds = round(price * quantity, 2)
                new_qty = held - quantity
                new_avg_cost = position["avg_cost"] if position else 0.0  # unchanged on sell
                new_cash = round(profile["cash_balance"] + proceeds, 2)

            conn.execute(
                "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
                (new_cash, DEFAULT_USER_ID),
            )
            if new_qty <= 1e-9:
                conn.execute(
                    "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
                    (DEFAULT_USER_ID, ticker),
                )
            else:
                conn.execute(
                    "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
                    "VALUES (?, ?, ?, ?, ?, ?) "
                    "ON CONFLICT (user_id, ticker) DO UPDATE SET "
                    "quantity = excluded.quantity, avg_cost = excluded.avg_cost, "
                    "updated_at = excluded.updated_at",
                    (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, new_qty, new_avg_cost, now),
                )
            trade_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (trade_id, DEFAULT_USER_ID, ticker, side, quantity, price, now),
            )
            # Post-trade snapshot, same transaction — see D-06 scope note.
            total_value = new_cash + _sum_position_values(conn, price_cache)
            conn.execute(
                "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
                "VALUES (?, ?, ?, ?)",
                (str(uuid.uuid4()), DEFAULT_USER_ID, total_value, now),
            )
    finally:
        conn.close()
    return {"success": True, "trade": {...}, "portfolio": build_portfolio(price_cache)}
```
Note: `positions (user_id, ticker)` already has a `UNIQUE` constraint per `schema.py:45` — `ON CONFLICT (user_id, ticker) DO UPDATE` is valid SQLite upsert syntax against that constraint.

### Pattern 3: Snapshot Background Task (mirrors market source lifecycle)
**What:** An `asyncio` task started in `lifespan` alongside `source.start(tickers)`, looping `await asyncio.sleep(30)` then writing a snapshot, cancelled on shutdown the same way `source.stop()` is awaited.
**When to use:** The periodic half of PORT-06 (the post-trade half lives inside `execute_trade` per Pattern 2).
**Example:**
```python
# Source: pattern mirrors backend/app/main.py's existing lifespan shape
# (source.start()/source.stop(), verified this session) — not a literal
# quote, a structural analogy for the new snapshot task.
async def snapshot_loop(price_cache: PriceCache, interval: float = 30.0) -> None:
    while True:
        try:
            await asyncio.sleep(interval)
            await asyncio.to_thread(record_snapshot, price_cache)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Snapshot task failed; will retry next interval")

# inside lifespan(), after `await source.start(tickers)`:
snapshot_task = asyncio.create_task(snapshot_loop(price_cache))
...
yield
...
snapshot_task.cancel()
with contextlib.suppress(asyncio.CancelledError):
    await snapshot_task
await source.stop()
```

### Anti-Patterns to Avoid
- **Recomputing `avg_cost` on a sell:** average cost only changes on buys (weighted-average method). Recomputing it against the sell price silently corrupts every subsequent P&L calculation for that position.
- **Comparing floats to zero with `==`:** `positions.quantity` is `REAL`; a "sell everything" trade can leave `1e-16` of float dust. Use an epsilon comparison (`<= 1e-9`) to decide row deletion, matching the pattern already shown above.
- **Two separate connections for validate-then-write:** reading `cash_balance` in one `get_connection()` call and writing the debit in another creates a race window between two browser tabs (or a retried request) placing trades concurrently. Do both inside one `with conn:` block on one connection, as SQLite serializes writers on a single connection's transaction.
- **A second, competing `market_source.remove_ticker()` guard:** `.planning/codebase/CONCERNS.md`'s "Forward-Looking Notes" section (written during Phase 2 research) recommends blocking `market_source.remove_ticker()` when a position is open, so the ticker stays priceable and sellable after removal. **This phase's CONTEXT.md (D-04) explicitly overrides that recommendation** — the user chose the simpler unrestricted-removal + avg_cost-fallback path instead. Do not silently reintroduce the CONCERNS.md guard; it would leave `PriceCache` still tracking a ticker no longer on the watchlist, which contradicts D-03's fallback design and adds untested complexity. See Open Questions for the resulting (accepted) limitation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Treemap layout algorithm (squarified rectangles sized by value) | A custom `<div>` grid computing rectangle sizes from `quantity × price` weights | `recharts`'s `Treemap` component (`dataKey`, `data`, `content` render-prop) | `Treemap` already implements the squarified algorithm and is already an installed, tested dependency — D-09 |
| Weighted-average cost-basis math | A bespoke lot-tracking system (FIFO queues, per-lot cost) | Simple weighted-average recompute on buy (`(old_qty*old_avg + new_cost) / new_qty`), unchanged on sell | The schema (`positions.avg_cost REAL`, one row per ticker) has no lot table — weighted-average is the only method it supports, and matches every comparable paper-trading app |
| Server-Sent live total value | A second EventSource or polling loop dedicated to portfolio value | Client-side `deriveLivePosition()` (already exists in `positionMath.ts`) fed by the *existing* shared `usePriceStreamContext()` ticks | PLAN.md's own architecture note: "one EventSource for the whole app" — a second stream connection for portfolio value would duplicate the exact same price ticks already flowing to the watchlist |
| Trade atomicity / concurrent-write protection | A custom in-process lock (`threading.Lock`) around `execute_trade` | SQLite's own writer serialization inside a single connection's `with conn:` block | SQLite already serializes writers to one file; a redundant app-level lock adds complexity with no additional guarantee for a single-process app |

**Key insight:** Every "hard" piece of this phase (treemap layout, atomic multi-table writes, live-price recompute) already has a load-bearing, tested solution somewhere in this repo or its existing dependencies. The phase's actual risk surface is money-math correctness (avg-cost recompute direction, epsilon close-out, cash validation ordering) — not infrastructure.

## Common Pitfalls

### Pitfall 1: Average Cost Recomputed on Sell
**What goes wrong:** A sell trade recalculates `avg_cost` using the sale price instead of leaving it untouched, corrupting the position's cost basis for all future P&L math.
**Why it happens:** Copy-pasting the buy-path's weighted-average formula into the sell path without noticing it only applies to buys.
**How to avoid:** `avg_cost` is set exactly once per buy-recompute; the sell path only ever changes `quantity` and (at zero) deletes the row.
**Warning signs:** A test that buys, sells partially, then checks `avg_cost` unchanged from before the sell.

### Pitfall 2: Float-Dust Positions Never Close
**What goes wrong:** Selling "all" shares of a fractional position leaves `quantity = 3.5000000000000004` instead of exactly `0`, so the position never disappears from the table/heatmap and the empty-state never renders.
**Why it happens:** IEEE-754 float subtraction (`3.5 - 3.5` is exact, but `1.1 - 0.3 - 0.8` isn't always).
**How to avoid:** Treat `quantity <= 1e-9` as "closed" and `DELETE` the row rather than storing a near-zero value; use the same epsilon when validating "sell more than you own" (`quantity > held + 1e-9`).
**Warning signs:** A positions-table row showing a quantity like `0.0000000000003`.

### Pitfall 3: Trade Validation Reads Stale Cash/Position State
**What goes wrong:** Reading `cash_balance` and `positions` in one connection/query, then writing the updated values in a separate later connection, opens a window where two trades (e.g. two browser tabs) can both read the same starting cash and both "succeed," together spending more than the user has.
**Why it happens:** Following a naive "GET then POST" mental model instead of treating the whole validate-then-write sequence as one transaction.
**How to avoid:** Perform the SELECT and all subsequent writes inside the same `with conn:` block on the same connection (Pattern 2 above) — SQLite's own connection-level locking then makes the sequence atomic against a second concurrent `execute_trade` call.
**Warning signs:** A test that fires two overlapping trades near the cash limit and checks only one succeeds — worth adding even though this is a single-user demo app, because the trade bar's disabled-during-submit state (D-06/D-07 UI-SPEC) is a client-side mitigation only, not a server-side guarantee.

### Pitfall 4: Held Position on a Delisted Ticker Becomes Permanently Unsellable
**What goes wrong:** D-01 requires the trade endpoint to reject any ticker not currently on the watchlist. D-03/D-04 together mean a user can remove a watchlisted ticker while still holding a position in it — that position's `current_price` freezes at `avg_cost` (flat $0 P&L per D-03), **and** because the ticker is no longer on the watchlist, `POST /api/portfolio/trade` will reject any attempt to sell it (D-01's watchlist-membership gate has no exception for "you still hold this"). The user ends up holding a position they cannot close through the UI.
**Why it happens:** D-01 and D-03/D-04 were each individually reasonable, simplest-consistent-implementation choices, but their combination produces this edge case. This is a **known, accepted consequence of the locked decisions**, not a bug to silently work around.
**How to avoid:** Do not add an undiscussed workaround (e.g., an exception to D-01 for held tickers, or the CONCERNS.md remove-ticker guard) without flagging it to the user first — that would silently expand scope beyond what was decided in `03-CONTEXT.md`. If this matters for the demo, surface it as an explicit question during planning rather than resolving it unilaterally (see Open Questions).
**Warning signs:** A UAT script that removes a held ticker from the watchlist, then tries to sell the frozen position and expects it to succeed.

### Pitfall 5: Portfolio Total Value Diverges Between REST Snapshot and Live SSE Recompute
**What goes wrong:** `GET /api/portfolio`'s `total_value` (computed server-side, from whatever `PriceCache` price was live at request time) can visibly disagree with the header's client-side live total (recomputed continuously from SSE ticks via `deriveLivePosition`) if the two use different fallback rules for "no live price" (D-03's avg_cost fallback must be implemented identically server-side and mirrored by `positionMath.ts`'s existing `livePrice === undefined` branch).
**Why it happens:** Two independent code paths compute the "same" number from different data sources (one REST snapshot, one live stream) and can drift if their null-handling rules diverge even slightly.
**How to avoid:** `GET /api/portfolio`'s per-position `current_price` must apply the avg_cost fallback (D-03) *before* serializing — never a `null`/`0` — so that when the frontend has no live tick either, `deriveLivePosition`'s existing `livePrice === undefined` branch (which just echoes `position.current_price`) reproduces the exact same fallback value, not a second, independently-derived one.
**Warning signs:** The header total_value briefly flashing a different number than the positions table's sum immediately after page load, before the first SSE tick arrives.

### Pitfall 6: Snapshot Task Double-Writes Immediately After a Trade
**What goes wrong:** Not a bug per se, but worth planning around: the 30-second periodic snapshot task and the post-trade snapshot write are two independent triggers (both required per the phase's scope notes) — a trade executed 1 second before the periodic tick produces two closely-spaced snapshot rows.
**Why it happens:** By design (D-12's "show all snapshots, no selector" means every row is plotted, including near-duplicates).
**How to avoid:** Nothing to fix — this is intended behavior per the scope notes ("both the periodic and the post-trade path are required for PORT-06 to look right"). Do not add de-duplication logic that isn't in the locked decisions.
**Warning signs:** None — flagging only so the planner doesn't "fix" this as a perceived bug.

## Code Examples

### Frontend: `useLiveTotalValue` (name reserved by existing `hooks.ts` comment, not yet implemented)
```typescript
// Source: pattern mirrors frontend/lib/positionMath.ts's deriveLivePosition
// (verified this session, lines 1-31) and frontend/lib/hooks.ts's own
// usePortfolio docstring, which already references this hook by name
// (hooks.ts:11) without defining it — this closes that gap.
import { deriveLivePosition } from "./positionMath";
import type { Portfolio, PriceStreamEvent } from "./types";

export function useLiveTotalValue(portfolio: Portfolio | null, ticks: PriceStreamEvent): number | null {
  if (!portfolio) return null;
  let total = portfolio.cash_balance;
  for (const position of portfolio.positions) {
    const livePrice = ticks[position.ticker]?.price;
    total += deriveLivePosition(position, livePrice).marketValue;
  }
  return total;
}
```

### Frontend: Heatmap tile coloring by P&L (recharts `Treemap`)
```typescript
// Source: https://github.com/recharts/recharts/blob/main/www/src/docs/exampleComponents/TreeMap/CustomContentTreemap.tsx
// (Context7 /recharts/recharts, fetched this session) — content prop shape
// verified; fill-by-value substitution is this project's own application
// of the documented pattern, not a literal upstream example.
import { Treemap } from "recharts";

interface TreemapNode {
  x: number; y: number; width: number; height: number; name: string;
  pnlPercent: number;
}

function HeatmapTile({ x, y, width, height, name, pnlPercent }: TreemapNode) {
  const fill = pnlPercent > 0 ? "var(--color-up)" : pnlPercent < 0 ? "var(--color-down)" : "#8b949e";
  return (
    <g onClick={() => onSelectTicker(name)} style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: "#0d1117", strokeWidth: 2 }} />
      {width > 40 && height > 20 && (
        <text x={x + 6} y={y + 16} fill="#0d1117" fontSize={12} fontWeight={600}>{name}</text>
      )}
    </g>
  );
}

// <Treemap data={positions.map(p => ({ name: p.ticker, size: marketValue(p), pnlPercent: ... }))}
//          dataKey="size" content={HeatmapTile} />
```

### Backend: TradeRequest validation model (mirrors `WatchlistAddRequest`)
```python
# Source: backend/app/api/watchlist.py:23-26 (WatchlistAddRequest, verified
# this session) — identical BaseModel convention, extended for the trade
# body's two extra fields.
from typing import Literal
from pydantic import BaseModel

class TradeRequest(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float
```

### Backend: `build_portfolio` applying the D-03 avg_cost fallback
```python
# Source: pattern mirrors backend/app/api/watchlist.py's build_watchlist()
# (verified this session, lines 29-65) — same "join persisted rows with
# PriceCache, fall back honestly when the cache has no entry" shape, but
# the fallback value is avg_cost (D-03) rather than null (watchlist has no
# equivalent "must always show a number" requirement).
def build_portfolio(price_cache: PriceCache) -> dict:
    cash_balance = get_cash_balance()
    positions = []
    total_unrealized_pnl = 0.0
    total_value = cash_balance
    for row in get_positions():
        live_price = price_cache.get_price(row["ticker"])
        current_price = live_price if live_price is not None else row["avg_cost"]
        market_value = round(row["quantity"] * current_price, 2)
        unrealized_pnl = round((current_price - row["avg_cost"]) * row["quantity"], 2)
        unrealized_pnl_percent = (
            round((current_price / row["avg_cost"] - 1) * 100, 4) if row["avg_cost"] > 0 else 0.0
        )
        positions.append({
            "ticker": row["ticker"], "quantity": row["quantity"], "avg_cost": row["avg_cost"],
            "current_price": current_price, "market_value": market_value,
            "unrealized_pnl": unrealized_pnl, "unrealized_pnl_percent": unrealized_pnl_percent,
        })
        total_value += market_value
        total_unrealized_pnl += unrealized_pnl
    return {
        "cash_balance": cash_balance, "positions": positions,
        "total_value": round(total_value, 2), "total_unrealized_pnl": round(total_unrealized_pnl, 2),
    }
```
Field names verified against `frontend/lib/types.ts:21-36` (`Position`, `Portfolio` interfaces) this session — this shape is the binding contract per CONTEXT.md's "Claude's Discretion" resolution.

## State of the Art

Not applicable — this is a greenfield feature within an already-current stack (`fastapi` 0.128.7, `pydantic` 2.12.5, `recharts` 3.10.1 are all current releases verified this session, not stale training-data versions). No deprecated APIs are involved.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `positions (user_id, ticker) UNIQUE` constraint supports SQLite's `ON CONFLICT (user_id, ticker) DO UPDATE` upsert syntax as shown in Pattern 2 | Architecture Patterns / Code Examples | Low — this is standard SQLite (3.24+) upsert syntax over a declared UNIQUE constraint; if the installed SQLite version somehow predates 3.24, the planner should fall back to a SELECT-then-INSERT/UPDATE branch, which the repository already does for watchlist duplicates (`repository.py`'s `IntegrityError` catch pattern) |
| A2 | 30-second snapshot cadence is best implemented as `asyncio.sleep(30)` in a loop rather than an external scheduler | Architecture Patterns: Snapshot Writer | Low — this mirrors the exact idiom already used by `SimulatorDataSource`'s update loop (per `backend/CLAUDE.md`'s ~500ms cadence description); no scheduling library exists in this stack to reconsider |
| A3 | The frontend should add `useLiveTotalValue` to `hooks.ts` (rather than inlining the computation in `Header.tsx` or `page.tsx`) | Code Examples | Low — `hooks.ts`'s own comment (line 11) already names this hook, implying the Phase 1 author intended it to live there; placing it elsewhere would just be a style deviation, not a functional risk |

**If this table is empty:** N/A — see above; all three assumptions are low-risk stylistic/implementation-detail calls, not compliance-, security-, or requirement-shaping assumptions. No user confirmation is required before planning proceeds.

## Open Questions

1. **Should a held position on a since-delisted ticker be sellable at all?**
   - What we know: D-01 (trade requires watchlist membership) and D-03/D-04 (unrestricted removal + avg_cost fallback for display) are both explicit, locked/discretionary decisions from `03-CONTEXT.md`. Combined, they produce a position that displays correctly (flat P&L) but cannot be closed through the trade bar (see Pitfall 4).
   - What's unclear: Whether this is an acceptable, intentional limitation for a single-session demo app (most likely — no test scenario in `03-CONTEXT.md`/UI-SPEC covers "sell a delisted holding"), or whether the planner should surface it back to the user as a follow-up question before implementation.
   - Recommendation: Implement exactly as decided (D-01 + D-04's simplest path) and do not add an undiscussed escape hatch. If desired, the planner can add a one-line UAT note ("known limitation: a position on a removed ticker cannot be sold until the ticker is re-added to the watchlist") rather than silently expanding scope.

2. **Does `POST /api/portfolio/trade`'s `TradeErrorResponse` shape (`{success: false, error: string}`) need a `portfolio` field on the error path too?**
   - What we know: `frontend/lib/types.ts:61-64` defines `TradeErrorResponse` as exactly `{success: false, error: string}` — no `portfolio` field on failure, unlike the success variant which includes a full refreshed `Portfolio`.
   - What's unclear: Nothing — this is settled by the existing, binding frontend type. Listed here only so the planner doesn't second-guess adding a `portfolio` field to the 400 response by analogy with the 200 response; the frontend contract explicitly does not expect one.
   - Recommendation: Match `TradeErrorResponse` exactly — omit `portfolio` from the 400 body.

3. **Should `planning/API_CONTRACT.md` be authored this phase** (per the dangling reference in `frontend/lib/types.ts`'s header comment)?
   - What we know: CONTEXT.md's "Claude's Discretion" section explicitly lists this as unresolved and not directly discussed with the user.
   - What's unclear: Whether the planner should schedule a task for it or leave the dangling reference as-is.
   - Recommendation: Low priority relative to the six PORT requirements; if time permits, a short `planning/API_CONTRACT.md` documenting the shapes already in `types.ts` (which this research treats as the binding source of truth) would close the gap cheaply — but this is not required for any PORT-0x success criterion.

## Environment Availability

Not applicable — this phase introduces no new external tools, services, or runtimes. Python 3.14.7, `uv`, SQLite (stdlib), Node/npm, and all required packages were already verified present and working by Phases 1–2 (existing test suites pass against this exact environment; `backend/uv.lock` and `frontend/package.json` were inspected fresh this session and show no drift).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 8.3.0+ (installed: verify via `uv run pytest --version`), `pytest-asyncio` (auto mode), `httpx` for streaming tests |
| Backend config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` (existing) |
| Frontend framework | Vitest 5.0.1, `@testing-library/react` 16.3.3, jsdom environment — `frontend/vitest.config.ts` (existing) |
| Quick run command (backend) | `cd backend && uv run --extra dev pytest -q -k portfolio` |
| Quick run command (frontend) | `cd frontend && npm test -- TradeBar` (or `PositionsTable`/`Heatmap`/`PnLChart`) |
| Full suite command | `cd backend && uv run --extra dev pytest -q` and `cd frontend && npm test` (matches `.planning/config.json`'s `test_command`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-01 | Fresh DB shows $10,000 cash; total value moves with live prices | integration (backend) + unit (frontend) | `pytest tests/api/test_portfolio.py -k test_get_portfolio_fresh_db -x` / `npm test -- Header` | ❌ Wave 0 |
| PORT-02 | Buy fills instantly at current price, cash drops exactly, position appears | integration (backend) | `pytest tests/api/test_portfolio.py -k TestBuyTrade -x` | ❌ Wave 0 |
| PORT-03 | Sell fills; over-sell/over-buy refused with no state change | integration (backend) | `pytest tests/api/test_portfolio.py -k TestSellTrade -x` | ❌ Wave 0 |
| PORT-04 | Positions table shows all six fields, live-updating | unit (frontend) | `npm test -- PositionsTable` | ❌ Wave 0 |
| PORT-05 | Heatmap sizes by weight, colors green/red | unit (frontend) | `npm test -- Heatmap` | ❌ Wave 0 |
| PORT-06 | P&L chart gains points on 30s tick and post-trade | integration (backend) + unit (frontend) | `pytest tests/db/test_repository.py -k TestRecordSnapshot -x` / `npm test -- PnLChart` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command scoped to the file(s) touched.
- **Per wave merge:** full suite (`pytest -q` + `npm test`).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/api/test_portfolio.py` — covers PORT-01, PORT-02, PORT-03, PORT-06 (route-level); follow `backend/tests/api/test_watchlist.py`'s `client`/`fake_market_source` fixture pattern (`backend/tests/api/conftest.py`, already exists, no changes needed — `client.app.state.price_cache.update(...)` is already the established way to seed a fill price in tests, per `test_watchlist.py:46`).
- [ ] `backend/tests/db/test_repository.py` extensions — covers `execute_trade`, `get_positions`, `record_snapshot`, `get_snapshots` at the repository level, following `TestAddWatchlistTicker`'s shape (`initialized_db` fixture, direct function calls, no HTTP layer).
- [ ] `frontend/__tests__/TradeBar.test.tsx`, `PositionsTable.test.tsx`, `Heatmap.test.tsx`, `PnLChart.test.tsx` — new files, following `Watchlist.test.tsx`'s render + `@testing-library/user-event` conventions.
- [ ] `frontend/__tests__/positionMath.test.ts` — `deriveLivePosition` already exists in source but has no dedicated test file found in `frontend/__tests__/`; add coverage for the D-03 fallback branch (`livePrice === undefined`) since it is now load-bearing for PORT-04/05 correctness, not just a nice-to-have.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Single hardcoded `user_id="default"`, no auth surface in this app (PLAN.md §7) |
| V3 Session Management | No | No sessions — stateless REST + SSE |
| V4 Access Control | No | No multi-tenant boundary to enforce within a single-user app |
| V5 Input Validation | Yes | `pydantic` `Literal["buy", "sell"]` for `side`; `quantity: float` with an explicit `> 0` server-side check inside `execute_trade` (pydantic alone won't reject `0` or negative floats — that check must be in the repository function, not just relying on schema typing) |
| V6 Cryptography | No | No secrets, tokens, or crypto operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Negative or zero `quantity` submitted to bypass cash/share checks (e.g. a "buy -100 shares" request that would *increase* cash if not validated) | Tampering | Explicit `if quantity <= 0: raise ValueError(...)` in `execute_trade`, checked before any arithmetic — pydantic's `float` type alone permits negative and zero values |
| Ticker not on watchlist submitted directly to `POST /api/portfolio/trade` (bypassing the UI's dropdown, D-02) | Tampering | Server-side watchlist-membership check (D-01) inside `execute_trade`/the route — the dropdown is a UX affordance, not the enforcement boundary; `PriceCache.get_price(ticker) is None` alone is an insufficient proxy since a ticker could theoretically be in `PriceCache` without being on the current watchlist (e.g. mid-removal race) |
| Concurrent trades racing the cash/position read-then-write sequence | Tampering / Repudiation | Single-transaction execution (Pattern 2/Pitfall 3) — SQLite serializes writers on one connection |
| SQL injection via `ticker` string in dynamic queries | Tampering | Continue the existing project-wide convention: `?` placeholders everywhere, never string interpolation (already enforced by `repository.py`'s own module docstring and followed in every existing query) |
| Float-precision drift making a trade appear to succeed with wrong cash amount | Tampering (data integrity) | Round money to 2 decimals at every write (`round(x, 2)`), matching `PriceCache.update()`'s existing 2-decimal price rounding convention |

## Sources

### Primary (HIGH confidence)
- `backend/app/db/schema.py`, `backend/app/db/repository.py`, `backend/app/db/connection.py`, `backend/app/db/init.py` — read in full this session; schema DDL and repository conventions quoted verbatim above.
- `backend/app/api/watchlist.py`, `backend/app/main.py` — read in full this session; route/lifespan patterns mirrored exactly.
- `backend/app/market/cache.py`, `backend/app/market/models.py`, `backend/app/market/ticker.py`, `backend/app/market/__init__.py` — read in full this session; `PriceCache` API and `PriceUpdate` fields confirmed.
- `frontend/lib/types.ts`, `frontend/lib/api.ts`, `frontend/lib/positionMath.ts`, `frontend/lib/hooks.ts` — read in full this session; binding contract shapes quoted verbatim above.
- `frontend/components/Header.tsx`, `Watchlist.tsx`, `WatchlistRow.tsx`, `MainChart.tsx`, `frontend/lib/usePriceFlash.ts`, `usePriceStream.ts`, `PriceStreamContext.tsx`, `frontend/lib/format.ts` — read in full this session; UI conventions (panel chrome, color tokens, flash pattern, formatting helpers) confirmed.
- `backend/uv.lock` (`fastapi==0.128.7`, `pydantic==2.12.5`) and `frontend/node_modules/recharts/package.json` (`3.10.1`) — verified installed versions this session via direct file/command inspection.
- `.planning/codebase/CONCERNS.md` — read in full this session; the D-04-vs-CONCERNS.md tension documented above is a direct comparison of this file against `03-CONTEXT.md`.
- `backend/tests/api/test_watchlist.py`, `backend/tests/api/conftest.py`, `backend/tests/db/test_repository.py`, `backend/tests/test_main.py` — read in full this session; test conventions (fixtures, assertion style) mirrored in the Validation Architecture section.

### Secondary (MEDIUM confidence)
- Context7 `/recharts/recharts` — `Treemap` `content` prop custom-render example (`CustomContentTreemap.tsx`), fetched this session. [CITED: github.com/recharts/recharts/blob/main/www/src/docs/exampleComponents/TreeMap/CustomContentTreemap.tsx]

### Tertiary (LOW confidence)
None used — every non-codebase claim in this document is either CITED (Context7) or explicitly marked ASSUMED in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every version verified against `uv.lock`/`package.json` this session.
- Architecture: HIGH — every pattern is a direct structural mirror of already-shipped, already-tested code in this exact repo (watchlist repository/route pair, market-source lifespan lifecycle).
- Pitfalls: HIGH — derived from reading the actual schema (float `REAL` columns), the actual `PriceCache` fallback semantics, and the actual `03-CONTEXT.md` decisions, not generic trading-app folklore.

**Research date:** 2026-09-20
**Valid until:** No external expiry — this research is scoped entirely to this repository's own already-committed code and locked decisions, which do not go stale on a calendar basis. Re-research only if `03-CONTEXT.md` is amended or the frontend contract files change shape.

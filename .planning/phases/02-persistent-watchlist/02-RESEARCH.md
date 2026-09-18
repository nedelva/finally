# Phase 2: Persistent Watchlist - Research

**Researched:** 2026-09-18
**Domain:** SQLite persistence layer (stdlib `sqlite3`) + FastAPI CRUD routes + swapping a React app's ticker source-of-truth from a derived SSE union to a fetched REST resource
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WTCH-01 | User can add a ticker to the watchlist manually | Standard Stack, Architecture Patterns (Patterns 2-5), Code Examples (validation/normalization + `POST /api/watchlist` handler), Common Pitfalls 1-4 |
| WTCH-02 | User can remove a ticker from the watchlist manually | Architecture Patterns (Pattern 4, system diagram's remove path), Common Pitfalls 1, 4, 5, Code Examples (`build_watchlist`/removal flow) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Both `/CLAUDE.md` and `/.claude/CLAUDE.md` exist and apply to all new code this phase writes. Directives relevant to this phase's DB/API/market work:

- **Python version:** `requires-python = ">=3.12"` (`[VERIFIED: backend/pyproject.toml:7]`) — no syntax beyond 3.12.
- **Ruff:** `line-length = 100`, rules `E, F, I, N, W`, `E501` (line-too-long) ignored (`[VERIFIED: backend/pyproject.toml, [tool.ruff]/[tool.ruff.lint]]`). Run `uv run --extra dev ruff check app/ tests/` before considering a task done.
- **Imports:** `from __future__ import annotations` as the first import in every new/modified `.py` file; stdlib, then third-party, then local, in that order.
- **Type hints:** every parameter and return type hinted; `X | None`, never `Optional[X]`; `list[str]`/`dict[str, float]` not `List`/`Dict`.
- **Naming:** lowercase-with-underscores for modules/functions/variables; `PascalCase` for classes; `UPPERCASE_WITH_UNDERSCORES` for constants; leading `_` for private functions/attributes.
- **Logging:** module-level `logger = logging.getLogger(__name__)`; `%`-style formatting in every log call, never f-strings; INFO for lifecycle events, DEBUG for per-iteration detail, WARNING for recoverable issues, ERROR for continuing-but-failed, `logger.exception()` inside `except` blocks.
- **Error handling:** catch specific exceptions where possible; return `None` for "not found," raise for actual bugs; background/async loops catch `Exception` broadly, log, and do not re-raise.
- **Async:** `async def` for anything that awaits; `await asyncio.sleep()` never `time.sleep()`; **`await asyncio.to_thread()` to run synchronous code without blocking the event loop** — directly applicable to every `app/db` call made from an `app/api` route handler this phase (see Pattern 3).
- **Module design:** `__all__` in every `__init__.py`; barrel re-exports (`from app.db import ...`, `from app.market import ...`) — callers never reach into submodules directly (`from app.market.cache import PriceCache` is explicitly called out as the anti-pattern to avoid).
- **Docstrings:** every public class/function documents purpose (and args/return if non-obvious); private methods get a one-line docstring if non-obvious.
- **Special patterns:** `@dataclass(frozen=True, slots=True)` for immutable value objects; abstract interfaces defined via `ABC` + `@abstractmethod` in their own `interface.py`; concrete instances created via factory functions, never direct construction from calling code.
- **Testing:** `uv run --extra dev pytest` (backend), test files named `test_*.py`, classes `Test*`, functions `test_*`.
- **GSD workflow enforcement** (`.claude/CLAUDE.md`): file-changing work must go through a GSD entry point (`/gsd-execute-phase` for this planned phase work) — not a direct-edit bypass.

## Summary

Phase 2 has three independent pieces of work, all small: (1) a stdlib-`sqlite3` persistence layer under `backend/app/db/` with lazy init and the full PLAN.md §7 schema, (2) three FastAPI routes (`GET/POST/DELETE /api/watchlist`) that read/write that layer and notify the already-started `MarketDataSource` via its existing `add_ticker`/`remove_ticker` methods, and (3) a frontend swap: `Watchlist.tsx` currently derives its ticker list from the SSE stream itself (`usePriceStreamContext().tickers`, a set that only ever grows — see Pitfall 1) and must instead be driven by the `GET /api/watchlist` response.

The frontend half is far more done than it looks: `frontend/lib/hooks.ts` already exports a fully-implemented `useWatchlist()` hook, and `frontend/lib/api.ts`/`frontend/lib/types.ts` already have `getWatchlist`/`addWatchlistTicker`/`removeWatchlistTicker` and the matching `WatchlistEntry`/`WatchlistResponse`/`AddWatchlistResponse` types — all written in Phase 1 in anticipation of this phase, never wired into a component. This phase is primarily backend build-out plus rewiring `Watchlist.tsx`/`WatchlistRow.tsx` to call what already exists.

This repository's git history also contains a complete, independent implementation of this same schema and these same routes, built by a different agent-team run against the same PLAN.md on a sibling branch (`my-agent-teams`, commit `c4c9d86`, **never merged into this branch — the files below do not exist in this branch's working tree**). It is **not** authoritative for this phase's decisions, and it is **not** `[VERIFIED]` — per this project's provenance rules, a discrete value only earns `[VERIFIED]` when its source-of-truth file was opened with `Read` in this branch's working tree this session, and `git show <other-commit>:<path>` does not satisfy that (the path does not exist here). Everything drawn from it below is tagged `[CITED: git c4c9d86:<path>]` — real, working, in-repo prior art demonstrating a design (that branch's own commit message claims "188 backend unit/integration tests... all passing"), but a citation, not a verification, and it has two known deviations from this project's own conventions that must NOT be copied: no ticker format validation at all, and synchronous `sqlite3` called directly from `async def` handlers with no `asyncio.to_thread` (see Pitfall 2).

**Primary recommendation:** Build `backend/app/db/{connection,schema,init,repository}.py` as plain synchronous stdlib `sqlite3` (one connection per call, `row_factory=sqlite3.Row`, WAL mode) re-exported through a barrel `backend/app/db/__init__.py`, with a schema that matches PLAN.md §7's column lists verbatim (Pattern 1); call every repository function from async route handlers via `await asyncio.to_thread(...)` (Pattern 3); create all six PLAN.md §7 tables now but only write repository functions for `users_profile`/`watchlist` this phase; centralize ticker normalization in one helper shared by `SimulatorDataSource` and `MassiveDataSource` (Pattern 5); extend `create_app()` with an injectable market-source override so tests can use a fake without waiting on real GBM/Massive timing (Pattern 6); and rewire `Watchlist.tsx` to source its ticker list from the existing `useWatchlist()` hook instead of the SSE-derived `tickers` array (Pattern 7).

## ⚠️ Repo Gap — `db/` Directory Does Not Exist and `.gitignore` Does Not Cover It

**This must be fixed as part of this phase's DB work, before the first `init_db()` run — it is the same class of pre-existing blocker Phase 1 hit with `frontend/lib/` (`.planning/phases/01-live-price-terminal/01-PATTERNS.md:7-22`, resolved that phase).**

- **`db/` does not exist yet.** `[VERIFIED: git ls-files db/` returns nothing this session, and `ls db/` finds no such directory]. PLAN.md §4 documents this directory as already present in the repo layout with a committed `db/.gitkeep` ("Directory exists in repo; finally.db is gitignored"), but neither the directory nor the `.gitkeep` exist in this branch.
- **`.gitignore` does not cover `db/finally.db` or its WAL/SHM sidecar files.** `[VERIFIED: .gitignore:61-62]` — the only SQLite-related rules present are the generic Django-template lines `db.sqlite3` and `db.sqlite3-journal`, verbatim:
  ```
  db.sqlite3
  db.sqlite3-journal
  ```
  Neither pattern matches a file at `db/finally.db` (different name, different directory) nor the `-wal`/`-shm` sidecar files WAL mode creates (Pattern 1 uses `PRAGMA journal_mode = WAL`).

**Required fix, as its own early task in this phase's plan:** create `db/.gitkeep`, and add `db/*.db`, `db/*.db-wal`, `db/*.db-shm`, `db/*.db-journal` to `.gitignore` — before `init_db()` ever runs against a real checkout, or `finally.db` will sit as an untracked binary in every `git status` from the first manual test run onward.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Watchlist persistence (schema, seed, CRUD storage) | Database/Storage | API/Backend | SQLite file is the source of truth; `app/db` is the only code that touches the file |
| Watchlist CRUD API (`GET/POST/DELETE /api/watchlist`) | API/Backend | Database/Storage | Route handlers validate/normalize input, call `app/db`, then notify the market data source |
| Ticker format validation + normalization | API/Backend | — | Must happen before any DB write or `MarketDataSource` call — a single gate, not duplicated per caller |
| New/removed ticker starts/stops streaming | API/Backend | Browser/Client | `add_ticker`/`remove_ticker` on the already-running `MarketDataSource` (server); the browser only reacts once the next `GET /api/watchlist` refetch and SSE frame arrive |
| Watchlist add/remove UI, empty/error states | Browser/Client | — | Static Next.js export with client-side `fetch` — there is no SSR tier in this app; `Watchlist.tsx`/new form component own this entirely |
| Lazy DB init on first request | Database/Storage | API/Backend | Schema/seed creation is a storage-layer concern; `app/main.py`'s lifespan is only the trigger point |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sqlite3` (stdlib) | Python 3.12+ builtin | SQLite driver | PLAN.md §3 explicitly chooses SQLite for "no auth = no multi-user = no need for a database server"; stdlib `sqlite3` needs zero new dependency and matches the single-user, low-concurrency access pattern exactly. [ASSUMED] — PLAN.md names SQLite but not a specific driver; stdlib is the zero-dependency default consistent with PLAN.md's own rationale, and is also what the sibling-branch prior art used `[CITED: git c4c9d86:backend/app/db/connection.py]`. |
| `fastapi` | 0.128.7 | REST routes | Already the project's framework — installed version confirmed [VERIFIED: `backend/uv.lock`, `name = "fastapi"` / `version = "0.128.7"`] |
| `pydantic` | 2.12.5 | Request body model (`WatchlistAddRequest`) | Ships transitively with the installed FastAPI; no new dependency needed [VERIFIED: `backend/uv.lock`, `name = "pydantic"` / `version = "2.12.5"`] |

No new third-party packages are required for this phase. `uuid`, `sqlite3`, `re`, and `datetime` are all stdlib.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No supporting libraries needed this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Synchronous stdlib `sqlite3` + `asyncio.to_thread` at call sites | `aiosqlite` | Adds a new dependency for a single-user app where every query is sub-millisecond; PLAN.md's own rationale ("self-contained, zero config") argues against adding an async driver. Not adopted. |
| One connection per call | A module-level shared `sqlite3.Connection` | A shared connection object is not safe to use concurrently across FastAPI's threadpool without an explicit lock (sqlite3 connections are not thread-safe by default); per-call connections sidestep this entirely at negligible cost for this app's scale. Matches the sibling-branch prior art's approach. Not adopted: sharing one connection. |

## Package Legitimacy Audit

Not applicable — no external packages are installed this phase. `sqlite3`, `uuid`, `re`, and `datetime` are Python stdlib; `fastapi`/`pydantic` are already installed dependencies (see Standard Stack table above, versions verified against `backend/uv.lock`).

## Architecture Patterns

### System Architecture Diagram

```
Browser (Next.js static export)
  │
  │ 1. GET /api/watchlist  (on mount, via useWatchlist() hook — already exists)
  ▼
FastAPI app.main:app
  │
  ├─► app.db.get_watchlist()  ──► SQLite (db/finally.db, WAL mode)
  │        (via asyncio.to_thread)      "watchlist" table, scoped to user_id="default"
  │
  ▼
JSON { watchlist: [{ticker, added_at, price, previous_price,
                      change, change_percent, direction}, ...] }
  │  (price fields joined in-process from app.state.price_cache,
  │   null + direction="flat" if the ticker has no cache entry yet)
  ▼
Browser renders WatchlistRow per entry
  │
  │ 2. User submits "PYPL" in the add-ticker form
  ▼
POST /api/watchlist  { "ticker": "PYPL" }
  │
  ▼
app.api.watchlist.post_watchlist(body, request)
  │
  ├─► normalize_ticker("PYPL") -> "PYPL"
  ├─► validate format (1-5 alphanumeric) ──✗ fail──► 400 {"error": "..."} (no DB write, no notify)
  │        │
  │        ✓ pass
  ▼
  ├─► app.db.add_watchlist_ticker("PYPL")  (asyncio.to_thread)
  │        ├─► duplicate? ──✗──► 409 {"error": "PYPL is already on your watchlist."}
  │        └─► INSERT INTO watchlist ...
  ▼
  ├─► request.app.state.market_source.add_ticker("PYPL")
  │        └─► SimulatorDataSource / MassiveDataSource starts tracking PYPL,
  │            seeds PriceCache immediately so the next SSE tick includes it
  ▼
  201 {"ticker": "PYPL", "added_at": "..."}
  │
  ▼
Browser: on success, call refetch() from useWatchlist() → re-render grid with new row
  │  (row shows "—" cells until the shared EventSource's next ~500ms frame
  │   carries a PYPL tick, per Phase 1's already-designed partial-fill state)

3. Remove path (DELETE /api/watchlist/{ticker}) mirrors this symmetrically:
   normalize → app.db.remove_watchlist_ticker() (404 if absent) →
   market_source.remove_ticker() → 204 → frontend refetch() drops the row
   → PriceCache.remove() means the next SSE frame simply omits that ticker.
```

### Recommended Project Structure

```
backend/app/
├── db/
│   ├── __init__.py       # barrel: re-exports init_db, get_watchlist, add_watchlist_ticker,
│   │                     #   remove_watchlist_ticker (only what Phase 2 needs — positions/
│   │                     #   trades/snapshots/chat repository fns land in Phases 3-4)
│   ├── connection.py     # get_db_path(), get_connection() — one connection per call
│   ├── schema.py         # DDL for all 6 PLAN.md §7 tables + indexes (created now, most unused
│   │                     #   until Phase 3/4 — see roadmap scope note)
│   ├── init.py           # init_db(): idempotent create-tables + seed-if-empty
│   └── repository.py     # get_cash_balance/get_watchlist/add_watchlist_ticker/
│                         #   remove_watchlist_ticker — only these four this phase
├── api/                  # NEW package — first REST route module beyond main.py's inline /api/health
│   ├── __init__.py       # barrel: re-exports watchlist_router (portfolio_router, chat_router
│   │                     #   join this barrel in Phases 3-4)
│   └── watchlist.py      # router, WatchlistAddRequest, build_watchlist(), add_to_watchlist(),
│                         #   remove_from_watchlist()
├── market/
│   ├── ticker.py         # NEW — normalize_ticker(raw: str) -> str, TICKER_FORMAT_RE;
│   │                     #   imported by simulator.py, massive_client.py, and app.api.watchlist
│   ├── simulator.py      # MODIFIED — normalize in start()/add_ticker()/remove_ticker()
│   └── massive_client.py # MODIFIED — replace inline .upper().strip() with the shared helper
└── main.py               # MODIFIED — call init_db() in lifespan; load initial tickers from
                           #   app.db.get_watchlist() instead of DEFAULT_TICKERS; mount the
                           #   watchlist router before the StaticFiles mount; add an injectable
                           #   market_source override to create_app() (Pattern 6)

backend/tests/
├── db/
│   ├── __init__.py
│   ├── conftest.py       # temp_db fixture (monkeypatch DB_PATH env var, call init_db())
│   ├── test_init.py      # schema creation, idempotency, seed data
│   └── test_repository.py
└── api/
    ├── __init__.py
    ├── conftest.py       # FakeMarketDataSource test double + app/client fixtures
    └── test_watchlist.py

frontend/
├── components/
│   ├── Watchlist.tsx      # MODIFIED — ticker list source becomes useWatchlist().watchlist,
│   │                      #   not usePriceStreamContext().tickers; renders add-form + empty state
│   └── WatchlistRow.tsx   # MODIFIED — 5th <td> remove button per UI-SPEC
```

### Pattern 1: Schema is PLAN.md §7, verbatim — the sibling-branch DDL is a style reference, not the source of truth

**What:** PLAN.md §7 is this project's own authoritative schema definition (`.claude/CLAUDE.md`: "The key document is PLAN.md"). Quoted verbatim below, exactly as it appears in the project spec:

> **users_profile** — User state (cash balance)
> - `id` TEXT PRIMARY KEY (default: `"default"`)
> - `cash_balance` REAL (default: `10000.0`)
> - `created_at` TEXT (ISO timestamp)
>
> **watchlist** — Tickers the user is watching
> - `id` TEXT PRIMARY KEY (UUID)
> - `user_id` TEXT (default: `"default"`)
> - `ticker` TEXT
> - `added_at` TEXT (ISO timestamp)
> - UNIQUE constraint on `(user_id, ticker)`
>
> **positions** — Current holdings (one row per ticker per user)
> - `id` TEXT PRIMARY KEY (UUID)
> - `user_id` TEXT (default: `"default"`)
> - `ticker` TEXT
> - `quantity` REAL (fractional shares supported)
> - `avg_cost` REAL
> - `updated_at` TEXT (ISO timestamp)
> - UNIQUE constraint on `(user_id, ticker)`
>
> **trades** — Trade history (append-only log)
> - `id` TEXT PRIMARY KEY (UUID)
> - `user_id` TEXT (default: `"default"`)
> - `ticker` TEXT
> - `side` TEXT (`"buy"` or `"sell"`)
> - `quantity` REAL (fractional shares supported)
> - `price` REAL
> - `executed_at` TEXT (ISO timestamp)
>
> **portfolio_snapshots** — Portfolio value over time (for P&L chart). Recorded every 30 seconds by a background task, and immediately after each trade execution.
> - `id` TEXT PRIMARY KEY (UUID)
> - `user_id` TEXT (default: `"default"`)
> - `total_value` REAL
> - `recorded_at` TEXT (ISO timestamp)
>
> **chat_messages** — Conversation history with LLM
> - `id` TEXT PRIMARY KEY (UUID)
> - `user_id` TEXT (default: `"default"`)
> - `role` TEXT (`"user"` or `"assistant"`)
> - `content` TEXT
> - `actions` TEXT (JSON — trades executed, watchlist changes made; null for user messages)
> - `created_at` TEXT (ISO timestamp)

And its preamble, also verbatim: *"All tables include a `user_id` column defaulting to `"default"`. This is hardcoded for now (single-user) but enables future multi-user support without schema migration."*

**The one genuine conflict to resolve explicitly, not invent an answer for:** the preamble says "all tables include a `user_id` column," but the `users_profile` spec directly above lists only `id`/`cash_balance`/`created_at` — no `user_id` column. **Resolution this research recommends: `users_profile.id` *is* the user key for that one table** (its own primary key already carries the `"default"` user identity — a `users_profile` row and a "user" are the same thing), and the preamble's "all tables" statement describes the other five tables, each of which carries a separate `user_id` foreign-key-shaped column pointing at a `users_profile.id`. This reading is also what the sibling-branch prior art independently converged on `[CITED: git c4c9d86:backend/app/db/schema.py]` — `CREATE_USERS_PROFILE` there has no `user_id` column, only `id`. **Flag this resolution explicitly in the plan** so the executor implements `id`-as-user-key deliberately rather than either adding a redundant `user_id` column to `users_profile` or silently reading past the preamble/table mismatch.

**Recommended DDL** — every column name and type above, reproduced exactly, plus indexes as an addition beyond what PLAN.md §7 specifies (§7 does not mention indexes; this is a reasonable practice addition, not a requirement — tag `[ASSUMED]`, not `[VERIFIED]` or `[CITED]`):

```python
# app/db/schema.py
from __future__ import annotations

CREATE_USERS_PROFILE = """
CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
)
"""

CREATE_WATCHLIST = """
CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE (user_id, ticker)
)
"""

CREATE_POSITIONS = """
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL,
    avg_cost REAL NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, ticker)
)
"""

CREATE_TRADES = """
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    executed_at TEXT NOT NULL
)
"""

CREATE_PORTFOLIO_SNAPSHOTS = """
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    total_value REAL NOT NULL,
    recorded_at TEXT NOT NULL
)
"""

CREATE_CHAT_MESSAGES = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL
)
"""

ALL_TABLES = [
    CREATE_USERS_PROFILE, CREATE_WATCHLIST, CREATE_POSITIONS,
    CREATE_TRADES, CREATE_PORTFOLIO_SNAPSHOTS, CREATE_CHAT_MESSAGES,
]

# [ASSUMED] — not specified by PLAN.md §7; a reasonable addition for the per-user
# lookup patterns every later phase will use, not a requirement.
CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_positions_user ON positions (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_trades_user_executed ON trades (user_id, executed_at)",
    "CREATE INDEX IF NOT EXISTS idx_snapshots_user_recorded ON portfolio_snapshots (user_id, recorded_at)",
    "CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages (user_id, created_at)",
]

DEFAULT_USER_ID = "default"
DEFAULT_CASH_BALANCE = 10000.0
```

**When to use:** This is the one and only schema definition point — every other module that needs table structure imports these constants, never re-declares DDL.

### Pattern 2: Lazy DB init in FastAPI lifespan

**What:** `init_db()` runs once at app startup (inside the existing `lifespan` context manager in `app/main.py`), before the market data source starts, creating tables if missing and seeding the default profile + 10-ticker watchlist only if `users_profile` is empty.

**When to use:** Any FastAPI app with a self-managing SQLite file and zero separate migration tooling (PLAN.md §7's explicit design).

**Example** (structurally adapted from the sibling-branch prior art `[CITED: git c4c9d86:backend/app/db/init.py]`, restructured for this phase's narrower repository surface and Pattern 1's DDL):
```python
# app/db/init.py
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.db.connection import get_connection
from app.db.schema import ALL_TABLES, CREATE_INDEXES, DEFAULT_CASH_BALANCE, DEFAULT_USER_ID
from app.market import DEFAULT_TICKERS  # reuse the existing barrel export — do not redefine


def init_db() -> None:
    """Create tables if missing and seed default data if `users_profile` is empty."""
    conn = get_connection()
    try:
        with conn:
            for ddl in ALL_TABLES:
                conn.execute(ddl)
            for index_ddl in CREATE_INDEXES:
                conn.execute(index_ddl)

            row = conn.execute("SELECT COUNT(*) AS n FROM users_profile").fetchone()
            if row["n"] == 0:
                now = datetime.now(UTC).isoformat()
                conn.execute(
                    "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
                    (DEFAULT_USER_ID, DEFAULT_CASH_BALANCE, now),
                )
                for ticker in DEFAULT_TICKERS:
                    conn.execute(
                        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                        (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, now),
                    )
    finally:
        conn.close()
```
Note the one deliberate deviation from the sibling branch: import `DEFAULT_TICKERS` from `app.market` (already barrel-exported, `[VERIFIED: backend/app/market/__init__.py:9,16,25]` — `DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]` per `backend/app/market/seed_prices.py:6-8`) instead of redefining a second `DEFAULT_WATCHLIST_TICKERS` constant in `schema.py` as that branch did — one list, one source of truth.

### Pattern 3: Async route handlers wrap synchronous SQLite via `asyncio.to_thread`

**What:** Every repository function (`get_watchlist`, `add_watchlist_ticker`, `remove_watchlist_ticker`) is a plain synchronous function. Route handlers are `async def` (matching every other route in this codebase) and must call these through `asyncio.to_thread` — never call them directly, which would block the event loop for the duration of the SQLite call.

**When to use:** Every call from `app/api/*.py` into `app/db/*.py`.

**Why this diverges from the sibling-branch prior art:** `[CITED: git c4c9d86:backend/app/api/watchlist.py]` calls `add_watchlist_ticker(ticker)` directly inside an `async def` route handler with no `to_thread` wrapper anywhere in that branch's `app/api/` or `app/db/`. That branch predates this project's own `.claude/CLAUDE.md` conventions, which state explicitly under "Function Design": *"Use `await asyncio.to_thread()` to run sync code without blocking the event loop."* For this single-user app the practical risk is small (SQLite calls are sub-millisecond), but the convention is explicit and this phase is the first to introduce a synchronous I/O call from an async handler in this codebase — follow the documented convention rather than the unmerged reference branch.

```python
# app/api/watchlist.py — illustrative
@router.post("/api/watchlist")
async def post_watchlist(body: WatchlistAddRequest, request: Request) -> Response:
    ...
    try:
        result = await asyncio.to_thread(db.add_watchlist_ticker, ticker)
    except ValueError as exc:
        return JSONResponse(status_code=409, content={"error": str(exc)})
    await request.app.state.market_source.add_ticker(ticker)  # already async, no wrapper needed
    return JSONResponse(status_code=201, content=result)
```

### Pattern 4: Frontend — swap ticker source-of-truth to `useWatchlist()`, and stop pointing the chart at a ticker that has left the watchlist

**What:** `Watchlist.tsx` currently gets its row list from `usePriceStreamContext().tickers` (`[VERIFIED: frontend/components/Watchlist.tsx:19,32]` — `const { ticks, history, tickers } = usePriceStreamContext();` then `{tickers.map((ticker) => ...)}`). This phase swaps that to the already-implemented `useWatchlist()` hook (`[VERIFIED: frontend/lib/hooks.ts:77-107]`, full function quoted below), keeping `ticks`/`history` from the stream context for live price data per row.

```typescript
// frontend/lib/hooks.ts:77-107 — already exists, unmodified, ready to use
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getWatchlist();
    if (!mountedRef.current) return;
    if (res.ok) {
      setWatchlist(res.data.watchlist);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { watchlist, loading, error, refetch };
}
```

`Watchlist.tsx` should call `const { watchlist, refetch } = useWatchlist();` and map `watchlist.map(e => e.ticker)` for row identity, still pulling `ticks[ticker]`/`history[ticker]` from `usePriceStreamContext()` for the live cells. The add-ticker form and each row's remove button call `addWatchlistTicker`/`removeWatchlistTicker` (`[VERIFIED: frontend/lib/api.ts:73-107]`, both already implemented and unused) and then call `refetch()` on success — exactly the flow the UI-SPEC's "New SSE tickers" interaction note describes (`.planning/phases/02-persistent-watchlist/02-UI-SPEC.md:150`: *"the add-ticker success path should trigger a `GET /api/watchlist` refetch ... so the grid re-renders with the new row"*).

**Required, not optional: reset `selectedTicker` when it leaves the watchlist.** `page.tsx`'s auto-select effect (`[VERIFIED: frontend/app/page.tsx:17-21]`) only fires while nothing is selected — it never reacts to the *currently selected* ticker disappearing. Today this is unreachable (the SSE-derived `tickers` array never shrinks — Pitfall 1), but once `Watchlist.tsx` is driven by `useWatchlist()` (which *can* shrink), removing the currently-charted ticker leaves `MainChart` frozen on stale data with no live updates and no visible explanation — a direct reading of WTCH success criterion 2 ("it disappears from the grid **and stops receiving updates**") that a user would notice immediately in UAT. Add a guard in `page.tsx`'s `Terminal()`:

```typescript
// frontend/app/page.tsx — Terminal(), alongside the existing auto-select effect
const { watchlist } = useWatchlist();
const watchlistTickers = watchlist.map((e) => e.ticker);

useEffect(() => {
  if (selectedTicker && !watchlistTickers.includes(selectedTicker)) {
    setSelectedTicker(watchlistTickers[0]); // undefined if the list is now empty — MainChart already handles no selection
  }
}, [selectedTicker, watchlistTickers]);
```
This composes with the existing "auto-select first ticker" effect rather than replacing it — the existing effect only fires when nothing is selected, this one only fires when the *current* selection has just become invalid.

### Pattern 5: Centralized ticker normalization (CONCERNS.md repair)

**What:** A single `normalize_ticker(raw: str) -> str` helper (uppercase + strip) used by `SimulatorDataSource.start/add_ticker/remove_ticker`, `MassiveDataSource.start/add_ticker/remove_ticker`, and the watchlist API route — replacing `MassiveDataSource`'s existing inline `.upper().strip()` (`[VERIFIED: backend/app/market/massive_client.py:67,73]` — `ticker = ticker.upper().strip()` appears in both `add_ticker` and `remove_ticker`) and adding the equivalent to `SimulatorDataSource`, which today has none (`[VERIFIED: backend/app/market/simulator.py:242-255]` — `SimulatorDataSource.add_ticker`/`remove_ticker`/`start` pass `ticker`/`tickers` straight through with no case/whitespace handling).

**When to use:** Any code path that accepts a ticker string from a caller (API request, chat tool call in Phase 4) before it reaches `PriceCache`, the DB, or either concrete `MarketDataSource`.

```python
# app/market/ticker.py
from __future__ import annotations

import re

TICKER_FORMAT_RE = re.compile(r"[A-Z0-9]{1,5}")


def normalize_ticker(raw: str) -> str:
    """Uppercase + strip whitespace. The single normalization point shared by
    both MarketDataSource implementations and the watchlist API, per
    CONCERNS.md's 'Ticker Symbol Normalization Diverges' finding."""
    return raw.strip().upper()


def is_valid_ticker_format(normalized: str) -> bool:
    """1-5 alphanumeric characters, already-normalized input expected."""
    return bool(TICKER_FORMAT_RE.fullmatch(normalized))
```
`SimulatorDataSource.add_ticker`/`remove_ticker`/`start` and `MassiveDataSource.start` should each normalize before touching internal state, mirroring the pattern `MassiveDataSource.add_ticker`/`remove_ticker` already establish.

### Pattern 6: `create_app()` needs an injectable market-source override for tests

**What:** Current `create_app()` hardcodes its market data source with no override point: `[VERIFIED: backend/app/main.py:64,73-74]`
```python
def create_app(*, static_dir: Path | None = None) -> FastAPI:
    price_cache = PriceCache()
    source = create_market_data_source(price_cache)
    ...
```
There is no way to substitute a `FakeMarketDataSource` test double for `source`, which Phase 2's watchlist tests need in order to assert `add_ticker`/`remove_ticker` were called without depending on a real `SimulatorDataSource`'s GBM timing (and without a `MASSIVE_API_KEY` triggering the Massive path in CI). This exactly mirrors the `static_dir` parameter's own existing purpose ("Tests pass an explicit path to isolate the static-mount behaviour from whatever happens to exist on disk" — same file, docstring at line 67-72).

**Recommended fix — extend the signature with the same keyword-only-override pattern already established:**
```python
def create_app(
    *, static_dir: Path | None = None, market_source: MarketDataSource | None = None
) -> FastAPI:
    price_cache = PriceCache()
    source = market_source if market_source is not None else create_market_data_source(price_cache)
    ...
```

**Hazard for whoever copies from the sibling-branch prior art:** every `[CITED: git c4c9d86:...]` snippet in this document that touches `app.state` uses the attribute name `market_data_source` (e.g. its conftest sets `application.state.market_data_source = market_source`). **This branch's actual, current `app/main.py` uses `app.state.market_source`** (`[VERIFIED: backend/app/main.py:81]` — `app.state.market_source = source`). Do not copy the reference's attribute name; keep `market_source` to match what this branch already ships, or every route handler and test fixture that reads `request.app.state.market_source` will `AttributeError` against code copied from the citation.

**Test fixture note:** `app.state.price_cache`/`app.state.market_source` are set *inside* the `lifespan` async context manager (`[VERIFIED: backend/app/main.py:76-85]`), not at `create_app()` return time — they only exist once the ASGI lifespan protocol actually runs. `backend/tests/test_main.py`'s existing pattern already handles this correctly (`with TestClient(app) as client:`, never a bare `TestClient(app)` without the context manager) — new `backend/tests/api/` fixtures must follow the same `with TestClient(app) as client:` shape, or `request.app.state.market_source` will not exist yet when a test tries to read it.

### Anti-Patterns to Avoid

- **Deriving the watchlist grid's row list from the SSE stream:** the stream's `tickers` state is a monotonically-growing `Set` union (see Pitfall 1) — it is structurally incapable of shrinking when a ticker is removed, which directly breaks WTCH success criterion 2. The grid's row list must come from `GET /api/watchlist`, full stop.
- **A second `DEFAULT_TICKERS`/`DEFAULT_WATCHLIST_TICKERS` constant:** the sibling branch defined its own list in `schema.py` duplicating `app/market/seed_prices.py`'s existing `DEFAULT_TICKERS`. Import the existing barrel export instead.
- **Calling `sqlite3` synchronously from an `async def` route handler without `asyncio.to_thread`:** violates this project's own documented convention even though the sibling branch does exactly this.
- **Validating ticker format inside `MarketDataSource.add_ticker()`:** the abstract interface's contract (`backend/app/market/interface.py:41-46`) says `add_ticker` is a no-op if already present, not a validation gate — rejecting bad input is an API-boundary concern (`app/api/watchlist.py`), not a market-data-source concern. Keep the interface's contract unchanged; validate before ever calling it.
- **Copying the sibling branch's `app.state.market_data_source` attribute name:** this branch's `main.py` already uses `market_source` — see Pattern 6's hazard note.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-to-dict conversion from SQLite | Manual column-index tuple unpacking | `conn.row_factory = sqlite3.Row` + `dict(row)` | Already the pattern the sibling-branch prior art used; avoids brittle positional indexing when columns are added in Phase 3/4 |
| Request body validation for `{"ticker": "..."}` | Manual `json.loads` + key checks | A `pydantic.BaseModel` (`WatchlistAddRequest`) | FastAPI already does this everywhere else implicitly (it's the framework's core value proposition) — this is the first route to receive a JSON body, so it's also the first to need an explicit model, but it's the same mechanism, not a new one |
| UUID generation for primary keys | Custom ID scheme | `uuid.uuid4()` via stdlib `uuid` | Matches every table's `id TEXT PRIMARY KEY` design in PLAN.md §7 (Pattern 1); the sibling branch does this consistently for every insert |

**Key insight:** Nothing in this phase justifies a new dependency or a hand-rolled abstraction — stdlib `sqlite3`, stdlib `uuid`, and the FastAPI/Pydantic machinery already in the project cover the entire surface.

## Runtime State Inventory

Not applicable — this phase is greenfield persistence (no rename/refactor/migration); it introduces state that did not previously exist rather than moving or renaming existing state. The one related housekeeping item (the missing `db/` directory and its `.gitignore` coverage) is called out separately above under **⚠️ Repo Gap**, since it blocks a file write rather than describing pre-existing runtime state to migrate.

## Common Pitfalls

### Pitfall 1: The SSE-derived `tickers` array only ever grows

**What goes wrong:** If `Watchlist.tsx` is left reading `tickers` from `usePriceStreamContext()`, removing a ticker from the watchlist will never make its row disappear — WTCH success criterion 2 fails silently (the DELETE call succeeds, the backend stops streaming that ticker, but the frontend still shows a frozen last-known-price row for it forever).

**Why it happens:** `[VERIFIED: frontend/lib/usePriceStream.ts:91-95]`:
```typescript
setTickers((prev) => {
  const merged = new Set(prev);
  for (const ticker of Object.keys(parsed)) merged.add(ticker);
  return Array.from(merged).sort();
});
```
This is a set union across every SSE frame ever received — there is no removal branch. It is correct behavior for its actual purpose (accumulating "every ticker this session has ever seen" for the `page.tsx` auto-select-first-ticker effect) but wrong as a source of "what should currently be displayed."

**How to avoid:** Never read `tickers` from `usePriceStreamContext()` for the watchlist grid's row list. Use `useWatchlist().watchlist` (see Pattern 4). `ticks`/`history` from the stream context are still correct to use per-ticker for live price/sparkline data — only the *row membership* list must change source.

**Warning signs:** A removed ticker's row still renders with a stale (non-updating) price after a `DELETE` call succeeds; a Playwright/manual test of WTCH criterion 2 fails while the network tab shows a clean `204`.

### Pitfall 2: Blocking the event loop with direct synchronous SQLite calls

**What goes wrong:** If route handlers call `db.get_watchlist()` etc. directly (as the sibling-branch prior art does), every concurrent request briefly blocks on the GIL-held SQLite call. At this app's scale (single user, one open SSE connection, occasional CRUD calls) this is unlikely to be user-visible, but it violates this project's explicit documented convention and will be flagged in code review.

**Why it happens:** `sqlite3` has no native asyncio interface; it's easy to call it directly from an `async def` handler and have it "just work" because Python doesn't error on blocking calls inside coroutines — it just blocks.

**How to avoid:** Wrap every `app.db.*` call from `app/api/*.py` in `await asyncio.to_thread(...)` (Pattern 3).

**Warning signs:** Code review flags a sync call inside an `async def` with no `to_thread`/`run_in_executor`; under concurrent load, SSE frame delivery to other connected clients stalls during a watchlist write.

### Pitfall 3: Ticker normalization fixed in only one `MarketDataSource` implementation

**What goes wrong:** CONCERNS.md's documented bug — `MassiveDataSource` already normalizes (`ticker.upper().strip()`), `SimulatorDataSource` does not. If only the API layer normalizes before writing to the DB (so the DB is always clean), but `SimulatorDataSource.start()` is later called with a list that happens to include mixed case from some other path (e.g., a future Phase 4 chat tool call bypassing the API layer, or a test), the simulator's internal dict keys and the DB/PriceCache keys diverge silently.

**Why it happens:** Normalization was added ad hoc to `MassiveDataSource` only, with no shared contract point in `MarketDataSource` (the ABC itself has no implementation to enforce this — it's abstract).

**How to avoid:** Route every ticker string through the shared `normalize_ticker()` helper (Pattern 5) at every `MarketDataSource` entry point (`start`, `add_ticker`, `remove_ticker`) in both concrete implementations, not just at the API boundary — defense in depth, since the interface contract itself cannot enforce this on subclasses.

**Warning signs:** A ticker added with lowercase input appears twice in `get_tickers()` (once correctly-cased from the DB path, once mis-cased from a direct simulator call), or `PriceCache.get("aapl")` and `PriceCache.get("AAPL")` return different objects.

### Pitfall 4: Route registration order relative to the static-file mount

**What goes wrong:** `app/main.py`'s existing comment already documents this correctly (`[VERIFIED: backend/app/main.py:89-91]`: *"Registration order matters: Starlette resolves routes in registration order, and a mount at `\"/\"` matches everything by prefix. API routers must be registered before the static mount, or it would swallow them."*) — but it's easy to add the new watchlist router *after* the `app.mount("/", StaticFiles(...))` call by pattern-matching the wrong nearby line.

**How to avoid:** Add `app.include_router(watchlist_router)` alongside the existing `app.include_router(create_stream_router(price_cache))` call and the `@app.get("/api/health")` handler — all before the `resolved_static_dir` mount block.

### Pitfall 5: The "still-held position" watchlist-removal nuance does not apply yet — but it must not be forgotten for Phase 3

**What it is:** The sibling-branch prior art's `remove_from_watchlist()` (`[CITED: git c4c9d86:backend/app/api/watchlist.py]`) checks whether the user still holds a position in a ticker before calling `market_data_source.remove_ticker()` on it — because removing a ticker's `PriceCache` entry while a position is still open would freeze that position's P&L and make it unsellable.

**Why it doesn't apply to Phase 2:** `positions` is one of the six tables created this phase but Phase 2 writes nothing into it — `PORT-02`/`PORT-03` (buy/sell, the only writers of `positions`) are Phase 3 requirements. `get_positions()` would always return `[]` in Phase 2, making the guard permanently a no-op.

**Recommendation:** Do not import `get_positions` into `app/api/watchlist.py` this phase — it would be dead code with no test that can meaningfully exercise it yet. `remove_from_watchlist()` should unconditionally call `market_source.remove_ticker()` this phase.

**Durable handoff (do not rely on this phase's RESEARCH.md being read by Phase 3):** this finding has also been appended to `.planning/codebase/CONCERNS.md` under a new "Forward-Looking Notes from Phase Research" entry this session, so Phase 3's own research pass will surface it independently of whether anyone re-reads this document.

## Code Examples

### Ticker format validation in the route handler

```python
# app/api/watchlist.py
from app.market.ticker import is_valid_ticker_format, normalize_ticker


class WatchlistAddRequest(BaseModel):
    ticker: str


@router.post("/api/watchlist")
async def post_watchlist(body: WatchlistAddRequest, request: Request) -> Response:
    raw = body.ticker
    normalized = normalize_ticker(raw)
    if not is_valid_ticker_format(normalized):
        return JSONResponse(
            status_code=400,
            content={"error": f"{raw} isn't a valid ticker — use 1-5 letters or numbers, like AAPL."},
        )
    try:
        result = await asyncio.to_thread(db.add_watchlist_ticker, normalized)
    except ValueError:
        return JSONResponse(
            status_code=409,
            content={"error": f"{normalized} is already on your watchlist."},
        )
    await request.app.state.market_source.add_ticker(normalized)
    return JSONResponse(status_code=201, content=result)
```
Error copy strings above are copied verbatim from the UI-SPEC's Copywriting Contract (`.planning/phases/02-persistent-watchlist/02-UI-SPEC.md:97-99`) so the frontend's single generic error-render slot needs no reformatting, per that document's explicit instruction ("the frontend does not reformat or template the `{error}` string it receives, it renders it as-is").

**Assumption flagged for the planner (see A2 below):** the UI-SPEC's malformed-format string uses the literal token `{input}`. This example echoes the *raw, pre-normalization* user input (`raw`, e.g. `"aa$pl "` as typed) rather than the normalized value, on the reasoning that echoing back exactly what the user typed reads more naturally in an error message. The UI-SPEC does not disambiguate raw-vs-normalized explicitly — this is a reasonable default, not a verified requirement; note it in the plan so the executor makes the same choice deliberately rather than by accident.

### `GET /api/watchlist` response assembly (joining DB rows with live cache state)

```python
# app/api/watchlist.py — structurally adapted from the sibling-branch prior art
# [CITED: git c4c9d86:backend/app/api/watchlist.py] — this function needs no modification for
# Phase 2's validation/normalization additions since it only reads.
def build_watchlist(price_cache: PriceCache) -> dict:
    entries = []
    for item in db.get_watchlist():
        ticker = item["ticker"]
        price_update = price_cache.get(ticker)
        if price_update is None:
            entries.append({
                "ticker": ticker, "added_at": item["added_at"],
                "price": None, "previous_price": None,
                "change": None, "change_percent": None, "direction": "flat",
            })
        else:
            entries.append({
                "ticker": ticker, "added_at": item["added_at"],
                "price": price_update.price, "previous_price": price_update.previous_price,
                "change": price_update.change, "change_percent": price_update.change_percent,
                "direction": price_update.direction,
            })
    return {"watchlist": entries}
```

This shape must match the frontend's already-existing type contract exactly. `frontend/lib/types.ts` and `frontend/lib/api.ts` both carry a header comment naming `planning/API_CONTRACT.md` and `OWNERSHIP.md` as their source of truth (`frontend/lib/types.ts:1-2`: *"Types mirroring planning/API_CONTRACT.md exactly... see OWNERSHIP.md"*) — **neither file exists in this branch** `[VERIFIED: find . -iname "API_CONTRACT.md" / "OWNERSHIP.md" returns nothing this session, excluding node_modules/.venv]`. Those references are leftovers from the same sibling-branch build (that branch's commit message names both files as its own coordination contract). For this branch, `frontend/lib/types.ts` is the de facto contract — treat it, not a document that doesn't exist here, as authoritative for response shape:

```typescript
// frontend/lib/types.ts:77-89 — verbatim, the de facto contract for this response shape
export interface WatchlistEntry {
  ticker: string;
  added_at: string;
  price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percent: number | null;
  direction: Direction;
}

export interface WatchlistResponse {
  watchlist: WatchlistEntry[];
}
```
`build_watchlist()`'s dict keys above match this interface's field names exactly, field for field.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Ticker list hardcoded to `DEFAULT_TICKERS` at app startup | Ticker list loaded from `app.db.get_watchlist()` at app startup | This phase | `app/main.py`'s lifespan changes its ticker source; `DEFAULT_TICKERS` is still used, but only as `init_db()`'s one-time seed data, not as the live startup list |
| Frontend row list derived from the SSE stream | Frontend row list fetched from `GET /api/watchlist` | This phase | Fixes Pitfall 1; also finally exercises `frontend/lib/hooks.ts`'s `useWatchlist()` and `frontend/lib/api.ts`'s watchlist functions, written in Phase 1 but never called until now |

**Deprecated/outdated:** None — nothing from Phase 1 is being removed, only extended.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | stdlib `sqlite3` (not `aiosqlite` or an ORM) is the intended driver | Standard Stack | Low — PLAN.md names SQLite but not a driver; stdlib is the zero-dependency default consistent with PLAN.md's own "self-contained, zero config" rationale, and matches the sibling-branch prior art's choice. If wrong, swapping later is a contained change to `app/db/connection.py` only. |
| A2 | The malformed-ticker error message should echo the user's *raw* input, not the normalized value | Code Examples | Low — cosmetic; either choice satisfies WTCH success criterion 4 ("rejected with a visible message"), this only affects exact wording |
| A3 | `remove_from_watchlist()` should NOT include the "still-held position" guard this phase | Pitfall 5 | Medium if Phase 3 planning misses this — mitigated by also recording this in `.planning/codebase/CONCERNS.md` this session so it has a durable home beyond this document |
| A4 | Health check and future portfolio/chat routers can stay out of a barrel `app/api/__init__.py` for now, adding just `watchlist_router` | Recommended Project Structure | Low — purely organizational; `/api/health` staying inline in `main.py` (as Phase 1 left it) vs. moving into `app/api/` is a style choice with no functional impact |
| A5 | Indexes (`CREATE_INDEXES` in Pattern 1) are worth adding now even though PLAN.md §7 doesn't specify them | Pattern 1 | Low — additive, does not conflict with §7's column specs, and costs nothing at this data scale; purely a forward-looking convenience for Phase 3/4's per-user queries |

## Open Questions

1. **Should `GET /api/watchlist`'s initial load show a loading/skeleton state?**
   - What we know: UI-SPEC marks this a "backstop" (🧪) state — "no skeleton/spinner is specified by default... if latency is measurable, a loading treatment is needed and this assumption is wrong" (`.planning/phases/02-persistent-watchlist/02-UI-SPEC.md:125`).
   - What's unclear: whether a local SQLite read is fast enough in practice to avoid any visible flicker on first paint.
   - Recommendation: build without a loading state first (matches UI-SPEC's default); the executor should visually confirm no flicker during phase verification, per the UI-SPEC's own held-out note.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python `sqlite3` stdlib module | DB layer | ✓ | Bundled with Python 3.12+ (backend requires `>=3.12`, `[VERIFIED: backend/pyproject.toml]`) | — |
| Write access to `<repo_root>/db/` | Lazy DB init on first request | Directory does not exist yet — must be created as part of this phase's work (see ⚠️ Repo Gap above) | — | — |

No missing dependencies block this phase; the `db/` directory creation is phase work, not an external blocker.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest 8.3.0 + pytest-asyncio 0.24.0 (`[VERIFIED: backend/pyproject.toml]`) |
| Backend config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Backend quick run | `cd backend && uv run --extra dev pytest tests/db tests/api -v` |
| Backend full suite | `cd backend && uv run --extra dev pytest -v` |
| Frontend framework | Vitest (existing config: `frontend/vitest.config.ts`, confirmed present from Phase 1) |
| Frontend quick run | `cd frontend && npm test -- Watchlist` |
| Frontend full suite | `cd frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WTCH-01 | `POST /api/watchlist` adds a valid new ticker, persists it, notifies the market source | unit/integration | `uv run pytest tests/api/test_watchlist.py -k add -x` | ❌ Wave 0 |
| WTCH-01 | Malformed/empty ticker rejected with 400, no DB write, no market-source notify | unit | `uv run pytest tests/api/test_watchlist.py -k malformed -x` | ❌ Wave 0 |
| WTCH-01 | Duplicate ticker rejected with 409 | unit | `uv run pytest tests/api/test_watchlist.py -k duplicate -x` | ❌ Wave 0 |
| WTCH-02 | `DELETE /api/watchlist/{ticker}` removes a ticker, notifies the market source, 404 if absent | unit/integration | `uv run pytest tests/api/test_watchlist.py -k remove -x` | ❌ Wave 0 |
| WTCH-01/02 | `init_db()` creates all 6 tables, seeds default user + 10 tickers, is idempotent | unit | `uv run pytest tests/db/test_init.py -x` | ❌ Wave 0 |
| WTCH-01/02 | Ticker normalization is consistent between `SimulatorDataSource` and `MassiveDataSource` | unit | `uv run pytest tests/market/test_simulator_source.py tests/market/test_massive.py -k normal -x` | ❌ Wave 0 (extends existing files) |
| WTCH-01/02 | Frontend `Watchlist.tsx` renders rows from `useWatchlist()`, not the SSE-derived ticker set; add/remove call the API and refetch | component | `npm test -- Watchlist` | ❌ Wave 0 (existing `Watchlist.test.tsx` currently asserts the *old* SSE-driven behavior and must be rewritten, not just extended — `[VERIFIED: frontend/__tests__/Watchlist.test.tsx:164-201]`) |

### Sampling Rate

- **Per task commit:** targeted `pytest -k <area>` / `npm test -- <Component>`
- **Per wave merge:** full backend + frontend suites
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/db/__init__.py`, `conftest.py`, `test_init.py`, `test_repository.py` — new test package, no existing analog in the current branch (a same-named, now-deleted package existed on a sibling branch; recreate fresh per this phase's narrower repository surface, do not attempt to resurrect the old `.pyc` files under `backend/app/db/__pycache__`/`backend/tests/db/__pycache__`, which are stale bytecode with no matching source in this branch)
- [ ] `backend/tests/api/__init__.py`, `conftest.py` (with a `FakeMarketDataSource` test double and the `create_app(market_source=...)` injection point from Pattern 6), `test_watchlist.py` — new test package
- [ ] `frontend/__tests__/Watchlist.test.tsx`'s existing `describe("Watchlist", ...)` block (`frontend/__tests__/Watchlist.test.tsx:164-201`) must be rewritten to mock `useWatchlist()`/`lib/api` rather than asserting on SSE-derived ticker count — this is a required rewrite, not an addition, since the current test's premise (rows come from the stream) is exactly what this phase invalidates

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Explicitly out of scope — single hardcoded `user_id="default"`, PLAN.md §7 |
| V3 Session Management | No | No sessions exist in this app |
| V4 Access Control | No | Single-user, no authorization boundaries |
| V5 Input Validation | Yes | Ticker format regex (`[A-Z0-9]{1,5}`) applied server-side before any DB write, per this phase's own scope note and CONCERNS.md's "No Ticker Symbol Validation" finding |
| V6 Cryptography | No | No secrets or cryptographic operations in this phase |
| V12 (Files/Data) — parameterized queries | Yes | **Requirement for the code this phase writes**, not an observation of existing code: `app/db/repository.py` does not exist yet in this branch. Every SQL statement it defines this phase MUST use `?` placeholders, never string interpolation. The sibling-branch prior art demonstrates this pattern consistently `[CITED: git c4c9d86:backend/app/db/repository.py]`, but that file is not part of this branch — treat its placeholder style as the pattern to follow, not as proof that this branch's (not-yet-written) code already does this. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SQL injection via ticker string | Tampering | Parameterized queries (`?` placeholders) in every `sqlite3` call — never f-string/`.format()` interpolation into SQL text |
| Unbounded ticker string causing downstream issues (e.g., a very long string as a dict key, log spam, or oversized DB rows) | Denial of Service (minor) | The 1-5 alphanumeric format validation gate rejects any oversized/malformed input before it reaches the DB, `PriceCache`, or either `MarketDataSource` implementation |
| Path traversal via ticker in `DELETE /api/watchlist/{ticker}` | Tampering | FastAPI path parameters are URL-decoded but not filesystem paths here — the ticker is only ever used as a SQL parameter and a dict key, never as a file path, so traversal is not applicable; still normalize + bound-check before use as defense in depth |

## Sources

### Primary (HIGH confidence)

- `backend/app/market/{interface,cache,simulator,massive_client,models,stream,factory,seed_prices,__init__}.py` — read in full this session, current state of the codebase this phase modifies
- `backend/app/main.py` — read in full this session
- `frontend/lib/{api,types,hooks,usePriceStream,PriceStreamContext}.ts(x)` — read in full this session
- `frontend/components/{Watchlist,WatchlistRow}.tsx` — read in full this session
- `frontend/app/page.tsx` — read in full this session
- `backend/tests/{test_main,market/test_simulator_source}.py`, `backend/tests/conftest.py` — read in full this session
- `.planning/codebase/CONCERNS.md` — read in full this session (and appended to, per Pitfall 5's durable handoff)
- `.planning/phases/02-persistent-watchlist/02-UI-SPEC.md` — read in full this session (approved design contract)
- `.planning/phases/01-live-price-terminal/01-PATTERNS.md` — read in full this session
- `planning/PLAN.md` §4, §7 — quoted verbatim in this document (Pattern 1, ⚠️ Repo Gap)
- `.claude/CLAUDE.md` — quoted directives in the Project Constraints section above
- `backend/uv.lock` — grepped this session for installed `fastapi`/`pydantic`/`uvicorn` versions
- `.gitignore` — read in full this session
- `/websites/fastapi_tiangolo` (Context7) — queried this session for current custom-`JSONResponse`/status-code and Pydantic body-validation patterns; confirms the `JSONResponse(status_code=..., content=...)` pattern used throughout this document is current, documented FastAPI usage

### Secondary (MEDIUM confidence)

- `git show c4c9d86:backend/app/{db,api,main}.py` and matching test files — an unmerged sibling-branch (`my-agent-teams`) implementation of this exact schema/route contract, built against the same PLAN.md by a different agent-team run. Real, working code on another branch (that branch's own commit message: "188 backend unit/integration tests... all passing") — cited throughout as `[CITED: git c4c9d86:<path>]`, never `[VERIFIED]`, because these paths do not exist in this branch's working tree and were not opened with `Read` against this branch. **Not authoritative for this phase's design decisions** — it predates this project's CONVENTIONS.md (see Pitfall 2), lacks the ticker validation this phase's roadmap scope explicitly requires, and uses an `app.state` attribute name (`market_data_source`) that does not match this branch's actual code (`market_source` — see Pattern 6's hazard note).

### Tertiary (LOW confidence)

- None — no unverified web-only claims were needed for this phase; the entire persistence/routing surface is either stdlib, already-installed, grounded in PLAN.md's own text, or demonstrated as a citable pattern in-repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stdlib `sqlite3` + already-installed FastAPI/Pydantic, versions confirmed against `backend/uv.lock`
- Architecture: HIGH — every pattern is either read directly from the current codebase (`[VERIFIED]`) or cited from a working sibling-branch implementation of the identical contract (`[CITED]`), with deviations from this project's own conventions called out explicitly
- Pitfalls: HIGH — all five pitfalls are grounded in code actually read this session (line-cited), not speculative

**Research date:** 2026-09-18
**Valid until:** 30 days (stable stdlib + already-pinned dependency versions; low churn risk)

# Phase 2: Persistent Watchlist - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 20 File Classification rows, covering ~24 individual files (9 new backend modules, 2 modified backend modules, 4 new backend test files grouped into 2 rows + 2 extended test files, 3 modified/new frontend files + 1 rewritten test file, plus `db/.gitkeep` and `.gitignore`)
**Analogs found:** 17 exact/role-match / 20 rows (3 rows have no live analog — new-package scaffolding for `app/db/*` and `app/api/*`, plus `db/.gitkeep`; use RESEARCH.md Code Examples)

## ⚠️ Stale-Bytecode Trap — `backend/app/{api,db,llm}/__pycache__` and `backend/tests/{api,db,llm}/__pycache__`

**Do not treat these as existing source or as analogs.** `find backend/app/api backend/app/db backend/app/llm backend/tests/api backend/tests/db backend/tests/llm -type f` returns only `__pycache__/*.pyc` files (`watchlist.cpython-313.pyc`, `schema.cpython-313.pyc`, `repository.cpython-313.pyc`, `conftest.cpython-313-pytest-9.0.2.pyc`, etc.) — **zero `.py` source files**. `git ls-files` and `git status --porcelain` against these same paths both return empty. This is stale compiled bytecode left over from a deleted/uncommitted source tree (consistent with RESEARCH.md's Wave 0 Gaps note about "stale `.pyc` files under `backend/app/db/__pycache__`... with no matching source in this branch," which also called out `backend/app/llm` as a sibling case). **Action for the planner/executor:** delete these `__pycache__` directories or ignore them entirely; every file this phase creates under `app/api/`, `app/db/`, `tests/api/`, `tests/db/` is a fresh file with no real predecessor in this branch, despite what the bytecode names suggest. `app/llm/` and `tests/llm/` are out of scope for Phase 2 (Phase 4 territory per PLAN.md §9) — do not create them this phase.

## ⚠️ Repo Gap Carried Forward — `db/` Directory Missing, `.gitignore` Doesn't Cover SQLite Runtime Files

Same class of blocker Phase 1 hit with `frontend/lib/` (01-PATTERNS.md's blocking-issue section; that one is now resolved — `.gitignore:17` is `/lib/`, `git ls-files` confirms `frontend/lib/*.ts` are tracked). This phase's own version, `[VERIFIED]` this session:
- `ls db/` → `No such file or directory`; `git ls-files db/` returns nothing.
- `.gitignore:61-62` only has the generic Django-template `db.sqlite3` / `db.sqlite3-journal` — neither matches `db/finally.db` or its `-wal`/`-shm` sidecars (Pattern 1 below uses WAL mode).

**Required Wave 0 task, before any `init_db()` run:** create `db/.gitkeep`; add `db/*.db`, `db/*.db-wal`, `db/*.db-shm`, `db/*.db-journal` to `.gitignore` (a new stanza, do not touch the existing Django-template lines).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/db/schema.py` | model (DDL constants) | batch (static data) | `backend/app/market/seed_prices.py` | role-match (constants-module style) |
| `backend/app/db/connection.py` | utility | CRUD (connection factory) | `backend/app/main.py` (`resolve_static_dir`'s env-var pattern) + `backend/app/market/factory.py` (`MASSIVE_API_KEY` env-var read) | role-match |
| `backend/app/db/init.py` | service (lazy init) | batch (idempotent create+seed) | `backend/app/main.py`'s `lifespan` (sequencing) + `backend/app/market/simulator.py`'s `_add_ticker_internal`-style guarded insert | role-match |
| `backend/app/db/repository.py` | model/service (CRUD) | CRUD | `backend/app/market/cache.py` (thread-safe CRUD-shaped store, lock discipline as a conceptual analog only — sqlite3 needs no lock) | role-match (concept only — no direct SQL analog in-repo) |
| `backend/app/db/__init__.py` | config (barrel) | — | `backend/app/market/__init__.py` | exact (barrel pattern identical) |
| `backend/app/api/watchlist.py` | route (JSON CRUD) | request-response | `backend/app/market/stream.py` (factory-function router shape) | role-match, data-flow mismatch — stream.py is a streaming GET with no body/path-param/4xx branching; use RESEARCH.md Code Examples for the JSONResponse/Pydantic-body mechanics stream.py doesn't demonstrate |
| `backend/app/api/__init__.py` | config (barrel) | — | `backend/app/market/__init__.py` | exact |
| `backend/app/market/ticker.py` | utility | transform | `backend/app/market/massive_client.py`'s inline `ticker.upper().strip()` (lines 67, 73) | role-match (extracting an existing inline pattern into a shared helper) |
| `backend/app/market/simulator.py` (MODIFIED) | service | streaming | itself, current code | self |
| `backend/app/market/massive_client.py` (MODIFIED) | service | streaming/batch (poll) | itself, current code | self |
| `backend/app/main.py` (MODIFIED) | controller (app entrypoint) | request-response + lifecycle | itself, current code | self |
| `backend/tests/db/__init__.py`, `conftest.py`, `test_init.py`, `test_repository.py` | test | CRUD | `backend/tests/market/test_simulator_source.py` (class-based async-or-sync test shape) + `backend/tests/conftest.py` (fixture convention) | role-match |
| `backend/tests/api/__init__.py`, `conftest.py`, `test_watchlist.py` | test | request-response | `backend/tests/test_main.py` (`create_app(static_dir=...)` + `with TestClient(app) as client:` shape) + `backend/tests/market/test_massive.py` (`MagicMock`/`patch.object` test-double idiom for `conftest.py`'s `FakeMarketDataSource`) | role-match |
| `backend/tests/market/test_simulator_source.py` (EXTENDED) | test | streaming | itself, current code | self |
| `backend/tests/market/test_massive.py` (EXTENDED) | test | streaming/batch | itself, current code | self |
| `frontend/components/Watchlist.tsx` (MODIFIED) | component | request-response (fetch-driven, was streaming/derived) | itself, current code | self |
| `frontend/components/WatchlistRow.tsx` (MODIFIED) | component | transform (props → cells) | itself, current code | self |
| `frontend/app/page.tsx` (MODIFIED) | component (client) | event-driven | itself, current code | self |
| `frontend/__tests__/Watchlist.test.tsx` (REWRITTEN) | test | component | itself, current code (the `describe("Watchlist", ...)` block only — the `WatchlistRow` `describe` blocks above it are untouched) | self, but content inverts (see Pattern below) |
| `.gitignore` (MODIFIED) | config | — | itself, current code (`.gitignore:61-62`) | self |

## Pattern Assignments

### `backend/app/db/schema.py` (NEW)

**Analog:** `backend/app/market/seed_prices.py` (constants-module style: top-of-file docstring, `UPPER_SNAKE_CASE` dict/list constants, no classes)

**Style to copy** (`backend/app/market/seed_prices.py:1-8`):
```python
"""Seed prices and per-ticker parameters for the market simulator."""

DEFAULT_TICKERS: list[str] = [
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX",
]
```
Apply the same shape to `schema.py`'s `CREATE_*` DDL string constants and `ALL_TABLES`/`CREATE_INDEXES` lists (full DDL text is in RESEARCH.md Pattern 1 — copy it verbatim, it already matches PLAN.md §7 column-for-column). Do **not** redefine a second `DEFAULT_TICKERS`/`DEFAULT_WATCHLIST_TICKERS` here — import the existing one from `app.market` (see `init.py` below).

---

### `backend/app/db/connection.py` (NEW)

**Analog:** `backend/app/main.py:28,49-51` (env-var override pattern) + `backend/app/market/factory.py` (`os.environ.get(...)` read)

**Env-var override pattern to copy** (`backend/app/main.py:28,49-51`):
```python
STATIC_DIR_ENV_VAR = "FINALLY_STATIC_DIR"
...
env_value = os.environ.get(STATIC_DIR_ENV_VAR, "").strip()
if env_value:
    return Path(env_value).expanduser()
```
Apply identically for `get_db_path()`: a `FINALLY_DB_PATH` (or similar) env var override, falling back to `<repo_root>/db/finally.db` computed the same way `main.py` computes `_REPO_ROOT = Path(__file__).resolve().parents[2]` (adjust `parents[N]` for `connection.py`'s actual depth under `backend/app/db/`). This is also the exact seam `tests/db/conftest.py`'s temp-db fixture monkeypatches to point at a `tmp_path` SQLite file instead of the real `db/finally.db`.

**Connection factory — one connection per call, `Row` factory, WAL mode** (no in-repo analog for the SQL specifics; RESEARCH.md Standard Stack + Alternatives Considered already settled this as the pattern — "one connection per call" was chosen explicitly over a shared module-level connection because `sqlite3.Connection` is not thread-safe, mirroring the reasoning `PriceCache` uses `threading.Lock()` for its shared dict in `cache.py:21,34`):
```python
def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    return conn
```

---

### `backend/app/db/init.py` (NEW)

**Analog:** `backend/app/main.py`'s `lifespan` (start/seed/stop sequencing shape) + RESEARCH.md Pattern 2's full code (already adapted from the sibling-branch citation to this branch's conventions — copy it directly, not the citation)

**Import discipline — do not duplicate `DEFAULT_TICKERS`:**
```python
from app.market import DEFAULT_TICKERS  # [VERIFIED: backend/app/market/__init__.py:9,16,25]
```
`app/market/__init__.py:12-26` is the barrel this must come through — never `from app.market.seed_prices import DEFAULT_TICKERS` (Anti-Pattern in RESEARCH.md and CONVENTIONS.md's "Barrel Files" rule, already followed correctly by `main.py:21`).

**Idempotent create-if-empty guard shape** — mirrors `SimulatorDataSource._add_ticker_internal`'s "check before insert" idiom (`backend/app/market/simulator.py:146-152`, `if ticker in self._prices: return`), applied to the seed check via `SELECT COUNT(*)`. Full code in RESEARCH.md Pattern 2 — use verbatim.

---

### `backend/app/db/repository.py` (NEW)

**Analog:** Conceptual only — `backend/app/market/cache.py`'s CRUD-method naming (`get`, `get_all`, `remove`) and per-method docstring style; **no in-repo SQL analog exists** (first `sqlite3` code in this branch).

**Method-naming/docstring convention to copy** (`backend/app/market/cache.py:24-33,52-56,62-65`):
```python
def get(self, ticker: str) -> PriceUpdate | None:
    """Get the latest price for a single ticker, or None if unknown."""
    with self._lock:
        return self._prices.get(ticker)
```
`repository.py`'s functions (`get_cash_balance`, `get_watchlist`, `add_watchlist_ticker`, `remove_watchlist_ticker`) should be plain module-level functions (not a class — `cache.py`'s class shape doesn't apply here since there's no shared in-memory state to protect; each call opens/closes its own connection per Pattern from `connection.py`), each with a one-line docstring in the same "what it returns, and what `None`/exception means" style `cache.py` establishes. Every SQL statement uses `?` placeholders — never string interpolation (RESEARCH.md Security Domain V12, non-negotiable). Row→dict conversion via `dict(row)` since `connection.py` sets `row_factory = sqlite3.Row` (RESEARCH.md "Don't Hand-Roll" table).

**Duplicate/not-found signaling convention** (CONVENTIONS.md "Error Handling": "Return `None` for 'not found' cases (not exceptions)... raise for actual bugs"): `get_watchlist()`/`get_cash_balance()` return `None`/`[]` for absence; `add_watchlist_ticker()` raises `ValueError` on a UNIQUE-constraint duplicate (caught by the route handler per RESEARCH.md's Code Examples, which map it to HTTP 409); `remove_watchlist_ticker()` returns a bool or raises depending on whether the route needs to distinguish 404 — follow RESEARCH.md's system diagram (`404 if absent`) exactly.

---

### `backend/app/db/__init__.py` (NEW)

**Analog:** `backend/app/market/__init__.py` — **exact** structural match (barrel re-export + `__all__`)

**Copy this shape verbatim** (`backend/app/market/__init__.py:1-26`, full file):
```python
"""Market data subsystem for FinAlly.

Public API:
    PriceUpdate         - Immutable price snapshot dataclass
    ...
"""

from .cache import PriceCache
from .factory import create_market_data_source
...

__all__ = [
    "PriceUpdate",
    "PriceCache",
    ...
]
```
`app/db/__init__.py` re-exports exactly what RESEARCH.md's Recommended Project Structure names: `init_db`, `get_watchlist`, `add_watchlist_ticker`, `remove_watchlist_ticker` (not `get_cash_balance` — RESEARCH.md's structure note explicitly scopes the barrel to "only what Phase 2 needs"; `get_cash_balance` may exist in `repository.py` for internal use / future phases without being barrel-exported yet, or export it too if the plan finds a Phase 2 caller — check before assuming). Callers write `from app.db import get_watchlist`, never `from app.db.repository import get_watchlist` (same anti-pattern rule as `app.market`).

---

### `backend/app/api/watchlist.py` (NEW)

**Analog:** `backend/app/market/stream.py` for the **factory-function + module-logger + docstring shape only** — role-match, not a data-flow match (stream.py is a single streaming GET with no request body, no path param, no 4xx/2xx branching; this file is JSON CRUD with three routes and five distinct status codes). Treat RESEARCH.md's own "Code Examples" section (`post_watchlist`, `build_watchlist`) as the primary source for the actual route bodies — those examples were written specifically for this file and already resolve the `asyncio.to_thread`, normalization, and error-shape decisions; `stream.py` only supplies the outer factory/router conventions.

**Factory-function shape to copy** (`backend/app/market/stream.py:19-31,60`):
```python
def create_stream_router(price_cache: PriceCache, *, interval: float = 0.5) -> APIRouter:
    """Create the SSE streaming router with a reference to the price cache.

    Constructs a fresh `APIRouter` on every call — this factory pattern lets
    us inject the PriceCache without globals...
    """
    router = APIRouter(prefix="/api/stream", tags=["streaming"])

    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        ...

    return router
```
Note: `stream.py`'s own header comment about this factory pattern ("lets us inject... without globals, and without two calls ever sharing route registrations") **is already correctly implemented in this branch** — `router = APIRouter(...)` is inside the factory body (`stream.py:31`), not module-level. (01-PATTERNS.md flagged the module-level-singleton version as a bug to fix during Phase 1; that fix has landed — `[VERIFIED]` this session by reading the current file. Do not describe this as an outstanding anti-pattern to the planner.) `create_watchlist_router(price_cache, market_source)`-shaped factory (or however the plan names it) should follow the identical "build fresh `APIRouter`, define handlers as closures, return it" shape, but with a plain-JSON dependency signature rather than SSE's `Request`-streaming one — this is where RESEARCH.md's own Code Examples (`post_watchlist`) take over.

**Module logger convention** (`stream.py:16`):
```python
logger = logging.getLogger(__name__)
```

**Route bodies:** copy RESEARCH.md's "Code Examples" section verbatim — `WatchlistAddRequest(BaseModel)`, the `POST /api/watchlist` handler (normalize → validate format → `asyncio.to_thread(db.add_watchlist_ticker, ...)` → `market_source.add_ticker` → 201), and `build_watchlist()` for `GET /api/watchlist` (joins `db.get_watchlist()` rows with `price_cache.get(ticker)`, producing the exact `WatchlistEntry` shape frontend's `types.ts:77-85` expects). `DELETE /api/watchlist/{ticker}` mirrors the POST shape per RESEARCH.md's system diagram: normalize → `asyncio.to_thread(db.remove_watchlist_ticker, ...)` (404 if absent) → `market_source.remove_ticker()` → 204.

**Registration-order pitfall — copy the existing comment, don't just the code:** `backend/app/main.py:89-91`:
```python
# Registration order matters: Starlette resolves routes in registration
# order, and a mount at "/" matches everything by prefix. API routers
# must be registered before the static mount, or it would swallow them.
```
Add `app.include_router(watchlist_router)` in `main.py` right next to the existing `app.include_router(create_stream_router(price_cache))` call (`main.py:92`) — both before the `resolved_static_dir` mount block (`main.py:98-113`).

---

### `backend/app/api/__init__.py` (NEW)

**Analog:** `backend/app/market/__init__.py` — same exact barrel shape, scoped down to `watchlist_router` only this phase (RESEARCH.md's `[ASSUMED] A4`: portfolio/chat routers join this barrel in Phases 3-4, health stays inline in `main.py` for now).

---

### `backend/app/market/ticker.py` (NEW)

**Analog:** `backend/app/market/massive_client.py:67,73` — the exact inline logic being extracted

**Current inline pattern being centralized** (`backend/app/market/massive_client.py:66-70,72-76`):
```python
async def add_ticker(self, ticker: str) -> None:
    ticker = ticker.upper().strip()
    if ticker not in self._tickers:
        self._tickers.append(ticker)
        logger.info("Massive: added ticker %s (will appear on next poll)", ticker)

async def remove_ticker(self, ticker: str) -> None:
    ticker = ticker.upper().strip()
    self._tickers = [t for t in self._tickers if t != ticker]
    self._cache.remove(ticker)
    logger.info("Massive: removed ticker %s", ticker)
```
`ticker.py`'s `normalize_ticker()` replaces `ticker.upper().strip()` in both these call sites (note: this call site does `.upper().strip()`, RESEARCH.md's helper does `.strip().upper()` — same result, order doesn't matter for these two idempotent ops, but match RESEARCH.md's Pattern 5 code exactly: `raw.strip().upper()`). `is_valid_ticker_format()` is new — no in-repo analog, `MassiveDataSource` never validated format, only normalized. `SimulatorDataSource.add_ticker`/`remove_ticker`/`start` (`backend/app/market/simulator.py:242-256,219-230`) currently have **zero** normalization (`[VERIFIED]` — ticker strings pass straight through to `self._sim.add_ticker(ticker)` etc.) — this is Pitfall 3's exact gap; add the same `normalize_ticker()` call at the top of each of those three methods.

---

### `backend/app/market/simulator.py` (MODIFIED)

**Analog:** itself, current code — add normalization only, do not restructure

**Exact lines to change** (`backend/app/market/simulator.py:219-230` `start()`, `242-249` `add_ticker()`, `251-255` `remove_ticker()`):
```python
async def add_ticker(self, ticker: str) -> None:
    if self._sim:
        self._sim.add_ticker(ticker)   # <- normalize `ticker` before this call
        ...
```
Import `from .ticker import normalize_ticker` and normalize the incoming string at the top of `start()` (for each ticker in the list), `add_ticker()`, and `remove_ticker()` — matching `MassiveDataSource`'s existing per-method normalization placement (`massive_client.py:67,73`), not a single choke point, since both concrete classes' `MarketDataSource` interface methods are the actual entry points (Pitfall 3: the ABC itself cannot enforce this on subclasses).

---

### `backend/app/market/massive_client.py` (MODIFIED)

**Analog:** itself, current code

Replace the two inline `ticker.upper().strip()` occurrences (`massive_client.py:67,73`) with `normalize_ticker(ticker)` from the new `app.market.ticker` module. No other change — `start()` in this file does not currently normalize either (`[VERIFIED: massive_client.py:41-43]`, `self._tickers = list(tickers)` — no `.upper().strip()` applied there today); RESEARCH.md's Pattern 5 says `start()` should also normalize in both implementations, so add it here too for symmetry with the fix being made to `SimulatorDataSource.start()`.

---

### `backend/app/main.py` (MODIFIED)

**Analog:** itself, current code — four ordered changes inside the existing `create_app()`/`lifespan`

**Current lifespan body to modify** (`backend/app/main.py:76-85`):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the market data source on boot, stop it on shutdown."""
    await source.start(DEFAULT_TICKERS)
    app.state.price_cache = price_cache
    app.state.market_source = source
    logger.info("Market data source started with %d default tickers", len(DEFAULT_TICKERS))
    yield
    await source.stop()
    logger.info("Market data source stopped")
```
Required change sequence: call `init_db()` **first** (before anything reads the DB) → load tickers via `app.db.get_watchlist()` (falling back to `DEFAULT_TICKERS` only if the query somehow returns empty, which `init_db()`'s seeding should prevent in practice) → `await source.start(db_tickers)` in place of the current `DEFAULT_TICKERS` literal (line 79) → keep `app.state.price_cache`/`app.state.market_source` assignments unchanged (attribute names already correct, see Pitfall/hazard below).

**Signature extension for test injection** (`backend/app/main.py:64,73-74`, current):
```python
def create_app(*, static_dir: Path | None = None) -> FastAPI:
    price_cache = PriceCache()
    source = create_market_data_source(price_cache)
```
RESEARCH.md Pattern 6's fix — add a keyword-only `market_source: MarketDataSource | None = None` override, defaulting to the existing factory call, mirroring `static_dir`'s own existing override pattern and docstring style (lines 67-72: "Tests pass an explicit path to isolate..."). Copy that docstring's phrasing for the new parameter.

**Hazard — attribute name, do not use the sibling-branch's name:** `main.py:81` already uses `app.state.market_source` (confirmed this session, unchanged from Phase 1). RESEARCH.md's cited sibling-branch snippets use `market_data_source` — do not let that leak into new test fixtures or route handlers; every `request.app.state.market_source` reference in `app/api/watchlist.py` and `tests/api/conftest.py` must use `market_source`.

**Route registration — insert before the static mount** (`main.py:92-96`, current):
```python
app.include_router(create_stream_router(price_cache))

@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

resolved_static_dir = static_dir if static_dir is not None else resolve_static_dir()
```
Add `app.include_router(watchlist_router)` between the existing `include_router` call and the `resolved_static_dir` line — same reasoning as `main.py:89-91`'s existing comment.

**Test-fixture lifecycle note (from `tests/test_main.py:26-34`):** `app.state.price_cache`/`app.state.market_source` only exist once the ASGI lifespan actually runs — every existing test uses `with TestClient(app) as client:`, never a bare `TestClient(app)`. New `tests/api/conftest.py` fixtures that need to seed `client.app.state.price_cache` with test prices (for `build_watchlist()`'s price-join logic) must do so **inside** the `with TestClient(app) as client:` block, after entry, not before — matching this exact pattern:
```python
app = create_app(static_dir=tmp_path)
with TestClient(app) as client:
    response = client.get("/api/health")
```

---

### `backend/tests/db/{__init__,conftest,test_init,test_repository}.py` (NEW)

**Analog:** `backend/tests/market/test_simulator_source.py` (class-per-concern, one-behavior-per-method shape) + `backend/tests/conftest.py` (project-level fixture convention)

**Class/method shape to copy** (`backend/tests/market/test_simulator_source.py:11-25`):
```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    """Integration tests for the SimulatorDataSource."""

    async def test_start_populates_cache(self):
        """Test that start() immediately populates the cache."""
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL", "GOOGL"])
        assert cache.get("AAPL") is not None
        assert cache.get("GOOGL") is not None
        await source.stop()
```
`test_init.py`/`test_repository.py` are **synchronous** (no `sqlite3`/`asyncio.to_thread` inside the DB layer itself — only the API layer wraps calls in `to_thread`), so drop `@pytest.mark.asyncio` and `async def` for these two files; keep the "one class per component, one assertion focus per method, full docstring per test" shape. `conftest.py`'s `temp_db` fixture follows `backend/tests/conftest.py`'s existing one-fixture style (`event_loop_policy`, lines 6-11) — monkeypatch the `connection.py` env var (see `connection.py`'s Pattern above) to point at `tmp_path / "test.db"`, then call `init_db()`.

---

### `backend/tests/api/{__init__,conftest,test_watchlist}.py` (NEW)

**Analog:** `backend/tests/test_main.py` (`create_app` + `TestClient` context-manager shape) + `backend/tests/market/test_massive.py` (`MagicMock`-based test-double idiom)

**`create_app`/`TestClient` shape to copy** (`backend/tests/test_main.py:26-34`):
```python
async def test_health_returns_ok(self, tmp_path):
    app = create_app(static_dir=tmp_path)
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
```
`conftest.py`'s app/client fixture passes `market_source=FakeMarketDataSource()` (Pattern 6) alongside `static_dir=tmp_path`, still wrapped in `with TestClient(app) as client:`.

**Test-double idiom to copy** (`backend/tests/market/test_massive.py:1-19`, `_make_snapshot` helper + `MagicMock`):
```python
from unittest.mock import MagicMock, patch
...
source._client = MagicMock()  # Satisfy the guard
with patch.object(source, "_fetch_snapshots", return_value=mock_snapshots):
    await source._poll_once()
```
`FakeMarketDataSource` in `tests/api/conftest.py` should be a small hand-written class implementing the four `MarketDataSource` ABC methods (`start`, `stop`, `add_ticker`, `remove_ticker`, `get_tickers`) that records calls in a list (e.g. `self.added: list[str] = []`) rather than a `MagicMock` — because `app/api/watchlist.py`'s route handlers call `await request.app.state.market_source.add_ticker(ticker)` and the test needs to assert *which* ticker was passed, which a plain recording fake makes more readable than mock call-arg inspection; this is a reasonable deviation from `test_massive.py`'s `MagicMock` choice (that file mocks a third-party `RESTClient`, not an in-repo ABC with only 5 methods).

---

### `backend/tests/market/test_simulator_source.py` (EXTENDED)

**Analog:** itself, current code

Add a test asserting normalization at the ABC entry points, following the exact "assert version advanced" / "assert get_tickers() contains X" idiom already used (`test_add_ticker`, lines 50-60, and `test_remove_ticker`, lines 62-72):
```python
async def test_add_ticker_normalizes_case(self):
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
    await source.start(["AAPL"])
    await source.add_ticker("tsla")
    assert "TSLA" in source.get_tickers()
    assert cache.get("TSLA") is not None
    await source.stop()
```

---

### `backend/tests/market/test_massive.py` (EXTENDED)

**Analog:** itself, current code

Add an equivalent `test_add_ticker_normalizes_case`/`test_start_normalizes_case` following the existing `TestMassiveDataSource` class shape (lines 22-30) — construct with lowercase/mixed-case ticker strings, assert `get_tickers()` returns upper-case.

---

### `frontend/components/Watchlist.tsx` (MODIFIED)

**Analog:** itself, current code — the change is a data-source swap, not a rewrite

**Current code being replaced** (`frontend/components/Watchlist.tsx:8,19,32`):
```typescript
import { usePriceStreamContext } from "@/lib/PriceStreamContext";
...
const { ticks, history, tickers } = usePriceStreamContext();
...
{tickers.map((ticker) => (
  <WatchlistRow key={ticker} ticker={ticker} tick={ticks[ticker]} history={history[ticker]} ... />
))}
```
**New code shape** — add `import { useWatchlist } from "@/lib/hooks";` (already-exported, unmodified, `frontend/lib/hooks.ts:77-107` — full function quoted in RESEARCH.md Pattern 4), keep `usePriceStreamContext()` for `ticks`/`history` only:
```typescript
const { ticks, history } = usePriceStreamContext();
const { watchlist, refetch } = useWatchlist();
...
{watchlist.map((entry) => (
  <WatchlistRow key={entry.ticker} ticker={entry.ticker} tick={ticks[entry.ticker]} history={history[entry.ticker]} onRemove={() => { void removeWatchlistTicker(entry.ticker).then(refetch); }} ... />
))}
```
**Resolved by UI-SPEC, not left to the executor:** `WatchlistRow`'s current props (`tick?: PriceTick`) have no slot for `WatchlistEntry`'s REST-sourced `price`/`previous_price`/`change_percent`/`direction` fields — the ones `build_watchlist()` fills in server-side for a newly-added ticker before its first SSE tick arrives. 02-UI-SPEC.md:128 ("watchlist grid (newly-added row, pre-first-tick)") is explicit and graded ✅ covered: "This reuses Phase 1's existing per-cell empty/loading treatment for price and sparkline cells (already designed for progressive fill-in from page load) — **no new state is introduced**." That is the approved design decision: `WatchlistRow` does NOT gain a new `entry: WatchlistEntry` prop or a REST-fallback rendering path. The row continues to render purely from `tick` (existing `formatPrice(tick?.price)` → `"—"` when `tick` is `undefined`) regardless of what `build_watchlist()`'s REST fields contain; those REST fields only drive row *existence* (which tickers appear at all), never cell content. Do not port Phase 1's `positionMath.ts` "fall back to REST snapshot" idiom here — that pattern was designed for the portfolio's `Position`/`LivePosition` split, not for this row, and the UI-SPEC has already ruled it out for this element.

**Add-ticker form + empty state placement:** per UI-SPEC's Interaction & Layout Notes, the `<form>` goes inside the *same* bordered panel `<div>`, directly above `<thead>` (not a new wrapping element) — this modifies `Watchlist.tsx`'s existing `<table>`-containing return block, it does not add a sibling component.

---

### `frontend/components/WatchlistRow.tsx` (MODIFIED)

**Analog:** itself, current code

**Critical fix required — event bubbling into the row's own click handler** (`frontend/components/WatchlistRow.tsx:60,64`, current code):
```typescript
<tr
  data-testid={`row-${ticker}`}
  tabIndex={0}
  aria-selected={selected}
  onClick={select}          // <- fires on ANY click inside the row, including the new remove button
  onKeyDown={handleKeyDown}
  ...
>
```
UI-SPEC's "zero-one-many: remove interaction vs. row-select" backstop item (line 134) requires the new 5th `<td>`'s remove button to call `event.stopPropagation()` before invoking the remove handler, or clicking `×` will also fire `onSelect` (MKT-04's click-to-chart behavior) via this existing `onClick={select}` on the `<tr>`. New button:
```tsx
<td className="py-1.5 pr-3 text-right">
  <button
    type="button"
    aria-label={`Remove ${ticker} from watchlist`}
    data-testid={`remove-${ticker}`}
    className="text-sm text-[var(--color-down)]"
    onClick={(event) => {
      event.stopPropagation();
      onRemove?.(ticker);
    }}
  >
    ×
  </button>
</td>
```
Follows the existing per-cell `data-testid={`...-${ticker}`}` convention already established for every other cell (`price-${ticker}`, `change-${ticker}`, `sparkline-${ticker}`, lines 72,78,83).

**Formatting reuse — unchanged:** continue using `formatPrice`/`formatPercent` from `frontend/lib/format.ts` (already imported, line 12) for any REST-sourced fallback values per the `Watchlist.tsx` decision above — never inline `.toFixed()`.

---

### `frontend/app/page.tsx` (MODIFIED — required, not optional)

**Analog:** itself, current code

**Current auto-select effect, unchanged** (`frontend/app/page.tsx:17-21`):
```typescript
useEffect(() => {
  if (!selectedTicker && tickers.length > 0) {
    setSelectedTicker(tickers[0]);
  }
}, [selectedTicker, tickers]);
```
This only fires while nothing is selected — it never reacts to the current selection disappearing. RESEARCH.md Pattern 4 flags this as **required**: once `Watchlist.tsx` is driven by `useWatchlist()` (which can shrink on remove, unlike the SSE-derived `tickers` array), a removed-but-still-selected ticker leaves `MainChart` frozen with no live updates. Add, alongside the existing effect, inside `Terminal()`:
```typescript
const { watchlist } = useWatchlist();
const watchlistTickers = watchlist.map((e) => e.ticker);

useEffect(() => {
  if (selectedTicker && !watchlistTickers.includes(selectedTicker)) {
    setSelectedTicker(watchlistTickers[0]); // undefined if empty — MainChart already handles no selection
  }
}, [selectedTicker, watchlistTickers]);
```
Two independent effects, not a merge into one — the existing effect's guard (`!selectedTicker`) and the new one's guard (`selectedTicker && !watchlistTickers.includes(...)`) are mutually exclusive conditions on purpose.

---

### `frontend/__tests__/Watchlist.test.tsx` (REWRITTEN — the `describe("Watchlist", ...)` block only)

**Analog:** itself, current code — this is an inversion of the existing test's premise, not an extension

**Current test asserting the premise this phase invalidates** (`frontend/__tests__/Watchlist.test.tsx:164-201`, full `describe` block):
```typescript
describe("Watchlist", () => {
  it("renders exactly ten rows when the shared stream reports ten tickers", () => {
    global.EventSource = FakeEventSource;
    ...
    render(<PriceStreamProvider><Watchlist /></PriceStreamProvider>);
    const source = FakeEventSource.instances[0];
    act(() => { source.fireMessage(Object.fromEntries(tickers.map((t) => [t, makeTick(t, 100)]))); });
    expect(screen.getAllByRole("row")).toHaveLength(1 + tickers.length);
  });
});
```
This asserts row *count* comes from the SSE message — exactly the behavior Pitfall 1 says must be removed. Rewrite this block to mock `useWatchlist`/`lib/api` instead: `vi.mock("@/lib/hooks", () => ({ useWatchlist: () => ({ watchlist: [...ten WatchlistEntry objects...], loading: false, error: null, refetch: vi.fn() }) }))`, still wrap in `<PriceStreamProvider>` for `ticks`/`history` (unchanged — the `FakeEventSource` fixture above this block, lines ~13-33, is untouched and still needed for that context). No `vi.mock` calls exist yet anywhere in `frontend/__tests__/*.tsx` (`[VERIFIED]` — grep for `vi.mock` across all test files returned nothing) — this is the first mock of this kind in the project; the closest available convention is the file's own existing `FakeEventSource` class pattern (hand-rolled test double assigned to a global, not a `vi.mock` module factory) — either approach is reasonable since there's no precedent to match; `vi.mock` is the more idiomatic Vitest choice for mocking a hook module and is recommended, but flag this as a new pattern being introduced, not a pattern reused.

Add new test cases for: add-form submit success (calls `addWatchlistTicker`, then `refetch`), remove-button click (calls `removeWatchlistTicker` with `stopPropagation` verified — e.g. assert `onSelect` was NOT called), and the empty-state render (`watchlist: []` → "Watchlist is empty" text) — per RESEARCH.md's Phase Requirements → Test Map row for `WTCH-01/02` frontend coverage.

## Shared Patterns

### Backend: Module-level logger + `%`-formatting
**Source:** `backend/app/market/factory.py:5,13`, `backend/app/market/stream.py:16`, `backend/app/market/massive_client.py:14`
**Apply to:** `app/db/*.py`, `app/api/watchlist.py`, `app/market/ticker.py`, modified `main.py`
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Simulator: added ticker %s", ticker)   # % formatting, never f-strings
```

### Backend: Barrel-file imports, never reach into submodules
**Source:** `backend/app/market/__init__.py`, applied at `backend/app/main.py:21`
**Apply to:** every new `app/db/__init__.py` and `app/api/__init__.py` consumer
```python
from app.db import init_db, get_watchlist, add_watchlist_ticker, remove_watchlist_ticker
from app.api import watchlist_router
```

### Backend: `from __future__ import annotations` + full type hints, `| None` not `Optional`
**Source:** every file in `backend/app/market/*.py` (verified: `models.py:3`, `cache.py:3`, `stream.py:3`, `simulator.py:3`, `massive_client.py:3`, `main.py:11`)
**Apply to:** every new/modified `.py` file this phase, first import line.

### Backend: `asyncio.to_thread` at every async-handler → sync-I/O boundary
**Source:** `backend/app/market/massive_client.py:97` (`snapshots = await asyncio.to_thread(self._fetch_snapshots)`) — the one existing precedent for wrapping a synchronous, blocking call from async code in this codebase
**Apply to:** every `app/api/watchlist.py` route handler's call into `app/db/repository.py`
```python
result = await asyncio.to_thread(db.add_watchlist_ticker, normalized)
```

### Backend: Guarded-insert / no-op-if-present idiom
**Source:** `backend/app/market/simulator.py:120-124` (`add_ticker`), `146-149` (`_add_ticker_internal`)
```python
def add_ticker(self, ticker: str) -> None:
    if ticker in self._prices:
        return
    ...
```
**Apply to:** `init.py`'s seed-if-empty check (`SELECT COUNT(*)` guard) and conceptually to `repository.add_watchlist_ticker`'s duplicate handling (there it's a UNIQUE-constraint-driven `ValueError` instead of a silent no-op, per RESEARCH.md's 409 requirement — the *shape* of "check before mutating shared state" is the shared idiom, not the exact no-op behavior).

### Frontend: `"use client"` as line 1 + null-safe formatting via `lib/format.ts`
**Source:** `frontend/components/Watchlist.tsx:1`, `WatchlistRow.tsx:1`; `frontend/lib/format.ts` (whole file, referenced not re-read this session — confirmed still in use at `WatchlistRow.tsx:12`)
**Apply to:** all three modified frontend files.

### Frontend: `ApiResult<T>` discriminated union + `mountedRef` guard for fetch hooks
**Source:** `frontend/lib/api.ts:19`, `frontend/lib/hooks.ts:77-107` (`useWatchlist`, already implemented)
**Apply to:** `Watchlist.tsx`'s consumption of `useWatchlist()` and any new call sites of `addWatchlistTicker`/`removeWatchlistTicker` (`frontend/lib/api.ts:73-107`, already implemented) — check `.ok` explicitly, never assume success.

### Frontend: `data-testid` naming convention
**Source:** `frontend/components/WatchlistRow.tsx:61,72,78,83` (`row-${ticker}`, `price-${ticker}`, `change-${ticker}`, `sparkline-${ticker}`)
**Apply to:** new elements per UI-SPEC's explicit list: `watchlist-add-form`, `watchlist-add-input`, `watchlist-add-submit`, `watchlist-add-error`, `remove-${ticker}`, `watchlist-empty`.

---

### `.gitignore` (MODIFIED)

**Analog:** itself, current code (`.gitignore:61-62`)

**Existing stanza this sits next to** (`.gitignore:58-62`):
```
# Django stuff:
*.log
local_settings.py
db.sqlite3
db.sqlite3-journal
```
Do not edit these lines (they're an unrelated Django-template leftover, harmless to keep). Add a new, clearly-labeled stanza instead, matching this file's existing per-framework comment-header convention (`# Django stuff:`, `# Node / Next.js`, etc. — see `.gitignore:209` for the most recent precedent):
```
# FinAlly SQLite runtime data (db/.gitkeep is tracked; the DB file and its
# WAL/SHM/journal sidecars are not)
db/*.db
db/*.db-wal
db/*.db-shm
db/*.db-journal
```

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/db/schema.py`, `connection.py`, `init.py`, `repository.py`, `__init__.py` | model/service/utility/config | CRUD/batch | First `sqlite3` code in this branch — no in-repo SQL analog exists; RESEARCH.md Pattern 1/2 supply verbatim code, structurally adapted from the sibling-branch citation but not copyable as `[VERIFIED]` since that branch's files don't exist here (see RESEARCH.md's provenance discussion) |
| `backend/app/api/watchlist.py`, `__init__.py` | route/config | request-response | First JSON-body/path-param/multi-status-code route in this branch — `stream.py` supplies only the outer factory-function shape (see Pattern Assignments above); route bodies come from RESEARCH.md Code Examples |
| `db/.gitkeep` | config | — | New empty-directory marker; no content to pattern-match, just needs to exist per the Repo Gap note |

## Metadata

**Analog search scope:** `backend/app/market/*.py` (all 8 modules, full files), `backend/app/main.py` (full file), `backend/tests/{test_main,conftest}.py` + `backend/tests/market/{test_simulator_source,test_massive}.py` (full files), `frontend/components/{Watchlist,WatchlistRow}.tsx`, `frontend/lib/{hooks,api,types}.ts`, `frontend/app/page.tsx`, `frontend/__tests__/Watchlist.test.tsx`, `frontend/lib/format.ts` (referenced, not re-read — content already known from 01-PATTERNS.md's full-file quote), `.gitignore` (all full files unless noted). Confirmed via `find` + `git ls-files`/`git status --porcelain` that `backend/app/{api,db,llm}/__pycache__` and `backend/tests/{api,db,llm}/__pycache__` contain only stale, untracked bytecode with no matching `.py` source — excluded from analog consideration (see blocking-issue section above). Confirmed `.gitignore:17` is `/lib/` (Phase 1's `frontend/lib/` blocker is resolved) and re-verified `db/` is absent and uncovered by `.gitignore` for this phase's own gap. Ran `git ls-files -- <path>` covering every named analog path across two passes this session (`backend/app/`, `backend/tests/`, and named `frontend/` files in the first pass; `frontend/__tests__/Watchlist.test.tsx`, `frontend/lib/format.ts`, and `.gitignore` explicitly re-checked in a second pass after advisor review flagged the gap) — every path returned non-empty. The tracked-source gate passed for all analogs cited in this document.
**Files scanned:** 19 target files classified; 17 existing files read as source analogs (14 full-file reads, 3 partial via targeted `sed`/grep since they were already known-content from RESEARCH.md quotes: `stream.py` read in full to verify the router-singleton fix landed).
**Pattern extraction date:** 2026-09-18

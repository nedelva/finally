# Phase 5: One-Command Delivery - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 18 (9 wholly new infra files/dirs, 2 existing-file modifications, 1 test-file companion edit, 6 new E2E spec files treated as one class)
**Analogs found:** 6 / 18 (many files are genuinely greenfield infra with no in-repo precedent — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/pyproject.toml` (edit) | config | batch (dependency resolution) | itself (current file) | exact — self-edit, not a copy-from-elsewhere pattern |
| `backend/app/market/massive_client.py` (edit) | service | request-response (REST polling) | itself + `backend/app/market/factory.py`'s existing conditional-import style | exact — self-edit |
| `backend/tests/market/test_massive.py` (companion edit, REQUIRED) | test | request-response | itself (current file) | exact — the `massive_client.py` lazy-import edit breaks 3 existing patch targets in this file; see Critical Correction #2 |
| `backend/app/market/factory.py` (edit, if `TYPE_CHECKING` import needed) | service | request-response | itself (current file) | exact — self-edit |
| `Dockerfile` | config | batch (image build) | none in-repo | role-match to RESEARCH.md Pattern 2 (uv-docker-example) |
| `.dockerignore` | config | batch | `.gitignore` (root) | role-match — same "exclude patterns" role, different tool |
| `docker-compose.yml` | config | batch | none in-repo | no analog — use RESEARCH.md Code Examples |
| `scripts/start_mac.sh` | utility | event-driven (CLI invocation) | none in-repo | no analog — use RESEARCH.md Pattern 3 |
| `scripts/stop_mac.sh` | utility | event-driven | none in-repo | no analog — use RESEARCH.md Pattern 3 |
| `scripts/start_windows.ps1` | utility | event-driven | none in-repo | no analog — translate `start_mac.sh` logic |
| `scripts/stop_windows.ps1` | utility | event-driven | none in-repo | no analog — translate `stop_mac.sh` logic |
| `.env.example` | config | — | `README.md`'s Environment Variables table + `.env` (gitignored, present locally) | exact — content is already fully specified in PLAN.md §5 and README.md |
| `test/package.json` | config | — | `frontend/package.json` | role-match — same repo's npm-package conventions (name field, scripts block shape) |
| `test/package-lock.json` (REQUIRED companion of `test/package.json`) | config | — | `frontend/package-lock.json` | exact — same repo's "always commit the lockfile" convention; see Critical Correction #3 |
| `test/playwright.config.ts` | config | — | `frontend/vitest.config.ts` | role-match — same repo's TS test-config conventions (ESM import style, `defineConfig`) |
| `test/docker-compose.test.yml` | config | batch | `docker-compose.yml` (this phase's own sibling file) | exact — same tool, opposite persistence policy (see Shared Patterns) |
| `test/e2e/fresh-start.spec.ts` | test | request-response (browser E2E) | `frontend/components/Header.tsx` + `frontend/__tests__/ConnectionDot.test.tsx` (for selectors/testids, not test framework) | role-match — testid conventions carry over; no Playwright spec precedent exists |
| `test/e2e/watchlist.spec.ts` | test | request-response | `frontend/components/Watchlist.tsx`, `WatchlistRow.tsx` (testids) | role-match |
| `test/e2e/trading.spec.ts` | test | request-response | `frontend/components/TradeBar.tsx` (testids) | role-match |
| `test/e2e/portfolio-viz.spec.ts` | test | request-response | `frontend/components/Heatmap.tsx`, `PositionsTable.tsx` (testids) | role-match |
| `test/e2e/chat.spec.ts` | test | request-response | `frontend/components/chat/ChatPanel.tsx` (testids) | role-match |
| `test/e2e/sse-reconnect.spec.ts` | test | streaming | `frontend/components/ConnectionDot.tsx` (testid/attribute contract) | role-match — **RESEARCH.md's own code example uses the wrong selector, see Critical Correction #1** |

## Critical Corrections to RESEARCH.md (verified by direct reads this session)

### #1: SSE-reconnect selector is wrong, and `data-status` is not exclusive to the connection dot

RESEARCH.md's "Code Examples" section (lines 410-425) shows:
```typescript
await expect(page.getByTestId('connection-status')).toHaveClass(/green/);
```
This selector **does not exist in the codebase** and will fail immediately. Verified by direct read of `frontend/components/ConnectionDot.tsx` (lines 41-53):

```tsx
export function ConnectionDot({ status }: ConnectionDotProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        data-status={status}
        aria-label={LABEL[status]}
        role="status"
        className={`inline-block h-2.5 w-2.5 rounded-full ${COLOR_CLASS[status]}`}
      />
      <span className="text-xs text-gray-400">{LABEL[status]}</span>
    </span>
  );
}
```

Real facts planner/executor must use instead:
- There is **no `data-testid` on the dot** — the stable hook is `data-status`, one of exactly four string values: `"connected"`, `"connecting"`, `"reconnecting"`, `"disconnected"`.
- Colour classes are Tailwind arbitrary-value classes (`bg-[var(--color-up)]`, `bg-[var(--color-accent-yellow)] animate-pulse`, `bg-[var(--color-down)]`) — **never** the literal strings `"green"`/`"red"`/`"amber"`. Asserting on `toHaveClass(/green/)` will never match.
- **`data-status` is NOT unique to `ConnectionDot`.** Grepped this session: `frontend/components/chat/ChatPanel.tsx:113,125` also renders `data-status={change.status}` / `data-status={trade.status}` on inline trade/watchlist-change confirmation pills, with values `"executed"` / `"failed"`. Value spaces don't overlap with the connection dot's four values in practice, but Playwright's strict-mode locator resolution will throw if a selector ever matches more than one element — so **scope the selector to the unique `role="status"` attribute**, which grepped this session appears only on `ConnectionDot`'s span (the chat pills carry `data-testid`/`data-status` but no `role`):
```typescript
import { test, expect } from '@playwright/test';

test('SSE reconnects after network drop', async ({ page }) => {
  await page.goto('/');
  const dot = page.getByRole('status');
  await expect(dot).toHaveAttribute('data-status', 'connected');

  await page.context().setOffline(true);
  await expect(dot).toHaveAttribute('data-status', /connecting|reconnecting/);

  await page.context().setOffline(false);
  await expect(dot).toHaveAttribute('data-status', 'connected', { timeout: 10_000 });
});
```
- Existing frontend unit test confirms both attributes as this codebase's established convention: `frontend/__tests__/Header.test.tsx:43` — `expect(screen.getByRole("status")).toHaveAttribute("data-status", "disconnected")` — is the closest in-repo precedent for this exact selector idiom and should be mirrored, not the RESEARCH.md snippet.

### #2: The `massive_client.py` lazy-import edit breaks 3 existing tests — plan must include a companion test fix

`backend/tests/market/test_massive.py` (grepped and read this session, lines 135, 188, 207) patches the SDK client at the **module level** using its current import binding:
```python
with patch("app.market.massive_client.RESTClient"):
    with patch.object(source, "_fetch_snapshots", return_value=[]):
        await source.start(["aapl"])
```
This patch target (`app.market.massive_client.RESTClient`) only exists because `massive_client.py` currently does `from massive import RESTClient` at module scope (line 8), binding `RESTClient` as a module-level attribute of `app.market.massive_client`. **Moving that import inside `start()`/`_fetch_snapshots()` (per RESEARCH.md's Pitfall #4 lazy-import fix) removes this attribute entirely — all three `patch("app.market.massive_client.RESTClient")` calls will raise `AttributeError: <module> does not have the attribute 'RESTClient'` at test-collection/call time.**

**Required companion change (not in RESEARCH.md's scope note — found only by reading the test file directly):** When the planner schedules the `massive_client.py` lazy-import edit, it must schedule `backend/tests/market/test_massive.py` lines 135, 188, 207 as part of the *same* task/commit, re-pointing the patch to the real import source instead of the now-removed module attribute:
```python
with patch("massive.RESTClient"):   # patch the SDK's own namespace, not massive_client's
    with patch.object(source, "_fetch_snapshots", return_value=[]):
        await source.start(["aapl"])
```
This works because the deferred `from massive import RESTClient` inside `start()` re-reads `massive.RESTClient` at call time, so patching the SDK module itself (rather than the now-nonexistent re-export) still intercepts the construction. After this edit, run the full `backend/tests/market/` suite (73 tests per RESEARCH.md) to confirm no other test in that directory relies on the old binding — `test_factory.py` was also grepped this session and only imports `MassiveDataSource` itself (no `RESTClient` patch), so it is unaffected.

### #3: `test/package.json` without a committed lockfile breaks `npm ci` in the compose file

RESEARCH.md's `test/docker-compose.test.yml` example (lines 377-408) runs `command: sh -c "npm ci && npx playwright test"`. `npm ci` **hard-errors when no `package-lock.json` is present** — and `test/` currently has only a stray, config-less `node_modules/` (confirmed by directory listing this session), no lockfile. This project's established convention is to commit the lockfile alongside `package.json` — verified: `git ls-files -- frontend/package-lock.json` returns the tracked path. The plan must add `test/package-lock.json` as an explicit deliverable (classification table row above), produced by running `npm install` once inside `test/` after `test/package.json` is authored, and committed — not left to be generated fresh on every CI/E2E run.

## Pattern Assignments

### `backend/pyproject.toml` (config, batch — dependency-hygiene edit)

**Analog:** itself, current state (read this session)

**Current core deps** (lines 7-16):
```toml
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "numpy>=2.0.0",
    "massive>=1.0.0",
    "rich>=13.0.0",
    "litellm>=1.102.0",
    "pydantic>=2.12.5",
    "python-dotenv>=1.2.1",
]
```

**Required change:** Remove `"rich>=13.0.0"` from `dependencies`, add a new `[project.optional-dependencies]` extra (the `dev` extra already exists at lines 18-25 — add a sibling `demo` extra, do not merge into `dev`):
```toml
[project.optional-dependencies]
dev = [
    "httpx>=0.28.1",
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=5.0.0",
    "ruff>=0.7.0",
]
demo = [
    "rich>=13.0.0",
]
```
**Do NOT touch `massive`** — it stays a core dependency (see Common Pitfalls #4 in RESEARCH.md: this is a lazy-*import* fix in code, not a lazy-*install* fix in the manifest). After editing, run `uv lock` inside `backend/` and commit the updated `backend/uv.lock` — `uv sync --locked` in the Docker build fails hard on any lockfile drift.

**Verification of `rich`'s sole consumer** (already verified in RESEARCH.md via grep): only `backend/market_data_demo.py` imports `rich`. After the extra split, its invocation becomes `uv run --extra demo market_data_demo.py`.

---

### `backend/app/market/massive_client.py` (service, request-response — lazy-import edit)

**Analog:** itself, current state (read this session, full file 1-130 lines)

**Current top-of-file import** (lines 1-16):
```python
"""Massive (Polygon.io) API client for real market data."""

from __future__ import annotations

import asyncio
import logging

from massive import RESTClient
from massive.rest.models import SnapshotMarketType

from .cache import PriceCache
from .interface import MarketDataSource
from .ticker import normalize_ticker

logger = logging.getLogger(__name__)
```

**Required change:** Move `from massive import RESTClient` and `from massive.rest.models import SnapshotMarketType` out of module scope into the two call sites that actually touch the SDK — `start()` (line 42, where `RESTClient(...)` is constructed) and `_fetch_snapshots()` (line 124-129, where `SnapshotMarketType.STOCKS` is used). Follow this project's established lazy-import idiom: import inside the function body, guard the type-hint-only reference with `if TYPE_CHECKING:` at module scope so `self._client: RESTClient | None` (line 40) still type-checks under ruff/mypy without requiring `massive` to be importable at module-load time:
```python
from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from .cache import PriceCache
from .interface import MarketDataSource
from .ticker import normalize_ticker

if TYPE_CHECKING:
    from massive import RESTClient

logger = logging.getLogger(__name__)
```
Then inside `start()`:
```python
    async def start(self, tickers: list[str]) -> None:
        from massive import RESTClient

        self._client = RESTClient(api_key=self._api_key)
        ...
```
And inside `_fetch_snapshots()`:
```python
    def _fetch_snapshots(self) -> list:
        from massive.rest.models import SnapshotMarketType

        return self._client.get_snapshot_all(
            market_type=SnapshotMarketType.STOCKS,
            tickers=self._tickers,
        )
```
**Why this is safe:** `MassiveDataSource` is only ever instantiated by `factory.py`'s `create_market_data_source()` when `MASSIVE_API_KEY` is non-empty (verified `factory.py:24-28`) — by the time `start()` runs, the caller has already committed to the Massive path, so a real `ImportError` here is exactly as loud as today's module-scope one, just deferred to the moment it's actually needed.

**MANDATORY companion edit:** See Critical Correction #2 above — `backend/tests/market/test_massive.py` lines 135, 188, 207 patch `app.market.massive_client.RESTClient`, which this edit removes as a module attribute. Re-point those three patches to `massive.RESTClient` in the same task/commit, then run the full `backend/tests/market/` suite.

---

### `backend/app/market/factory.py` (service, request-response — check only, likely no change needed)

**Analog:** itself, current state (full file read, 32 lines)

`factory.py:10` does `from .massive_client import MassiveDataSource` at module scope. Since `MassiveDataSource` itself no longer imports `massive` at module scope after the fix above, this import stays safe (importing the *class* doesn't touch `massive`). **No change required here** unless the executor discovers `TYPE_CHECKING`-only symbols leak into `factory.py`'s own type hints — spot-check after the `massive_client.py` edit lands.

---

### `Dockerfile` (config, batch — new file)

**Analog:** none in-repo (first Dockerfile in this project). Use RESEARCH.md's Pattern 2 (`/astral-sh/uv-docker-example`, adapted) verbatim — it is already fully adapted to this repo's actual nested `backend/`/`frontend/` layout and cites exact line numbers of the path-arithmetic it must satisfy (`backend/app/db/connection.py:16-33`, `backend/app/main.py:41-51`).

**Load-bearing constraints to carry over exactly (verified against real source this session):**
- `_REPO_ROOT = Path(__file__).resolve().parents[3]` in `backend/app/db/connection.py:18` requires `backend/app/db/connection.py` to physically sit at `/app/backend/app/db/connection.py` in the image — i.e. **do not flatten `backend/` into `/app/`**.
- `_BACKEND_DIR = Path(__file__).resolve().parents[1]` in `backend/app/main.py:43` requires `backend/app/main.py` at `/app/backend/app/main.py`.
- Belt-and-suspenders: pin `ENV FINALLY_DB_PATH=/app/db/finally.db` and `ENV FINALLY_STATIC_DIR=/app/backend/static` explicitly (both env vars already implemented and read in the current source — `connection.py:16`, `main.py:41`).
- Build-time assertion after the static `COPY --from=frontend-builder`: `RUN test -f /app/backend/static/index.html` (guards against Pitfall #2 — `/api/health` returning 200 with zero UI mounted, since `resolve_static_dir()` in `main.py:147-152` only logs a warning, never fails, when no static dir is found).
- `RUN mkdir -p /app/db && chown -R nonroot:nonroot /app/db /app/backend` **before** `USER nonroot` (Pitfall #3 — fresh named-volume ownership).
- `HEALTHCHECK` must use a Python one-liner against `/api/health` (already implemented, `main.py:133-135`, returns `{"status": "ok"}`) — no `curl` in the slim images.
- Exactly 2 stages (`node:20-slim` → `ghcr.io/astral-sh/uv:python3.12-trixie-slim`) — PLAN.md §11 locks this; do not add a 3rd slimming stage.

---

### `.dockerignore` (config, batch — new file)

**Analog:** `.gitignore` (root, 187 lines, read this session) — same "exclusion patterns" role. Reuse its existing entries for `node_modules/`, `/frontend/out/`, `.next/`, `db/*.db*`, `.venv` rather than re-deriving them; RESEARCH.md's Common Pitfalls #1 already lists the exact merged set needed (`.dockerignore` needs a superset of `.gitignore` since it must also exclude `.git`, `.planning`, `backend/.venv`, `test/node_modules` — some of which `.gitignore` handles by directory pattern already, some (`.git`) it doesn't need to since git ignores itself implicitly).

**Concrete excerpt from `.gitignore`** (relevant lines, this session):
```
node_modules/
/frontend/out/
.next/
*.tsbuildinfo

db/*.db
db/*.db-wal
db/*.db-shm
db/*.db-journal
```
`.dockerignore` must add on top of this (per RESEARCH.md Pitfall #1): `backend/.venv`, `.git`, `.env`, `test/node_modules`, `.planning`, `**/__pycache__`, `frontend/tsconfig.tsbuildinfo`.

---

### `docker-compose.yml` / `test/docker-compose.test.yml` (config, batch — new files)

**Analog:** each other (this phase creates both; they share the `build: .` / `services.app` shape but have **opposite volume policies** — see Shared Patterns below). No prior compose file exists in-repo. Use RESEARCH.md's Code Examples section verbatim (lines 361-408) — both snippets were built directly from PLAN.md §11's `docker run` command and are internally consistent with the Dockerfile pattern above (same `ENV`/`HEALTHCHECK` contract). **Exception:** see Critical Correction #3 — `npm ci` in the `playwright` service's command requires `test/package-lock.json` to be committed first.

**Critical YAML-typing correction already caught by RESEARCH.md (Pitfall #7), reinforce in the plan:** `LLM_MOCK: "true"` **must be quoted** in `test/docker-compose.test.yml` — verified against `backend/app/llm/client.py:45`'s exact-string check `if os.environ.get("LLM_MOCK") == "true":` (read this session). An unquoted `LLM_MOCK: true` becomes the Python string `"True"` after YAML boolean coercion, which fails this comparison and silently sends E2E traffic to the real OpenRouter API.

---

### `scripts/start_mac.sh` / `scripts/stop_mac.sh` (utility, event-driven — new files)

**Analog:** none in-repo (no `scripts/` directory exists yet — confirmed by directory listing this session). Use RESEARCH.md's Pattern 3 code verbatim (lines 226-263) — it is a complete, idempotent, already-correct implementation matching PLAN.md §11's exact `docker run -v finally-data:/app/db -p 8000:8000 --env-file .env` invocation and the "never touch the volume in stop" requirement (OPS-02).

**Windows equivalents (`start_windows.ps1`, `stop_windows.ps1`):** translate the same idempotency checks (`docker ps --format`/`docker ps -a --format` name-grep, `docker image inspect`) into PowerShell (`docker ps --format '{{.Names}}' | Select-String`, `$LASTEXITCODE` checks) — no PowerShell analog exists in-repo; this is a direct 1:1 logic port of the bash pattern, not a new design.

---

### `.env.example` (config — new file)

**Analog:** `README.md`'s "Environment Variables" table (read this session, exact content already matches PLAN.md §5) + the local (gitignored) `.env`. Content is fully pinned — no invention needed:
```bash
# Required: OpenRouter API key for LLM chat functionality
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Optional: Massive (Polygon.io) API key for real market data
# If not set, the built-in market simulator is used (recommended for most users)
MASSIVE_API_KEY=

# Optional: Set to "true" for deterministic mock LLM responses (testing)
LLM_MOCK=false
```
Verified committable this session: `git check-ignore -v .env.example` exits 1 (not matched by `.gitignore`'s literal `.env` line).

---

### `test/package.json` + `test/package-lock.json` (config — new files)

**Analog:** `frontend/package.json` + `frontend/package-lock.json` (both read/verified tracked this session)

**Naming/shape convention to copy** (lines 1-8 of `frontend/package.json`):
```json
{
  "name": "finally-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    ...
  },
```
Apply the same shape to `test/package.json`: `"name": "finally-e2e"`, `"private": true`, a `"scripts"` block with at least `"test": "playwright test"`, and `"devDependencies": { "@playwright/test": "1.63.0" }`. This project consistently uses exact-pinned or `^`-free version strings in `package.json` (see `frontend/package.json`'s dependency block — every entry is an exact version, no `^`/`~` ranges) — match that convention for `@playwright/test` too.

**`test/package-lock.json` is a required, separately-committed deliverable** — generate it by running `npm install` once inside `test/` after authoring `package.json`, then commit the result, mirroring `frontend/package-lock.json`'s tracked status. Without it, `npm ci` in `test/docker-compose.test.yml`'s `playwright` service command fails immediately (see Critical Correction #3).

---

### `test/playwright.config.ts` (config — new file)

**Analog:** `frontend/vitest.config.ts` (read this session, full file, 19 lines) — same repo's TS test-config conventions: ESM `import`/`export default defineConfig({...})` shape.

**Convention excerpt** (`frontend/vitest.config.ts:1-19`):
```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  ...
});
```
Mirror this shape for `test/playwright.config.ts` using `@playwright/test`'s `defineConfig`, with the **hard requirement from RESEARCH.md Pitfall #6**: `workers: 1, fullyParallel: false` (all E2E specs share one stateful SQLite-backed container — no per-test isolation exists in this single-user app by design). Read `BASE_URL` from `process.env.BASE_URL` (matches `test/docker-compose.test.yml`'s `environment: BASE_URL: "http://app:8000"`).

---

### `test/e2e/*.spec.ts` (test, request-response/streaming — new files)

**Analog:** No Playwright spec precedent in-repo. Use the component `data-testid`/`data-status` attributes below as the selector contract — these are load-bearing, verified-exact strings (grepped this session across `frontend/components/`):

| Spec | Verified selectors to use |
|------|---------------------------|
| `fresh-start.spec.ts` | `header-cash`, `header-total-value` (`frontend/components/Header.tsx:35,46`); `watchlist-scroll-container`, `row-{ticker}` (`Watchlist.tsx:122`, `WatchlistRow.tsx:83`) |
| `watchlist.spec.ts` | `watchlist-add-form`, `watchlist-add-input`, `watchlist-add-submit`, `watchlist-add-error` (`Watchlist.tsx:94-117`); `remove-{ticker}` (`WatchlistRow.tsx:111`) |
| `trading.spec.ts` | `trade-bar-ticker`, `trade-bar-quantity`, `trade-bar-buy`, `trade-bar-sell`, `trade-bar-confirmation`, `trade-bar-error` (`TradeBar.tsx:90-144`) |
| `portfolio-viz.spec.ts` | `heatmap-tile-{name}` (`Heatmap.tsx:77`); `positions-scroll-container`, `position-row-{ticker}`, `positions-empty`, `positions-loading` (`PositionsTable.tsx:66-111`) |
| `chat.spec.ts` | `chat-panel`, `chat-toggle`, `chat-messages`, `chat-input`, `chat-send`, `chat-thinking`, `chat-action-pill` + its `data-status` (`"executed"`/`"failed"`, NOT connection states), `chat-error` (`ChatPanel.tsx:108-333`) |
| `sse-reconnect.spec.ts` | `page.getByRole('status')` scoped, then assert on its `data-status` attribute — **NOT** a testid, and **NOT** a bare `[data-status=...]` selector (collides in principle with chat pills) — see Critical Correction #1 (`ConnectionDot.tsx:44-48`, `Header.test.tsx:43`) |

**Style convention** (from `frontend/__tests__/ConnectionDot.test.tsx` and `frontend/__tests__/Header.test.tsx`, this project's closest "assert on rendered DOM state" precedent even though it's Vitest not Playwright): prefer attribute-selector assertions over class-string matching wherever a semantic attribute exists — this codebase deliberately exposes `data-status` as a stable contract, not just a styling hook (see `ConnectionDot.tsx`'s own comment: "exposed three ways — colour, a `data-status` attribute, and an `aria-label`"). When more than one component on the page carries the same attribute name (as `data-status` does), scope through a more specific ancestor or a co-located unique attribute (`role="status"` for the connection dot) rather than the bare attribute selector.

## Shared Patterns

### Environment-variable string-typing discipline
**Source:** `backend/app/llm/client.py:45`, `backend/app/market/factory.py:24`
**Apply to:** `test/docker-compose.test.yml`, `docker-compose.yml`, `.env.example`, both start scripts
```python
if os.environ.get("LLM_MOCK") == "true":        # exact string, not YAML/shell boolean
api_key = os.environ.get("MASSIVE_API_KEY", "").strip()   # empty string, not unset, is the "off" signal
```
Any YAML file setting these must quote boolean-looking values (`LLM_MOCK: "true"`); any `.env`-style file needs no quoting (`.env` has no type coercion).

### Path-depth invariant (container layout)
**Source:** `backend/app/db/connection.py:16-33`, `backend/app/main.py:41-51`
**Apply to:** `Dockerfile` only
Both files compute `Path(__file__).resolve().parents[N]` to find the repo root / backend dir. The image must preserve `<root>/backend/app/...` nesting under `/app/backend/app/...` — never flatten. Pin `FINALLY_DB_PATH` and `FINALLY_STATIC_DIR` as explicit `ENV` lines as a second line of defense.

### Idempotent operator scripts (never destroy the volume on stop)
**Source:** RESEARCH.md Pattern 3 (no in-repo precedent, first scripts in the project)
**Apply to:** all 4 files in `scripts/`
`stop_*` scripts must never pass `-v`/`--volumes` to any `docker` command and must never call `docker volume rm` — `finally-data` survives every `stop`/`restart` cycle by construction (OPS-02's persistence guarantee is enforced entirely by what the stop script does *not* do).

### Volume-policy divergence between production and test compose files
**Source:** `test/docker-compose.test.yml` vs `docker-compose.yml` (both new, sibling files in this phase)
**Apply to:** both compose files — document explicitly as opposite, not shared, policies
- `docker-compose.yml` (production): named, persistent volume `finally-data:/app/db`.
- `test/docker-compose.test.yml`: **no volume mount** — disposable container filesystem, because `init_db()`'s seed-only-if-empty behavior (`backend/app/db/init.py:16-24`, read in full this session, docstring quoted verbatim: "seeds the default user profile and the ten-ticker default watchlist only the first time — once `users_profile` has at least one row, seeding is skipped on every subsequent call") means a reused volume across test runs produces a stale `cash_balance`/watchlist that breaks the "fresh start: $10k" assertion on the second and all subsequent runs.

### `data-status`/`data-testid` selector contract (frontend → E2E)
**Source:** every component under `frontend/components/` (grepped this session, ~35 testids catalogued in the Pattern Assignments table above)
**Apply to:** all 6 files in `test/e2e/`
This codebase already has a comprehensive, stable `data-testid` attribute on every interactive/stateful element (buttons, inputs, rows, panels) plus a `data-status` attribute used in **two distinct, non-overlapping value spaces**: connection state (`ConnectionDot.tsx`: `connected`/`connecting`/`reconnecting`/`disconnected`, also carrying `role="status"`) and chat-action outcome (`ChatPanel.tsx`: `executed`/`failed`, no `role` attribute). E2E specs must select against these existing attributes — never invent new selector conventions, never assume a testid that hasn't been grepped and verified to exist, and scope `data-status` selectors through `role="status"` or another unique ancestor when targeting the connection dot specifically (see Critical Correction #1 — this is exactly the failure mode the RESEARCH.md `connection-status` example fell into).

## No Analog Found

Files with no close match — planner should use RESEARCH.md's Architecture Patterns / Code Examples sections directly, since those sections were already built by reading real source (path arithmetic, env-var checks) and are self-sufficient:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `Dockerfile` | config | batch | First Dockerfile in the project; RESEARCH.md Pattern 2 is a complete, repo-adapted answer (Context7-sourced official uv pattern) |
| `docker-compose.yml` | config | batch | First compose file in the project; RESEARCH.md Code Examples has the complete answer |
| `scripts/start_mac.sh`, `scripts/stop_mac.sh` | utility | event-driven | No `scripts/` directory exists yet anywhere in the repo; RESEARCH.md Pattern 3 is complete and already idempotency-correct |
| `scripts/start_windows.ps1`, `scripts/stop_windows.ps1` | utility | event-driven | No PowerShell precedent anywhere in the repo; direct logic port of the bash scripts above |
| `test/docker-compose.test.yml` | config | batch | RESEARCH.md Code Examples has the complete answer, modulo Critical Correction #3's `package-lock.json` gap |

## Metadata

**Analog search scope:** `/Users/valeriu/AICourses/finally` root, `backend/` (pyproject.toml, app/market/, app/main.py, app/db/connection.py, app/db/init.py, app/llm/client.py, tests/), `frontend/` (package.json, package-lock.json, vitest.config.ts, tsconfig.json, components/**, __tests__/**), `.gitignore`, `README.md`. No `scripts/` or configured `test/` (beyond a stray `node_modules/`) exists yet, confirmed by directory listing.
**Files scanned:** ~24 read/grepped directly this session (pyproject.toml, massive_client.py, factory.py, main.py, connection.py, init.py, test_main.py, test_massive.py, test_factory.py (grep), conftest.py, package.json ×2, vitest.config.ts, tsconfig.json, next.config.js, .gitignore, README.md, ConnectionDot.tsx, Header.tsx, ChatPanel.tsx (partial), ConnectionDot.test.tsx, Header.test.tsx (grep), ChatPanel.test.tsx (grep), ~10 component files via grep for testids)
**Pattern extraction date:** 2026-09-22

# Phase 5: One-Command Delivery - Research

**Researched:** 2026-09-22
**Domain:** Docker packaging (multi-stage Node+Python build), operator start/stop scripting, Playwright E2E infrastructure, Python dependency hygiene
**Confidence:** HIGH

## Summary

Phase 5 has almost no new application logic — `backend/app/main.py` already assembles the full FastAPI app (SSE, portfolio, watchlist, chat routers, lazy `init_db()`, static-file serving with a documented fallback chain) and already exposes two escape-hatch env vars (`FINALLY_DB_PATH`, `FINALLY_STATIC_DIR`) purpose-built for container use. What's missing is entirely infrastructure: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, four start/stop scripts, `.env.example`, and the whole `test/` E2E suite (currently just a stray `node_modules/` with no `package.json` — Playwright is installed but nothing is configured).

The single highest-leverage fact this research surfaced is a **path-depth invariant already baked into the source**: `backend/app/db/connection.py` computes its default DB path as `Path(__file__).resolve().parents[3]`, and `backend/app/main.py` computes its static-dir fallback and `.env` location the same way. Both assume the physical file layout `<root>/backend/app/...` is preserved on disk. If the Dockerfile flattens `backend/` into the image root (a common shortcut with `WORKDIR /app` + `COPY backend/ .`), these path computations silently resolve to the wrong directory (or the container filesystem root) instead of raising an error — the container would start, `/api/health` would return 200, and the bug would only surface as "my trades don't persist" or "no CSS/JS assets" days later. This is fully avoidable by (a) preserving the `backend/` subdirectory nesting under `/app` in the image, and (b) pinning both escape-hatch env vars explicitly in the Dockerfile as a second, env-var-based line of defense that survives future refactors of the `parents[N]` arithmetic.

Two other blocking gaps confirmed by direct file reads: `backend/pyproject.toml` still lists `massive` and `rich` as **unconditional core dependencies**, and `backend/app/market/massive_client.py` imports `massive` at module scope — meaning even a simulator-only container (no `MASSIVE_API_KEY`) requires the Polygon SDK to be installed, contradicting the "zero external dependencies by default" design goal and bloating the image. The fix is a lazy import inside `MassiveDataSource`, not an optional-dependency extra — `massive` must stay in core deps so a container that *does* get a `MASSIVE_API_KEY` at runtime doesn't ImportError (it wasn't present at `uv sync` time if extras are excluded, per PLAN.md §5's env-var-driven, no-rebuild-required behavior).

**Primary recommendation:** Preserve the `backend/` and `frontend/` directory structure inside the image exactly as it exists in the repo, pin `FINALLY_DB_PATH=/app/db/finally.db` and `FINALLY_STATIC_DIR=/app/backend/static` as explicit Dockerfile `ENV` lines (belt-and-suspenders on top of the working default resolution), fix only the `massive` lazy-import (leave it a core dependency), move only `rich` to an optional extra, and build a `.dockerignore` before the first `docker build` — its absence is a build-breaker (host `node_modules`/`.venv` are native-compiled for macOS and will crash a Linux container build if copied in), not just an image-bloat issue.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frontend static asset build | CDN / Static (build-time) | Browser | `next build` with `output: "export"` produces pure static HTML/CSS/JS served by FastAPI's `StaticFiles` — no SSR tier exists in this app |
| Frontend serving at runtime | API / Backend | — | `StaticFiles(directory=..., html=True)` mounted on the same FastAPI process — single-port design per PLAN.md §3, no separate static-file server |
| Container image assembly | Build tooling (Docker) | — | Multi-stage build: Node stage produces static assets, Python stage installs the app and receives those assets as a `COPY --from=` |
| Database file location & init | API / Backend | Database / Storage | `init_db()` runs inside FastAPI's `lifespan` (in-process), writes to a path resolved via `FINALLY_DB_PATH`/directory arithmetic — no separate DB server or init container |
| Process lifecycle (start/stop, restart safety) | Host / Docker CLI (scripts) | — | `scripts/start_*`/`stop_*` wrap `docker run`/`docker start`/`docker stop` — no in-app supervisor needed for a single container |
| Data persistence across restarts | Database / Storage (named volume) | — | A Docker named volume mounted at `/app/db` — the only tier where "no auth = no multi-user = no DB server" (PLAN.md §3) leaves persistence as pure filesystem state |
| E2E test orchestration | Build tooling (docker-compose) | Browser (Playwright) | `test/docker-compose.test.yml` runs the real container plus a Playwright container against it — validates the packaged artifact, not source code directly |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Operator can start the full application with a single Docker command (or provided start/stop script) and reach it at `http://localhost:8000` | Dockerfile layout (Architecture Patterns §1), idempotent start/stop scripts (Code Examples), `.env.example` deliverable, Environment Availability confirms Docker/Compose present on this dev machine |
| OPS-02 | Operator's portfolio, watchlist, and trade history persist across container restarts via a volume-mounted SQLite database | Named-volume + non-root ownership pattern (Common Pitfalls #1), `FINALLY_DB_PATH` pin (Architecture Patterns §1), `init_db()`'s idempotent seed-only-if-empty behavior already verified in `backend/app/db/init.py` |
</phase_requirements>

## Standard Stack

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|---------------|
| `node:20-slim` (Docker base image) | Node 20.x LTS | Stage 1 build image for the Next.js static export | PLAN.md §11 names "Node 20 slim" explicitly; Next.js 16.3.5 (already in `frontend/package.json`) requires Node ≥20.9.0 — `[CITED: nextjs.org/blog/next-16]`, table: "**Node.js 20.9+** \| Minimum version now 20.9.0 (LTS); Node.js 18 no longer supported" |
| `ghcr.io/astral-sh/uv:python3.12-trixie-slim` (Docker base image) | uv-bundled Python 3.12, Debian trixie | Stage 2 build+runtime image for the FastAPI backend | Matches PLAN.md §11's "Python 3.12 slim / Install uv / uv sync"; `[VERIFIED: backend/pyproject.toml:6]` — `requires-python = ">=3.12"`; official uv Docker pattern per Context7 `/astral-sh/uv-docker-example` — `[CITED: github.com/astral-sh/uv-docker-example]` |
| `docker compose` | v5.5.1 (host-verified) | Optional convenience wrapper (root `docker-compose.yml`) and the E2E test harness (`test/docker-compose.test.yml`) | `[VERIFIED: docker compose version` run this session on the dev machine`]` |
| `@playwright/test` | 1.63.0 | E2E test runner | `[VERIFIED: npm registry` — `npm view @playwright/test version` this session`]`; package name is training-data knowledge and the project already has `test/node_modules/playwright*` on disk from a prior `npm install` — see Package Legitimacy Audit below for the `SUS` verdict and why it's a false positive |
| `mcr.microsoft.com/playwright:v1.63.0-noble` (Docker image, E2E only) | Matches installed `@playwright/test` 1.63.0 | Browser runtime container for `test/docker-compose.test.yml` | `[CITED: playwright.dev/docs/docker]` — fetched directly this session: `docker run -it --rm --ipc=host mcr.microsoft.com/playwright:v1.63.0-noble`. Tag pinned to the exact npm version to avoid bundled-browser/test-runner skew (also-available `-jammy`/`-resolute` tags are alternate base OSes, not versions — noble/Ubuntu 24.04 LTS is the primary recommended tag) |

### Supporting
| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `python-dotenv` | already in `pyproject.toml` (`>=1.2.1`) | Loads `.env` for local dev; no-ops in the container since `.env` is never copied into the image | Already wired in `main.py:51` — no change needed |
| Docker `HEALTHCHECK` | Dockerfile instruction | Container health signal for `docker-compose.test.yml`'s `depends_on: condition: service_healthy` and for operators running `docker ps` | Use a Python one-liner (`urllib.request.urlopen`) rather than adding `curl` — the slim/uv images do not ship `curl`, and adding it just for a healthcheck grows the image for no functional benefit |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 2-stage Dockerfile (uv stays in final image) | 3-stage (build with uv, copy `.venv` into a bare `python:3.12-slim` final stage) | Smaller final image (no uv binary), but PLAN.md §11 explicitly specifies a 2-stage build ("Stage 1... Stage 2..."); adding a 3rd stage is an unrequested deviation from a locked spec section — not recommended unless the user asks for image-size optimization later |
| `mcr.microsoft.com/playwright` container for E2E | Install Playwright + browsers directly in a CI-style Node stage | Official Playwright image is pre-baked with matching browser binaries at a pinned version and is the documented pattern for "test against a container" — avoids browser-download flakiness in CI |
| Named Docker volume for `db/` | Bind mount (`./db:/app/db`) | PLAN.md §11 explicitly specifies a named volume (`docker run -v finally-data:/app/db ...`); a bind mount would also work but changes the documented `docker run` command and start-script UX — not recommended, stick to the locked spec |

**Installation:** No new Python/Node packages need to be added to `pyproject.toml`/`package.json` for the application itself. The only new file-based dependency is `test/package.json` (new) declaring `@playwright/test` as a devDependency, installed via `npm install` inside `test/`.

**Version verification:** `npm view @playwright/test version` → `1.63.0` (ran this session, npm registry). `node --version` → `v24.21.0` on the dev host (irrelevant to the container — the container always builds against whatever `node:20-slim` resolves to at build time, verified ≥20.9.0 compatible with the pinned Next.js 16.3.5).

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|-----------|--------------|---------|-------------|
| `@playwright/test` | npm | Published 2026-09-04 (very recent minor/patch release) | 44,409,707/week | `github.com/microsoft/playwright` | SUS | **Flagged, but false positive** — the `too-new` signal is measuring latest-*release*-date, not package age; 44M weekly downloads and the official Microsoft repo make this unambiguously legitimate. Planner must still insert a `checkpoint:human-verify` before `npm install @playwright/test` per protocol, but it should resolve in seconds. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@playwright/test` (see note above — legitimate, checkpoint is procedural only).

No other new external packages are introduced by this phase's scope. `massive` and `rich` are existing dependencies being reorganized (lazy-import / extras), not new additions — see Common Pitfalls #4 for the exact fix.

## Architecture Patterns

### System Architecture Diagram

```
Host machine                                          Docker daemon
┌──────────────────────────┐                    ┌────────────────────────────────────┐
│ operator runs:            │                    │  image "finally" (2-stage build)    │
│ scripts/start_mac.sh       │──docker build────▶│                                      │
│  (idempotent: build if     │                    │  Stage 1: node:20-slim               │
│   missing, start/create    │                    │    COPY frontend/ → npm ci → build   │
│   container if not running)│                    │    produces: /build/frontend/out/    │
└──────────────────────────┘                    │              │                       │
              │ docker run -d                     │              ▼ COPY --from=          │
              │  -v finally-data:/app/db          │  Stage 2: ghcr.io/astral-sh/uv:...   │
              │  -p 8000:8000 --env-file .env     │    /app/backend/  (pyproject, uv.lock,│
              ▼                                    │      app/, static/ ← frontend build) │
┌──────────────────────────┐                    │    RUN uv sync --locked               │
│ browser: localhost:8000   │◀───HTTP:8000───────│    USER nonroot                       │
│  GET /            (SPA)    │                    │    CMD uvicorn app.main:app            │
│  GET /api/*        (REST)  │                    │      --host 0.0.0.0 --port 8000       │
│  GET /api/stream/prices    │                    │                                      │
│  (SSE, EventSource)        │                    │  on boot (FastAPI lifespan):          │
└──────────────────────────┘                    │   1. init_db() — idempotent create+seed│
                                                   │   2. market source .start(tickers)    │
                                                   │   3. snapshot_loop() background task   │
                                                   │                                      │
                                                   │  named volume "finally-data"          │
                                                   │    mounted at /app/db  ──────────────▶│  db/finally.db (SQLite, WAL mode)
                                                   │    (survives `docker stop`/`rm`;      │     persists across container restarts
                                                   │     only `docker volume rm` destroys) │
                                                   └────────────────────────────────────┘

test/docker-compose.test.yml (separate flow, not part of production path):
┌───────────────────┐   depends_on: service_healthy   ┌──────────────────────────────┐
│ app (built from    │◀────────────────────────────────│ playwright                   │
│  repo root          │                                  │ (mcr.microsoft.com/playwright│
│  Dockerfile,         │───HTTP:8000 (docker network)───▶│  :v1.63.0-noble)              │
│  LLM_MOCK: "true",   │                                  │  npx playwright test          │
│  disposable volume)  │                                  │  BASE_URL=http://app:8000     │
└───────────────────┘                                  └──────────────────────────────┘
```

### Recommended Project Structure
```
finally/
├── Dockerfile                    # 2-stage: node:20-slim → uv:python3.12-trixie-slim
├── .dockerignore                 # NEW — see Common Pitfalls #1, build-breaker if missing
├── docker-compose.yml             # optional convenience wrapper (build+run+volume in one command)
├── .env.example                   # NEW — OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK
├── scripts/
│   ├── start_mac.sh                # idempotent: build-if-missing, start/create container
│   ├── stop_mac.sh                 # idempotent: stop+rm container, NEVER touch the volume
│   ├── start_windows.ps1           # PowerShell equivalent
│   └── stop_windows.ps1            # PowerShell equivalent
└── test/
    ├── package.json                 # NEW — @playwright/test devDependency
    ├── playwright.config.ts         # NEW — workers: 1, fullyParallel: false (see Pitfall #5)
    ├── docker-compose.test.yml      # NEW — app (LLM_MOCK=true, disposable volume) + playwright
    └── e2e/
        ├── fresh-start.spec.ts       # default watchlist, $10k, prices streaming
        ├── watchlist.spec.ts         # add/remove ticker
        ├── trading.spec.ts           # buy, sell
        ├── portfolio-viz.spec.ts     # heatmap colors, P&L chart has points
        ├── chat.spec.ts              # mocked LLM response, inline trade confirmation
        └── sse-reconnect.spec.ts     # setOffline(true) → amber/red dot → setOffline(false) → green
```

### Pattern 1: Preserve directory nesting so path-arithmetic resolves correctly
**What:** The image must place the backend project at `/app/backend/` (not flattened to `/app/`), so that `Path(__file__).resolve().parents[N]` computations inside the existing source resolve to `/app` as the container's "repo root" equivalent.
**When to use:** Every `COPY backend/ ...` instruction in the Dockerfile.
**Why this is load-bearing (verified, not inferred):**

`backend/app/db/connection.py:16-33` (read this session):
```python
DB_PATH_ENV_VAR = "FINALLY_DB_PATH"

_REPO_ROOT = Path(__file__).resolve().parents[3]

def get_db_path() -> Path:
    """Resolve the SQLite database file path.

    Resolution order:
      1. `FINALLY_DB_PATH` env var, if set and non-empty (stripped, expanded).
      2. `<repo_root>/db/finally.db` — the Docker volume mount target
         PLAN.md section 11 describes.
    """
    env_value = os.environ.get(DB_PATH_ENV_VAR, "").strip()
    if env_value:
        return Path(env_value).expanduser()
    return _REPO_ROOT / "db" / "finally.db"
```
`[VERIFIED: backend/app/db/connection.py:16-33]` — for this to yield `/app/db/finally.db`, the file must physically sit at `/app/backend/app/db/connection.py` (`parents[0]`=db, `[1]`=app, `[2]`=backend, `[3]`=`/app`).

`backend/app/main.py:41-51` (read this session):
```python
STATIC_DIR_ENV_VAR = "FINALLY_STATIC_DIR"

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(_REPO_ROOT / ".env")
```
`[VERIFIED: backend/app/main.py:41-51]` — for `_BACKEND_DIR` to equal `/app/backend` (so `resolve_static_dir()`'s `backend_static = _BACKEND_DIR / "static"` becomes `/app/backend/static`), `main.py` must physically sit at `/app/backend/app/main.py`.

**Recommended action (belt-and-suspenders):** Pin both escape hatches explicitly as Dockerfile `ENV` lines rather than relying solely on the path arithmetic — this makes the container's correctness self-evident in the Dockerfile itself and immune to any future refactor of the `parents[N]` depth:
```dockerfile
ENV FINALLY_DB_PATH=/app/db/finally.db
ENV FINALLY_STATIC_DIR=/app/backend/static
```

### Pattern 2: uv multi-stage build with bind-mounted lockfile (official pattern)
**What:** Install dependencies from `uv.lock` before copying source, so dependency layers cache independently of source-code changes.
**When to use:** Stage 2 of the Dockerfile.
**Example (adapted from the official example, paths adjusted for this repo's nested layout):**
```dockerfile
# Source: Context7 /astral-sh/uv-docker-example, Dockerfile — adapted for backend/ nesting
FROM ghcr.io/astral-sh/uv:python3.12-trixie-slim
RUN groupadd --system --gid 999 nonroot \
 && useradd --system --gid 999 --uid 999 --create-home nonroot
WORKDIR /app
ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1

COPY backend/pyproject.toml backend/uv.lock /app/backend/
RUN --mount=type=cache,target=/root/.cache/uv \
    cd /app/backend && uv sync --locked --no-install-project

COPY backend/ /app/backend/
COPY --from=frontend-builder /build/frontend/out /app/backend/static
RUN test -f /app/backend/static/index.html   # build-time assertion, see Pitfall #2
RUN --mount=type=cache,target=/root/.cache/uv \
    cd /app/backend && uv sync --locked

RUN mkdir -p /app/db && chown -R nonroot:nonroot /app/db /app/backend
ENV PATH="/app/backend/.venv/bin:$PATH"
ENV FINALLY_DB_PATH=/app/db/finally.db
ENV FINALLY_STATIC_DIR=/app/backend/static
USER nonroot
WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Pattern 3: Idempotent start/stop scripts
**What:** `docker ps`/`docker ps -a` name checks before `run`/`start`/`stop`/`rm`, so re-running never errors or creates duplicates.
**When to use:** All four scripts in `scripts/`.
**Example:**
```bash
#!/usr/bin/env bash
set -euo pipefail
CONTAINER_NAME="finally"
IMAGE_NAME="finally"
VOLUME_NAME="finally-data"
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker build -t "$IMAGE_NAME" .
fi

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "FinAlly is already running at http://localhost:8000"
  exit 0
elif docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker start "$CONTAINER_NAME" >/dev/null
else
  docker run -d --name "$CONTAINER_NAME" \
    -v "$VOLUME_NAME":/app/db \
    -p 8000:8000 --env-file .env "$IMAGE_NAME" >/dev/null
fi
echo "FinAlly running at http://localhost:8000"
```
```bash
#!/usr/bin/env bash
set -euo pipefail
CONTAINER_NAME="finally"
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
  echo "FinAlly stopped."
else
  echo "FinAlly is not running."
fi
# Deliberately never touches the "finally-data" volume — OPS-02 requires
# stopping to never destroy persisted data.
```

### Anti-Patterns to Avoid
- **Flattening `backend/` into the image root:** Breaks the `parents[N]` path arithmetic silently — see Pattern 1. The container starts and `/api/health` passes; only DB persistence or static serving fails, invisibly.
- **Copying host `node_modules`/`.venv` into the image:** `backend/.venv/pyvenv.cfg` confirms the local venv targets `cpython-3.13.9-macos-aarch64` `[VERIFIED: backend/.venv/pyvenv.cfg]` — copying it into a Linux container breaks `uv sync`/runtime. Requires a `.dockerignore`, not a Dockerfile-level fix (see Common Pitfalls #1).
- **Using `docker-compose down -v` semantics in the stop script:** The stop script must never pass `-v`/`--volumes` or call `docker volume rm` — that would destroy persisted data on every stop, violating OPS-02's success criterion 3.
- **3-stage "uv-less final image" optimization:** Technically smaller, but PLAN.md §11 specifies exactly 2 stages. Don't add an unrequested 3rd stage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Container health signaling | Custom TCP-port-open check script | Docker's built-in `HEALTHCHECK` instruction + `docker-compose`'s `condition: service_healthy` | Native Docker/Compose feature; a custom script duplicates functionality Docker already provides and integrates with `depends_on` |
| Browser automation for E2E | Selenium / custom Puppeteer scripts | `@playwright/test` (already partially installed in `test/`) | Already the project's chosen tool per PLAN.md §12 ("Playwright E2E tests"); has first-class `EventSource`/network-condition mocking (`page.context().setOffline()`) needed for the SSE-reconnect scenario |
| Static file serving | Custom FastAPI route walking the filesystem | `starlette.staticfiles.StaticFiles(html=True)` | Already implemented and comment-verified in `main.py:139-146`: "`StaticFiles(html=True)` already normalises and rejects path traversal (verified against the installed starlette.staticfiles source) — do not hand-write a competing file-serving route" `[VERIFIED: backend/app/main.py:139-146]` |
| Volume permission fixing at runtime | An entrypoint script that `chown`s `/app/db` on every container start | `chown` once at image-build time (before `USER nonroot`), relying on Docker's volume-init-from-image-directory behavior | Simpler, no extra entrypoint layer; see Common Pitfalls #6 for the one caveat (only applies to a *fresh* named volume) |

**Key insight:** This phase is 100% packaging/tooling, not application logic — the temptation to hand-roll is low, but the two real traps (path-depth arithmetic, volume permissions) are both "invisible until someone hits them" classes of bug, which is why they're called out explicitly above rather than left to be discovered during E2E testing.

## Common Pitfalls

### Pitfall 1: Missing `.dockerignore` breaks the build, not just bloats the image
**What goes wrong:** `COPY frontend/ ./` (after `npm ci`) overwrites the image's freshly-installed linux-native `node_modules` with the host's `frontend/node_modules`, which contains macOS/darwin-arm64-compiled native addons (`@next/swc-darwin-arm64`, `@tailwindcss/oxide`, `lightningcss`). `npm run build` then fails inside the Linux container with a native-binding load error. The same class of bug applies to `backend/.venv` landing at `/app/backend/.venv` before `uv sync` runs — `[VERIFIED: backend/.venv/pyvenv.cfg]` confirms it targets `cpython-3.13.9-macos-aarch64`. Additionally, without a `.dockerignore`, `db/finally.db` (if it exists locally) and `.env` become baked-in image layers — a real secrets-in-image risk under the Security Domain's ASVS V14 concern.
**Why it happens:** Docker's `COPY` has no default exclusion list; everything not explicitly ignored gets sent to the build context and is copyable.
**How to avoid:** Ship a `.dockerignore` as an explicit phase deliverable before the first `docker build` is attempted:
```
**/node_modules
backend/.venv
frontend/.next
frontend/out
frontend/tsconfig.tsbuildinfo
.git
.env
db/*.db
db/*.db-wal
db/*.db-shm
db/*.db-journal
test/node_modules
.planning
**/__pycache__
```
**Warning signs:** `docker build` fails with a native module load error inside `npm run build`, or `uv sync` complains about an interpreter mismatch, or the built image is unexpectedly large (`docker image ls`).

### Pitfall 2: A missing/broken UI still reports "healthy"
**What goes wrong:** `resolve_static_dir()` in `main.py` falls back to `None` and merely logs a warning if no static directory is found (`backend/app/main.py:147-152`, verified this session: "Static export directory not found... — API-only mode"). `/api/health` still returns `{"status": "ok"}` regardless. A botched `COPY --from=frontend-builder` (wrong path, empty `out/`) produces a container that passes `HEALTHCHECK` and `docker ps` shows "healthy" while serving zero UI — success criterion 1 ("reaches the complete, working application") then only fails when a human opens a browser.
**Why it happens:** The health endpoint was designed (correctly, for Phase 1-4 dev iteration) to be decoupled from static-file availability.
**How to avoid:** Add a build-time assertion in the Dockerfile right after the static-asset `COPY`: `RUN test -f /app/backend/static/index.html` — fails the `docker build` itself, not just a later smoke test. Additionally, the plan's own verification step for OPS-01 should `curl -f http://localhost:8000/` and assert HTML content-type, not just hit `/api/health`.
**Warning signs:** `docker build` succeeds, `docker run` succeeds, `/api/health` returns 200, but `http://localhost:8000/` returns a JSON 404 or an empty response.

### Pitfall 3: `docker run -v name:/path` on a non-root final image needs the mount point pre-owned in the image
**What goes wrong:** Docker initializes a **new, empty** named volume by copying the contents *and ownership* of the image directory at the mount point. If `/app/db` is created (or left to be auto-created at runtime) while still owned by `root` and the container then drops to `USER nonroot`, the app's own `db_path.parent.mkdir(parents=True, exist_ok=True)` (`backend/app/db/connection.py:46`) or the SQLite `CONNECT`/`WAL` file creation fails with a permission error on first write.
**Why it happens:** Default Docker behavior is root-owned volume initialization; a non-root `USER` in the final image doesn't automatically get write access.
**How to avoid:** In the Dockerfile, `RUN mkdir -p /app/db && chown -R nonroot:nonroot /app/db` **before** the `USER nonroot` instruction, so the image's directory (which Docker copies into the fresh volume) is already correctly owned. This is a general, well-documented Docker pattern (image-directory ownership seeds new-volume ownership) — `[ASSUMED]`, not independently verified against a primary `docs.docker.com` page this session; flagged in the Assumptions Log because it rests on general web knowledge (multiple third-party sources) rather than a fetched official-docs citation. It matches this project's specific test scenario correctly regardless (a fresh checkout + fresh named volume, per OPS-01/OPS-02's stated success criteria), so the risk if wrong is low for the grading path but should be spot-checked by whoever executes the plan.
**Important caveat:** This ownership-seeding only applies to a **brand-new** volume. If a container was ever run as root against `finally-data` before this fix lands, the volume keeps root ownership permanently — `docker volume rm finally-data` (destroying test data, safe in dev) is the only reset. Document this as a recovery step, not a runtime auto-fix.
**Warning signs:** Container logs show `sqlite3.OperationalError: unable to open database file` or `PermissionError` on first run after switching to a non-root user in an existing Dockerfile.

### Pitfall 4: Conflating "lazy import" with "optional dependency" breaks the `MASSIVE_API_KEY` path
**What goes wrong:** `backend/app/market/massive_client.py:1-9` imports `massive` at module scope (`from massive import RESTClient`), and `backend/app/market/factory.py` imports `MassiveDataSource` unconditionally at module scope too — so even a simulator-only container requires the `massive` package to be *installed*, not just importable-when-needed. The scope note's "restore the lazy `massive` import" fix is correct, but if the fix is implemented as *removing `massive` from core dependencies* (moving it to an extra) while the Dockerfile runs `UV_NO_DEV=1 uv sync --locked`, then a container that legitimately receives `MASSIVE_API_KEY` at `docker run` time (no rebuild, per PLAN.md §5's env-var-driven design) will `ImportError` at first price-fetch — a regression, not a fix.
**Why it happens:** "Lazy import" (defer `import massive` to inside `MassiveDataSource.__init__`/`start()`, guarded by `TYPE_CHECKING` for type hints) and "optional dependency" (move the package out of `dependencies = [...]` into `[project.optional-dependencies]`) are two independent changes that are easy to bundle under one "dependency hygiene" umbrella task.
**How to avoid:** Make **only** the import lazy — keep `massive` in `pyproject.toml`'s core `dependencies` list (it's already pinned and in `uv.lock`; no `uv add`/`uv remove` needed for `massive`, only a code change in `massive_client.py`/`factory.py`). Move **only `rich`** to an optional extra (e.g. `[project.optional-dependencies] demo = ["rich>=13.0.0"]`) — confirmed via `grep` this session that `rich` is imported exclusively by `backend/market_data_demo.py`, a dev-only terminal demo not part of the production app (`[VERIFIED: grep -rln "^import rich\|from rich" backend --include="*.py"` → only `market_data_demo.py`]`). After editing `pyproject.toml`, the task must run `uv lock` and commit the updated `uv.lock` — otherwise `uv sync --locked` in the Docker build fails with a lockfile-mismatch error, not a helpful "you forgot to lock" message. Confirm `market_data_demo.py` is expected to break without the demo extra (`uv run --extra demo market_data_demo.py` becomes the new invocation) — nobody should "fix" this by re-adding `rich` to core deps.
**Warning signs:** `ImportError: No module named 'massive'` in a container that has `MASSIVE_API_KEY` set — indicates the dependency was wrongly made optional. `uv sync --locked` failing in the Docker build with a lock-mismatch error — indicates `pyproject.toml` was edited without a corresponding `uv lock`.

### Pitfall 5: Production and E2E-test volume policies must be opposite, and conflating them breaks one of them
**What goes wrong:** OPS-02's success criterion 3 requires the **production** named volume (`finally-data`) to survive `docker stop`/restart — trades, watchlist, chat history must persist. But the E2E test compose file (`test/docker-compose.test.yml`) must use a **disposable** volume (or none, letting SQLite live in the container's writable layer) — because `init_db()` only seeds default data "the first time... once `users_profile` has at least one row, seeding is skipped on every subsequent call" (`[VERIFIED: backend/app/db/init.py:16-24]`, docstring quoted verbatim). If the E2E test container reuses a persistent volume across `docker-compose` runs, the "fresh start: default watchlist, $10k cash" scenario passes once and then fails on every subsequent test run, because a prior test's buy/sell mutated `cash_balance` and the (correct, by-design) idempotent seeding logic won't reset it.
**Why it happens:** It's natural to reuse the same Dockerfile/volume pattern for both production and test compose files; the two have genuinely opposite persistence requirements.
**How to avoid:** State both policies explicitly and separately in the plan: production `docker-compose.yml` uses a named, persistent volume (`finally-data`); `test/docker-compose.test.yml` uses either no volume mount (ephemeral container filesystem, wiped on `docker-compose down`) or an explicitly test-scoped volume that the test harness removes before each run (`docker-compose down -v` as part of the test setup script, never in the production stop script).
**Warning signs:** E2E "fresh start" test passes locally on first run, fails on CI re-runs or local re-runs without a manual `docker volume rm`.

### Pitfall 6: Default Playwright parallelism races multiple specs against one SQLite file
**What goes wrong:** Playwright's default config runs specs in parallel across multiple workers. Multiple E2E specs (buy, sell, watchlist add/remove, fresh-state assertions) hitting the *same* running app container mean they share one SQLite database and one `PriceCache` — a "sell" spec running concurrently with a "fresh start: $10k" assertion will see inconsistent state, causing flaky or outright wrong failures unrelated to real bugs.
**Why it happens:** Playwright's parallelism defaults are tuned for independent, stateless page loads — not appropriate when all specs share one stateful backend container with no per-test isolation (no auth/multi-tenancy in this app by design).
**How to avoid:** Set `workers: 1` and `fullyParallel: false` in `playwright.config.ts` so specs run sequentially against the single shared app container. This is a hard requirement for this project's architecture, not a performance tuning suggestion.
**Warning signs:** E2E suite is flaky — same spec passes/fails nondeterministically across runs, or cash-balance/position assertions are off by exactly one trade's worth of value.

### Pitfall 7: `LLM_MOCK` and `MASSIVE_API_KEY` are exact-string / presence checks — YAML typing matters
**What goes wrong:** `backend/app/llm/client.py:45` checks `if os.environ.get("LLM_MOCK") == "true":` — an exact string comparison, verified this session. In a `docker-compose.test.yml` YAML file, writing `LLM_MOCK: true` (unquoted) is parsed as a YAML boolean and gets passed to the container as the environment-variable string `"True"` or `"1"` depending on the compose implementation's boolean-to-string conversion — **not** the literal string `"true"` — silently disabling mock mode and making E2E tests attempt real (costly, non-deterministic) OpenRouter calls.
Separately, `backend/app/market/factory.py:24` does `os.environ.get("MASSIVE_API_KEY", "").strip()` — an **empty string** (`MASSIVE_API_KEY=` with nothing after the `=`, which is exactly what `.env.example` should ship) correctly falls through to the simulator, satisfying success criterion 4 (`[VERIFIED: backend/app/market/factory.py:19-24]`).
**Why it happens:** YAML's implicit typing of bare `true`/`false` as booleans is a well-known footgun distinct from Docker/shell environment variables, which are always strings.
**How to avoid:** Always quote boolean-looking env values in compose files: `LLM_MOCK: "true"`. For `.env` and `--env-file` usage (not YAML), `LLM_MOCK=true` is fine as-is since `.env` files have no YAML type coercion.
**Warning signs:** E2E tests under `LLM_MOCK=true` (intended) make real network calls to OpenRouter, or fail with an auth error because `OPENROUTER_API_KEY` wasn't set for the test environment.

## Code Examples

### `.env.example` (new file, root of repo)
```bash
# Source: PLAN.md §5, cross-checked against README.md's already-documented table
# Required: OpenRouter API key for LLM chat functionality
OPENROUTER_API_KEY=your-openrouter-api-key-here

# Optional: Massive (Polygon.io) API key for real market data
# If not set, the built-in market simulator is used (recommended for most users)
MASSIVE_API_KEY=

# Optional: Set to "true" for deterministic mock LLM responses (testing)
LLM_MOCK=false
```
`[VERIFIED: git check-ignore -v .env.example` exits 1 this session — `.env.example` is NOT matched by `.gitignore`'s literal `.env` entry (line 138) and is safely committable.]`

### `docker-compose.yml` (optional convenience wrapper, root of repo)
```yaml
# Source: PLAN.md §11's docker run command, translated to compose
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - finally-data:/app/db
    env_file:
      - .env
volumes:
  finally-data:
```

### `test/docker-compose.test.yml` (new — disposable volume, mocked LLM)
```yaml
services:
  app:
    build:
      context: ..
      dockerfile: Dockerfile
    environment:
      LLM_MOCK: "true"          # quoted — see Common Pitfalls #7
      OPENROUTER_API_KEY: "unused-under-mock"
    # No named volume — container filesystem is disposable per-run.
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    expose:
      - "8000"

  playwright:
    image: mcr.microsoft.com/playwright:v1.63.0-noble
    depends_on:
      app:
        condition: service_healthy
    working_dir: /tests
    volumes:
      - ../test:/tests
    environment:
      BASE_URL: "http://app:8000"
    command: sh -c "npm ci && npx playwright test"
```

### SSE reconnect E2E pattern
```typescript
// Source: Playwright's documented network-condition API (page.context().setOffline)
import { test, expect } from '@playwright/test';

test('SSE reconnects after network drop', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('connection-status')).toHaveClass(/green/);

  await page.context().setOffline(true);
  await expect(page.getByTestId('connection-status')).toHaveClass(/amber|red/);

  await page.context().setOffline(false);
  await expect(page.getByTestId('connection-status')).toHaveClass(/green/, { timeout: 10_000 });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `pip install` + `requirements.txt` for Python deployment | `uv sync --locked` against `uv.lock` inside Docker | Project-established (uv already chosen in Phase 1-4) | Reproducible, fast Docker builds; no change needed, already the project's tooling |
| WebSockets for one-way price push | SSE (`EventSource`) | Locked in PLAN.md §3 | Not a Phase 5 concern — already implemented; relevant only in that the E2E reconnect test must exercise `EventSource`'s native auto-retry, not a custom reconnect handler |

**Deprecated/outdated:** None specific to this phase — the stack (Docker, uv, Next.js static export, Playwright) is current as of this research date.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Docker initializes a brand-new named volume by copying the image directory's contents and ownership at the mount point (general Docker behavior, sourced from third-party web posts, not a fetched `docs.docker.com` page) | Common Pitfalls #3 | If Docker's actual behavior differs in some version/driver combination, the `chown`-before-`USER` fix in the Dockerfile may not prevent the permission error, and the executor would need to fall back to an entrypoint-script `chown` (slightly less clean but strictly more robust) — low risk since the claim matches widely-reported behavior and this project's specific test scenario (fresh checkout, fresh volume) |

**If this table has one row:** all other claims in this research were verified via direct file reads (`Read` tool, quoted verbatim), direct tool checks (`npm view`, `git check-ignore`, `docker compose version`), or fetched official documentation (Context7 `/astral-sh/uv-docker-example`, `nextjs.org/blog/next-16`, `playwright.dev/docs/docker`) — no user confirmation needed for those. A1 is worth a quick spot-check during execution but is not a blocking unknown.

## Open Questions

1. **Should `config.json`'s `test_command` be updated to include the E2E suite?**
   - What we know: `.planning/config.json`'s `workflow.test_command` is currently `"(cd backend && uv run pytest -q) && (cd frontend && npm test)"` — it does not invoke the new `test/docker-compose.test.yml` E2E suite.
   - What's unclear: Whether the planner should add an E2E step to this command (which would make every `/gsd-verify-work` or quick-task test run spin up Docker, slow) or leave E2E as a separate, phase-gate-only step.
   - Recommendation: Leave `test_command` as the fast unit/component check; treat the Playwright suite as a phase-completion gate the planner adds as an explicit task/checkpoint, not part of the routine `test_command`.

2. **Does OPS-01/OPS-02 need automated coverage beyond the E2E suite, or is a documented manual verification sequence acceptable?**
   - What we know: OPS-01 and OPS-02 describe operator-facing, container-lifecycle behavior (build → run → restart → verify persistence) that no `pytest`/`vitest` unit test can meaningfully cover — a unit test mocking the container layer would pass while the real Docker path is broken.
   - What's unclear: Whether the Playwright E2E suite (which runs *inside* `docker-compose.test.yml`, i.e. already against a real built container) is sufficient, or whether the plan should additionally specify a manual/scripted verification sequence (`docker build` → `start_mac.sh` → trade → `stop_mac.sh` → `start_mac.sh` → assert persisted state) as a `checkpoint:human-verify` task.
   - Recommendation: Use the Playwright suite as the automated backstop for OPS-01 (it already runs against a real container), but add an explicit manual verification task for OPS-02's restart-persistence claim specifically — the E2E suite's ephemeral test container (Pitfall #5) does not exercise restart persistence at all, since it never stops/restarts the app mid-suite.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Docker | OPS-01, OPS-02 (all of Phase 5) | ✓ | 29.8.0 | — |
| Docker Compose | Optional `docker-compose.yml`, `test/docker-compose.test.yml` | ✓ | v5.5.1 | — |
| Node.js (host) | Not required for the Docker path — only if executing `npm run build` locally to sanity-check the frontend before packaging | ✓ | v24.21.0 | Container build always uses `node:20-slim`, independent of host Node version |
| uv (host) | Not required for the Docker path — only for local backend iteration | not probed this session | — | Container build uses `ghcr.io/astral-sh/uv:...`, independent of host uv |

**Missing dependencies with no fallback:** none — Docker and Docker Compose, the only hard requirements for this phase, are both present on the development machine.

**Missing dependencies with fallback:** none applicable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.63.0 (new — `test/` currently has no `package.json`, only a stray `node_modules/`) |
| Config file | `test/playwright.config.ts` (new) |
| Quick run command | `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit` |
| Full suite command | Same — this phase has one E2E suite, no separate "quick" subset |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|---------------|
| OPS-01 | Clean checkout + `.env` → start script/`docker run` → app reachable at `localhost:8000` | E2E (container-level) + manual | `docker compose -f test/docker-compose.test.yml up --build` (fresh-start spec asserts default watchlist + $10k visible) | ❌ Wave 0 — `test/docker-compose.test.yml`, `test/e2e/fresh-start.spec.ts` don't exist yet |
| OPS-02 | Trades/watchlist/chat persist across container restart | Manual / scripted verification (see Open Question 2) — **not covered by the E2E suite's ephemeral container** | `./scripts/start_mac.sh && <make a trade> && ./scripts/stop_mac.sh && ./scripts/start_mac.sh && <assert trade still present>` | ❌ Wave 0 — no automated equivalent exists; plan must add a `checkpoint:human-verify` task or a dedicated shell-script-based restart test |

### Sampling Rate
- **Per task commit:** For Dockerfile/script changes, `docker build` (fast fail on layout/lockfile errors) — no full E2E run per commit, too slow.
- **Per wave merge:** Full `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit`.
- **Phase gate:** Full E2E suite green **and** the manual OPS-02 restart-persistence sequence confirmed, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `.dockerignore` — build-breaker if absent (Common Pitfalls #1)
- [ ] `Dockerfile` — does not exist yet
- [ ] `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_windows.ps1` — do not exist yet (no `scripts/` directory at all)
- [ ] `.env.example` — does not exist yet
- [ ] `docker-compose.yml` (optional wrapper) — does not exist yet
- [ ] `test/package.json`, `test/playwright.config.ts` — do not exist yet (only a stray, config-less `test/node_modules/` is present)
- [ ] `test/docker-compose.test.yml` — does not exist yet
- [ ] `test/e2e/*.spec.ts` (fresh-start, watchlist, trading, portfolio-viz, chat, sse-reconnect) — none exist yet
- [ ] Lazy-import fix for `massive` in `backend/app/market/massive_client.py`/`factory.py`, and `rich` moved to a `[project.optional-dependencies]` extra in `backend/pyproject.toml` (followed by `uv lock`) — not yet done, confirmed via direct file reads this session

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | App is explicitly single-user, no-auth by design (PLAN.md §7) — out of scope |
| V3 Session Management | No | No sessions — out of scope |
| V4 Access Control | No | No multi-user boundary to enforce |
| V5 Input Validation | No (not new in this phase) | Already handled by existing route validation (Phase 2-4); Phase 5 adds no new input surfaces |
| V6 Cryptography | No | No secrets are generated/stored by this phase's deliverables; `OPENROUTER_API_KEY` is operator-supplied and passed via `--env-file`, never embedded |
| **V14 Configuration** | **Yes** | Container must not bake secrets into image layers; must run as non-root; must not expose unnecessary ports/services |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Secrets baked into Docker image layers (`.env`, `db/finally.db` accidentally `COPY`'d in) | Information Disclosure | `.dockerignore` excluding `.env`, `db/*.db*` (Common Pitfalls #1); `--env-file` passes secrets at `docker run` time, never at `docker build` time |
| Container running as root, full filesystem write access | Elevation of Privilege | Non-root `USER nonroot` in the final Dockerfile stage, matching the Context7-verified official uv pattern `[CITED: github.com/astral-sh/uv-docker-example]` |
| Unnecessarily large attack surface from bundled dev/demo tooling (`rich`, unused CLI tools) in the production image | (general hardening, not a specific STRIDE category) | Move `rich` to an optional extra excluded by `UV_NO_DEV=1 uv sync --locked` in the production build (Common Pitfalls #4) |
| E2E test container exposing port 8000 beyond the docker-compose network | Information Disclosure (test-env only) | `test/docker-compose.test.yml`'s `app` service uses `expose:` (internal-only) rather than `ports:` (host-published) — Playwright reaches it via the compose network hostname `app`, not `localhost` |

## Sources

### Primary (HIGH confidence)
- `/astral-sh/uv-docker-example` (Context7) — multi-stage Dockerfile pattern, non-root user setup, `uv sync --locked` with bind-mounted lockfile
- `backend/app/main.py` (Read, this session) — static-dir resolution, `.env` loading, app assembly, route registration order
- `backend/app/db/connection.py`, `backend/app/db/init.py` (Read, this session) — DB path resolution, idempotent seed-once behavior
- `backend/app/market/factory.py`, `backend/app/market/massive_client.py` (Read, this session) — `MASSIVE_API_KEY` fallback logic, module-scope `massive` import
- `backend/app/llm/client.py` (Read, this session) — exact `LLM_MOCK` string comparison
- `backend/pyproject.toml` (Read, this session) — current core dependency list including `massive`, `rich`
- npm registry (`npm view @playwright/test version`, this session) — 1.63.0
- `git check-ignore -v .env.example`, `docker compose version`, `backend/.venv/pyvenv.cfg` (run/read this session)

### Secondary (MEDIUM confidence)
- `nextjs.org/blog/next-16` (fetched directly this session) — Node.js 20.9+ minimum version requirement table
- `playwright.dev/docs/docker` (fetched directly this session) — official image tag pattern (`v1.63.0-noble`), `--ipc=host`/`--init` flags

### Tertiary (LOW confidence)
- Docker named-volume ownership-inheritance behavior (Common Pitfalls #3 / Assumptions Log A1) — sourced from WebSearch summary of multiple third-party blog posts, not a fetched primary `docs.docker.com` page; flagged `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions/tags verified via direct tool calls or fetched official docs this session
- Architecture (path-depth invariant, dependency hygiene fix): HIGH — both grounded in direct `Read` of the actual source files with line-range citations and verbatim quotes
- Pitfalls: HIGH for #1, #2, #4, #5, #6, #7 (each grounded in a direct file read or tool run); MEDIUM for #3 (general Docker behavior, not independently verified against a primary source this session — see Assumptions Log)

**Research date:** 2026-09-22
**Valid until:** 30 days (stable tooling: Docker, uv, Next.js LTS-track versions) — re-verify the `mcr.microsoft.com/playwright` tag against whatever `@playwright/test` version is actually installed at execution time, since Playwright ships frequent point releases.

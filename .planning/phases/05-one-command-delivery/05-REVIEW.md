---
phase: 05-one-command-delivery
reviewed: 2026-09-24T11:32:59Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - .dockerignore
  - .env.example
  - .gitignore
  - .gsd/dispatch-isolation-sentinel.json
  - Dockerfile
  - README.md
  - backend/CLAUDE.md
  - backend/app/main.py
  - backend/app/market/massive_client.py
  - backend/pyproject.toml
  - backend/tests/market/test_massive.py
  - backend/uv.lock
  - docker-compose.yml
  - scripts/start_mac.sh
  - scripts/start_windows.ps1
  - scripts/stop_mac.sh
  - scripts/stop_windows.ps1
  - test/docker-compose.test.yml
  - test/e2e/01-fresh-start.spec.ts
  - test/e2e/02-watchlist.spec.ts
  - test/e2e/03-trading.spec.ts
  - test/e2e/04-portfolio-viz.spec.ts
  - test/e2e/05-chat.spec.ts
  - test/e2e/06-sse-reconnect.spec.ts
  - test/package-lock.json
  - test/package.json
  - test/playwright.config.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-24T11:32:59Z
**Depth:** standard
**Files Reviewed:** 26 (20 distinct source files; `.gsd/dispatch-isolation-sentinel.json` and lockfiles reviewed as metadata, no findings)
**Status:** issues_found

## Summary

Reviewed the Phase 5 "one-command delivery" surface: Dockerfile, compose files, start/stop scripts, the FastAPI entrypoint, the Massive (Polygon.io) market-data client, and the Playwright E2E suite. The Docker packaging, path-resolution build-time assertions, and E2E test design are unusually careful (build-time assertions catch the exact class of path-nesting bug the code comments warn about; the E2E specs are self-sufficient and correctly reason about shared, non-isolated state).

However, cross-checking `backend/app/market/massive_client.py` against the actual installed `massive==2.2.0` package (the version `uv.lock` resolves and `Dockerfile` installs with `--locked`) surfaced a critical, provable defect: the code reads an attribute (`snap.last_trade.timestamp`) that does not exist on the real SDK's data model. The optional real-market-data path (`MASSIVE_API_KEY` set) is non-functional as shipped — every poll silently drops every ticker. The accompanying unit tests use `MagicMock` snapshots that auto-vivify the nonexistent attribute, so the test suite passes despite the integration being broken against the real library.

Also found a functional gap in the launcher scripts: passing `--build`/`-Build` to `start_mac.sh` / `start_windows.ps1` rebuilds the image but does not recreate an already-existing container, so the running/stopped container keeps executing the old image.

## Critical Issues

### CR-01: MassiveDataSource reads a nonexistent `last_trade.timestamp` attribute — real market data path is broken

**File:** `backend/app/market/massive_client.py:105-113`
**Issue:** `_poll_once()` does:

```python
price = snap.last_trade.price
# Massive timestamps are Unix milliseconds → convert to seconds
timestamp = snap.last_trade.timestamp / 1000.0
```

The installed dependency is `massive==2.2.0` (confirmed via `backend/uv.lock:1048` and the actual `.venv` package). Its `LastTrade` model (`massive/rest/models/snapshot.py`) has **no `timestamp` attribute at all** — it exposes `sip_timestamp`, `participant_timestamp`, and `trf_timestamp` (all nanosecond Unix timestamps per Polygon's REST API convention, not milliseconds):

```
>>> from massive.rest.models.snapshot import LastTrade
>>> LastTrade().timestamp
AttributeError: 'LastTrade' object has no attribute 'timestamp'
```

Because this line runs inside the per-snapshot `try/except (AttributeError, TypeError)` block (lines 103-119), the `AttributeError` is caught and every snapshot is logged as "Skipping snapshot for %s: %s" and dropped — for every ticker, on every poll, permanently. When `MASSIVE_API_KEY` is set (the documented alternative to the simulator, per PLAN.md §6), the price cache never receives a single real price update; the app appears to run (health check passes, SSE stream stays open) but never streams data. This is silent — no error surfaces to the operator beyond a WARNING log line per ticker per poll.

Both the attribute name and the unit conversion are wrong for the pinned SDK version: the correct field is `sip_timestamp` (or `participant_timestamp`), and it is nanoseconds, not milliseconds, so the divisor also needs to change from `1000.0` to `1e9` (or equivalent).

**Fix:**
```python
price = snap.last_trade.price
# massive==2.2.0's LastTrade exposes sip_timestamp (nanoseconds), not
# `timestamp` — confirm the exact source-of-truth field against the
# pinned SDK version before shipping.
timestamp = snap.last_trade.sip_timestamp / 1e9
```
Add (or fix) a unit test that constructs a real `massive.rest.models.snapshot.LastTrade`/`TickerSnapshot` instance (not a bare `MagicMock`) so a future SDK/attribute mismatch fails the test suite instead of silently passing — see WR-02 below.

## Warnings

### WR-01: `--build` flag does not apply to an existing container

**File:** `scripts/start_mac.sh:17-29`, `scripts/start_windows.ps1:21-51`
**Issue:** Both launcher scripts rebuild the image (retagging `finally` to a new image ID) when `--build`/`-Build` is passed, but the subsequent container-lifecycle logic only distinguishes "running" / "stopped-but-exists" / "absent":

```bash
if [[ "${1:-}" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker build -t "$IMAGE_NAME" .
fi

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  : # already running - fall through
elif docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker start "$CONTAINER_NAME"   # <-- reuses the OLD container, bound to the OLD image ID
else
  docker run -d --name "$CONTAINER_NAME" ...
fi
```

A Docker container is bound to the image ID it was `docker run`/`docker create`d from, not to the mutable tag. Retagging `finally` via `docker build -t finally .` does not change what an existing container executes. So whenever a `finally` container already exists (running or stopped), `--build`/`-Build` silently has no effect on what actually runs — the operator gets a rebuilt image sitting unused while the stale container (or a `docker start` of it) keeps serving old code. This directly contradicts the script's own header comment ("Builds the image if not already built (**or if `--build` flag passed**)").

**Fix:** When `--build` is requested and a same-named container already exists, remove it before recreating, e.g.:
```bash
if [[ "${1:-}" == "--build" ]]; then
  docker build -t "$IMAGE_NAME" .
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi
```
then fall through to the normal "container doesn't exist → docker run" branch. Apply the equivalent fix in `start_windows.ps1`.

### WR-02: Mocked Massive snapshot tests mask the real attribute-shape bug (CR-01)

**File:** `backend/tests/market/test_massive.py:11-18`
**Issue:** `_make_snapshot()` builds `snap = MagicMock()` and assigns `snap.last_trade.timestamp = timestamp_ms` directly. `unittest.mock.MagicMock` auto-vivifies any attribute access, and explicit assignment always succeeds regardless of whether the real `massive` SDK's `LastTrade` model actually has a `timestamp` field. As a result, `test_poll_updates_cache`, `test_timestamp_conversion`, etc. all pass even though the exact code path they exercise raises `AttributeError` against the real, pinned `massive==2.2.0` package (see CR-01). The test suite currently provides no signal that the Massive integration is broken.
**Fix:** Build snapshot fixtures from the real model classes (`massive.rest.models.snapshot.TickerSnapshot`/`LastTrade`) instead of bare `MagicMock`s, e.g. `TickerSnapshot(ticker="AAPL", last_trade=LastTrade(price=190.50, sip_timestamp=1707580800_000_000_000))`. This would have caught CR-01 at test time and will catch any future SDK upgrade that reshapes the model again.

## Info

### IN-01: `.dockerignore` does not exclude `backend/static`

**File:** `.dockerignore:9-22`
**Issue:** The Dockerfile generates `backend/static/` only inside the build (Stage 1 → `COPY --from=frontend-builder .../out /app/backend/static`), and nothing in the repo currently creates a `backend/static/` on the host, so this is low-risk today. But if a `backend/static/` directory is ever created locally (e.g. manual copy for local `uvicorn` testing, matching `resolve_static_dir()`'s stage-2 fallback), it would enter the Docker build context via `COPY backend/ /app/backend/` (line 36) and only be partially overwritten by the frontend-builder's `COPY --from` on the next line — `COPY` merges into the destination rather than replacing it, so stale/extra files from a host `backend/static/` could survive into the image and be served.
**Fix:** Add `backend/static` to `.dockerignore` for defense in depth, consistent with the file's stated goal of keeping non-source artifacts out of the build context.

### IN-02: `massive` dependency constraint has no upper bound

**File:** `backend/pyproject.toml:11`
**Issue:** `"massive>=1.0.0"` allows any future major version. The gap between `1.0.0` and the currently-locked `2.2.0` already introduced the breaking model-shape change responsible for CR-01, so this range has demonstrably crossed at least one breaking change already. The Docker build is protected by `uv sync --locked`, but any local/dev workflow that runs a bare `uv sync` (regenerating the lock) could silently drift onto a newer incompatible release.
**Fix:** Consider a narrower constraint (e.g. `>=2.2.0,<3.0.0`) and/or a CI check that fails on `uv lock --check` drift, so a future SDK bump surfaces as a visible dependency change rather than another silent runtime `AttributeError`.

---

_Reviewed: 2026-09-24T11:32:59Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

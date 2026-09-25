---
phase: 05-one-command-delivery
plan: 03
subsystem: backend-dependency-hygiene
tags: [uv, pyproject, dependencies, market-data, massive, lazy-import]

requires:
  - phase: 05-one-command-delivery
    provides: "Dockerfile (plan 05-01) that runs `uv sync --locked` and depends on an honest, in-sync lockfile"
provides:
  - "backend/pyproject.toml with `rich` moved from core dependencies into a `demo` optional-dependency extra"
  - "Regenerated backend/uv.lock in sync with the new manifest"
  - "MassiveDataSource with the Polygon SDK (`massive`) imported lazily at its two call sites instead of at module scope"
  - "backend/tests/market/test_massive.py re-pointed to patch `massive.RESTClient` (the SDK's own namespace)"
affects: [05-01, 05-04, 05-05]

actuals:
  tokens: 1200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "TYPE_CHECKING-guarded module-scope re-import paired with a deferred in-function import, so a type annotation resolves under ruff without loading the real dependency until the code path that needs it actually runs"

key-files:
  created: []
  modified:
    - backend/pyproject.toml
    - backend/uv.lock
    - backend/CLAUDE.md
    - backend/app/market/massive_client.py
    - backend/tests/market/test_massive.py

key-decisions:
  - "massive stays in core `dependencies` (not touched) — only rich moved to a `demo` extra, per PLAN.md's promise that MASSIVE_API_KEY works at `docker run` time against an already-built image"
  - "Did not attempt to prune `rich` from the installed set — it arrives transitively via litellm -> tokenizers -> huggingface-hub -> typer regardless of the declared-dependency edit, and the plan explicitly forbids fighting that"

requirements-completed: [OPS-01]

coverage:
  - id: D1
    description: "backend/pyproject.toml's core dependencies array no longer declares rich; a demo extra declares it instead, as a sibling of dev"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "python -c tomllib assertion (7 core deps, no rich in core, rich in demo extra, massive in core, dev extra intact) — command in PLAN.md Task 1 verify block"
        status: pass
    human_judgment: false
  - id: D2
    description: "backend/uv.lock regenerated and in sync — uv sync --locked succeeds"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "uv sync --directory backend --locked --extra demo (exit 0) + uv run --extra demo python -c 'import rich' (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "backend/CLAUDE.md documents the demo invocation with --extra demo"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "grep -q -- '--extra demo market_data_demo.py' backend/CLAUDE.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Importing app.market.factory / app.market.massive_client no longer imports the massive SDK at module scope"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "AST check over massive_client.py's tree.body (no top-level massive import) — PLAN.md Task 2 verify block"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full backend test suite passes after the lazy-import change, including the 3 re-pointed test_massive.py patches"
    requirement: "OPS-01"
    verification:
      - kind: unit
        ref: "uv run --extra dev pytest -q -m 'not requires_frontend_build' -> 223 passed, 1 deselected"
        status: pass
      - kind: unit
        ref: "uv run --extra dev pytest tests/market/test_massive.py tests/market/test_factory.py -v -> 21 passed"
        status: pass
      - kind: unit
        ref: "uv run --extra dev ruff check app/ tests/ -> All checks passed!"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 5 Plan 3: Dependency Hygiene (demo extra + lazy Massive SDK import) Summary

**Moved `rich` out of `backend/pyproject.toml`'s core dependencies into a new `demo` extra and deferred the Polygon (`massive`) SDK's imports in `MassiveDataSource` from module scope into `start()`/`_fetch_snapshots()`, so a simulator-only container no longer loads the Polygon SDK to import its market module.**

## Performance
- **Duration:** ~25min
- **Completed:** 2026-09-22T19:52:27Z
- **Tasks:** 2/2 completed
- **Files modified:** 5

## Accomplishments
- `backend/pyproject.toml`'s core `dependencies` array now has exactly 7 entries (no `rich`); a new `demo` extra (sibling of `dev`) holds `rich>=13.0.0`; `massive>=1.0.0` untouched in core.
- `backend/uv.lock` regenerated via `uv lock` and verified in sync (`uv sync --locked --extra demo` exits 0), so the Dockerfile's `uv sync --locked` cannot fail on lockfile drift.
- `backend/CLAUDE.md`'s Demo section now documents `uv run --extra demo market_data_demo.py`.
- `MassiveDataSource` no longer imports `massive` at module scope: `RESTClient` moved into `start()`, `SnapshotMarketType` moved into `_fetch_snapshots()`, with a `TYPE_CHECKING`-guarded re-import preserving the `self._client: RESTClient | None` type annotation.
- `backend/tests/market/test_massive.py`'s three `patch("app.market.massive_client.RESTClient")` calls re-pointed to `patch("massive.RESTClient")` (the SDK's own namespace), matching the deferred import's runtime lookup.
- Full backend suite: 223 passed, 1 deselected (the `requires_frontend_build`-marked test), 0 failures. `ruff check app/ tests/` clean.

## Task Commits
1. **Task 1: Demote `rich` to a `demo` extra and re-lock** - `6bc2501` (chore)
2. **Task 2: Lazy-load the Polygon SDK, with its mandatory test companion edit** - `d3f560d` (fix)

## Files Created/Modified
- `backend/pyproject.toml` - `rich` removed from core `dependencies`; `demo` extra added
- `backend/uv.lock` - regenerated, in sync with the new manifest
- `backend/CLAUDE.md` - Demo section invocation updated to `--extra demo`
- `backend/app/market/massive_client.py` - `RESTClient`/`SnapshotMarketType` imports moved from module scope into `start()`/`_fetch_snapshots()`; `TYPE_CHECKING`-guarded re-import added for the type annotation
- `backend/tests/market/test_massive.py` - 3 `patch()` targets re-pointed from `app.market.massive_client.RESTClient` to `massive.RESTClient`

## Decisions Made
- Left `massive` in core `dependencies` untouched — moving it would break the PLAN.md §5 promise that `MASSIVE_API_KEY` switches the data source at `docker run` time against an already-built image, with no rebuild.
- Did not attempt to eliminate `rich` from the installed set (it still arrives transitively via `litellm` → `tokenizers` → `huggingface-hub` → `typer`, per the plan's own verified constraint) — only the *declared* contract changed, which is the objective.
- `factory.py` required no change: it imports the `MassiveDataSource` class only, which no longer touches `massive` at import time; ruff confirmed clean with no `TYPE_CHECKING`-leak issue.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `uv run --extra demo python -c "import rich; print(rich.__version__)"` initially raised `AttributeError: module 'rich' has no attribute '__version__'` — this is a quirk of the `rich` package itself (it doesn't expose `__version__` as a module attribute), not a dependency-resolution failure. Re-verified via `uv sync --locked --extra demo` (exit 0) and `import rich; print(rich.__file__)` (exit 0, resolves inside `.venv`), confirming the `demo` extra correctly resolves `rich`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The Dockerfile's `uv sync --locked` step (plan 05-01) is now safe against lockfile drift from this plan's manifest edit. A simulator-only production container will no longer eagerly import the Polygon SDK. The full `docker build -t finally .` end-to-end check (part of this phase's overall `<verification>`) was not run standalone in this plan — it depends on sibling plans' artifacts (Dockerfile, frontend build) that are outside this plan's `files_modified` scope, and is expected to be exercised by the phase's own integration verification.

## Self-Check: PASSED

---
*Phase: 05-one-command-delivery*
*Completed: 2026-09-22*

---
phase: "05"
slug: "one-command-delivery"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-24"
verified: "2026-09-24"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| host filesystem → Docker build context | Everything not excluded by `.dockerignore` becomes copyable into a distributable image layer | `.env`, `db/finally.db` (must be excluded) |
| operator shell → container runtime | `--env-file` / `env_file:` carries live API keys at run time | `OPENROUTER_API_KEY`, `MASSIVE_API_KEY` |
| container process → host kernel/filesystem | The uvicorn process's uid determines container-escape / mounted-volume write reach | filesystem writes under `/app/db` |
| root `.env` → operator terminal / CI log | Lifecycle scripts handle a file containing live API keys | log/stdout exposure risk |
| operator command → persisted database | A single destructive flag in a routinely-run script differs a stop from data loss | `finally-data` volume contents |
| host port 8000 → local network | Publishing the app binds a host port for as long as the container runs | unauthenticated app surface |
| declared manifest → installed image | `pyproject.toml` vs. actually-installed transitive set | dependency provenance |
| module import graph → external SDK | Module-scope third-party import executes vendor code on every app boot | `massive` SDK code execution |
| npm registry → `test/node_modules` and the container image | Third-party test-tooling code fetched and executed by the test runner | `@playwright/test` supply chain |
| compose network → host network | Anything the `app` test service publishes with `ports:` becomes reachable outside the test run | seeded DB / chat endpoint |
| committed spec/compose files → version control | Any credential written into these files is permanent in git history | test fixtures, mock keys |
| Playwright runner → app container | The runner drives the app's full unauthenticated API surface, incl. the chat→LLM path | mock-mode enforcement |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | Docker build context / image layers, `docker-compose.yml` `env_file` | high | mitigate | `.dockerignore` excludes `.env`/`db/*`/`.git`/`.planning`; no `COPY .env`; secrets enter only via `--env-file`/`env_file:` at run time. Verified: 05-01 image-layer scan (`docker run --rm --entrypoint find finally /app ...` → empty) and 05-02's `docker compose config` review. | closed |
| T-05-02 | Elevation of Privilege | Stage-2 runtime user | high | mitigate | `USER nonroot` (uid/gid 999) set before `CMD`; `/app/db`, `/app/backend` pre-`chown`ed. Verified: `docker image inspect --format '{{.Config.User}}'` → `nonroot` (05-01 D2). | closed |
| T-05-03 | Tampering | production image dependency surface (residual `rich`) | medium | accept | `rich` moved to a `demo` extra (declared contract honest) but arrives transitively via `litellm`→`tokenizers`→`huggingface-hub`→`typer`; removing it means dropping `litellm`, which PLAN.md §9 locks. Accepted — rationale recorded in 05-03-PLAN.md so no later phase mistakes the residual `rich` for a regression. | closed |
| T-05-04 | Information Disclosure | E2E `app` service network exposure | low | mitigate | `app` service uses `expose: ["8000"]` only — reachable as `app:8000` on the compose network, never published to the host. Inherited control, used by 05-04 and 05-05. | closed |
| T-05-05 | Information Disclosure | `scripts/*` handling of the root `.env` | medium | mitigate | Scripts reference `.env` by path via `--env-file` only, never read/print/interpolate its contents; no `set -x`. Asserted by 05-02 acceptance criteria. | closed |
| T-05-06 | Denial of Service | `scripts/stop_mac.sh`, `scripts/stop_windows.ps1` | high | mitigate | Stop scripts act on the container only; grep asserts no destructive-storage patterns. Verified beyond the plan's own bar: 05-02's executor ran a real trade + watchlist-add + chat message, stopped, restarted, and confirmed all three survived against a live Docker daemon. | closed |
| T-05-07 | Information Disclosure | `test/e2e/05-chat.spec.ts` and siblings | medium | mitigate | No spec carries a credential; chat spec exercises only the deterministic `LLM_MOCK` branch; the one placeholder key lives in `test/docker-compose.test.yml` (inherited from 05-04), not in any spec. | closed |
| T-05-08 | Spoofing | Base image provenance (`node:20-slim`, `ghcr.io/astral-sh/uv`) | medium | accept | Official/publisher-namespaced images, not digest-pinned. Accepted: locally-built, locally-run educational artifact with no registry-published image; digest pinning would freeze security patches. | closed |
| T-05-09 | Denial of Service | `app.market.factory` / `app.market.massive_client` module import | medium | mitigate | `massive` SDK import deferred into `start()`/`_fetch_snapshots()`, decoupling the default simulator path from the SDK. Verified: AST assertion over `tree.body` (no top-level `massive` import) + full 224-test backend suite green post-merge. | closed |
| T-05-10 | Tampering | `backend/uv.lock` | high | mitigate | Every manifest edit paired with `uv lock` in the same commit; `uv sync --locked` asserted exit 0. Verified: 05-03 D2. | closed |
| T-05-11 | Information Disclosure | credentials in committed test config | medium | mitigate | `OPENROUTER_API_KEY` in compose is the literal placeholder `unused-under-mock`, valid only under quoted `LLM_MOCK: "true"`. Asserted by grep in 05-04 Task 3 verify. | closed |
| T-05-12 | Spoofing | `mcr.microsoft.com/playwright` runner image | low | accept | Pulled by version tag (not digest) from Microsoft's own registry; runs only against a locally-built app image on an isolated compose network with no credentials present. Same rationale as T-05-08. | closed |
| T-05-13 | Spoofing | host port 8000 binding (all interfaces) | low | accept | `-p 8000:8000` matches PLAN.md §11's documented invocation verbatim; app is an unauthenticated single-user local tool by design (REQUIREMENTS.md "no auth" explicitly out of scope). Narrowing to `127.0.0.1` would silently diverge scripts from the documented command. | closed |
| T-05-14 | Tampering | chat-driven trade execution under test | low | mitigate | AI-initiated trades go through the same Phase 3 validation path as manual trades — no second, looser execution route. Verified: 05-05's chat spec exercises a genuine `failed` rejection pill, and the container DB is disposable per run. | closed |
| T-05-SC | Tampering | `npm install`/`npm ci` of `@playwright/test` in `test/` | high | mitigate | Package Legitimacy Audit flagged `SUS` (false positive — heuristic measured latest-release date, not package age; 44.4M weekly downloads, official Microsoft repo). Task 1 of 05-04 was a `gate="blocking-human"` checkpoint (never auto-approvable) — genuinely resolved by a human between executor instances, re-verified (`npm view @playwright/test version` → `1.63.0`) before install, pinned exact (no `^`/`~`) in a committed lockfile, installed via `npm ci`. | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-05-01 | T-05-03 | Residual transitive `rich` dependency via `litellm`; removing it requires dropping the locked LLM transport | plan 05-03 (recorded at plan time) | 2026-09-24 |
| R-05-02 | T-05-08 | Base images not digest-pinned — local educational artifact, no registry-published image | plan 05-01 (recorded at plan time) | 2026-09-24 |
| R-05-03 | T-05-12 | Playwright runner image not digest-pinned — same rationale as T-05-08, isolated test network | plan 05-04 (recorded at plan time) | 2026-09-24 |
| R-05-04 | T-05-13 | Host port 8000 bound on all interfaces — matches documented single-command invocation; app has no auth by design | plan 05-02 (recorded at plan time) | 2026-09-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-24 | 15 | 15 | 0 | orchestrator (L1 grep-depth, ASVS level 1, register authored at plan time — auditor spawn not required per short-circuit rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-24

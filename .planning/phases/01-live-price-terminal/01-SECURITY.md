---
phase: "01"
slug: "live-price-terminal"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-18"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `/api/*` | Unauthenticated HTTP requests reach FastAPI | Parameterless GETs, no body, single-user local app |
| browser → `/` static mount | Request path segments resolved against a filesystem directory | Served HTML/JS/CSS |
| npm/PyPI registries → `frontend/node_modules` / `backend/.venv` | Third-party package code enters the build | Resolved dependency trees |
| process environment → application | `MASSIVE_API_KEY`, `FINALLY_STATIC_DIR` select data source and served directory | Env var values |
| background data source → `PriceCache` | A writer thread mutates state that SSE reader coroutines observe concurrently | In-memory price ticks |
| SSE payload → React render tree | Server-supplied JSON values interpolated into header, grid, and chart | Ticker symbols and prices |
| simulated price engine → user's eyes | Generated numbers rendered in a UI styled as a professional trading terminal | Simulated (non-real) market data |
| stream connection state → user's trust decision | The connection dot is the only signal distinguishing a live stream from a frozen one | Connection status |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC | Tampering (supply chain) | `npm --prefix frontend install` (01-01), `uv add --optional dev httpx` (01-02) | high | mitigate | RESEARCH.md's Package Legitimacy Audit covers every package added this phase (next, react, recharts, vitest, testing-library, httpx, etc.) — all verdicts OK/Approved, no `[ASSUMED]`/`[SUS]`/`[SLOP]` entries. Exact (range-free) version pins in `frontend/package.json`; post-install assertion that `next` resolves to exactly `16.3.5`. `httpx` installed via `uv add --optional dev` into the existing `dev` extra, verified as the PyPI Encode-org package, not the unrelated npm package of the same name. | closed |
| T-01-01 | Tampering / Info Disclosure | `StaticFiles` mount at `/` in `backend/app/main.py` | medium | mitigate | Served exclusively through Starlette's `StaticFiles(html=True)`, whose `lookup_path` normalises and rejects traversal — verified: no hand-written path-joining route exists in `main.py`. | closed |
| T-01-02 | Information Disclosure | `git add` of `frontend/` after the `.gitignore` repair (01-01) | medium | mitigate | The narrowed `lib/` rule is paired with a new Node/Next.js exclusion block (`node_modules/`, `/frontend/out/`, `.next/`, `*.tsbuildinfo`) added in the same task, before anything was staged; only six named `frontend/lib/*.ts` paths were staged explicitly, never a directory glob. Verified via `git check-ignore` acceptance criteria that passed in 01-01. | closed |
| T-01-04 | Spoofing (data provenance) | `frontend/app/page.tsx` (01-02) → `frontend/components/Header.tsx` (01-05) | medium | mitigate | The literal disclosure text "Simulated market data" is present in `Header.tsx` and asserted by an automated grep over the built static export in every plan that touched the page (01-02, 01-04, 01-05). Verified present in current `Header.tsx`. | closed |
| T-01-05 | Information Disclosure | `GET /api/health` response body | low | mitigate | Handler returns exactly `{"status": "ok"}` — verified in `backend/app/main.py`; no configuration or environment detail (e.g. whether `MASSIVE_API_KEY` is set) is echoed. | closed |
| T-01-06 | Denial of Service | Unbounded concurrent SSE connections on `/api/stream/prices` | low | accept | CONCERNS.md already records "No Concurrent Client Limit on SSE" as a known, deferred scaling limit for a single-user local demo with no auth surface. Not revisited this phase — accepted as-is. | closed |
| T-01-07 | Tampering | `PriceCache._session_open` read-modify-write under concurrent writers (01-03) | medium | mitigate | The new per-ticker session-open dict is read and written only inside the pre-existing single `with self._lock:` block in `update()`, and discarded inside `remove()`'s existing block — verified in `backend/app/market/cache.py`; no second lock introduced. | closed |
| T-01-08 | Denial of Service | New SSE streaming tests against an endless generator (01-03) | low | mitigate | Every streaming test caps how many lines it reads and wraps reads in a timeout (confirmed via 01-03's SUMMARY — real bound `uvicorn.Server` pattern with bounded reads, not an unbounded `async for`). | closed |
| T-01-09 | Tampering (DOM injection) | Ticker symbols and numeric values rendered by `WatchlistRow` (01-04) | low | accept | Values reach the DOM as React children, escaped by default; no raw-HTML insertion API used anywhere in this phase; the symbol list is a server-side constant, not user input. | closed |
| T-01-10 | Denial of Service (client-side) | Unbounded per-ticker history growth feeding charts (01-04) | low | mitigate | Buffer capped at `PRICE_HISTORY_LIMIT` (120) inside `usePriceStream.ts`; verified no second cap exists in `WatchlistRow.tsx` that could drift from it. Chart animation disabled. | closed |
| T-01-11 | Spoofing (false liveness) | `frontend/components/ConnectionDot.tsx` (01-05) | medium | mitigate | Every status value is derived from the browser's own `EventSource` `open`/`error` events inside `usePriceStream.ts` — verified no local timer or optimistic default drives the dot. Covered by 12 automated tests plus a deferred devtools offline/recovery human-check. | closed |
| T-01-12 | Repudiation (unfalsifiable state) | Colour-only connection status (01-05) | low | mitigate | Status additionally exposed via `data-status` attribute and `aria-label` text — verified present in `ConnectionDot.tsx`. | closed |
| T-01-13 | Spoofing (fabricated portfolio state) | `frontend/components/Header.tsx` (01-05) | medium | mitigate | Header renders no currency-formatted value at all — verified via grep; no hardcoded total/cash figure stands in for the Phase 3 portfolio feature. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-06 | Single-user local demo with no authentication surface; a per-connection cap is unjustified complexity for this scale. Documented in CONCERNS.md as a deferred scaling limit. | Phase 1 planning (01-02, 01-03) | 2026-09-17 |
| AR-02 | T-01-09 | Framework-level output encoding (React's default escaping) is canon coverage for DOM injection; no raw-HTML insertion API is used anywhere in this phase. | Phase 1 planning (01-04) | 2026-09-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-18 | 13 | 13 | 0 | /gsd-secure-phase orchestrator (ASVS L1 grep-depth verification; auditor spawn short-circuited per `threats_open: 0 AND register_authored_at_plan_time: true AND asvs_level == 1`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-18

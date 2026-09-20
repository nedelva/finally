---
phase: "2"
slug: "persistent-watchlist"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-19"
verified: "2026-09-19"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `POST/DELETE/GET /api/watchlist` | Untrusted user-supplied ticker string (add) / path parameter (remove) crosses into the FastAPI process | Ticker symbol string |
| `app/api` → `app/db` | Application values cross into SQL statement execution | Ticker string, user_id |
| `app/api` → `MarketDataSource` | Submitted ticker becomes a `PriceCache`/dict key and, on the Massive path, part of an outbound API request | Ticker string |
| `app/db` → `db/finally.db` | Process writes to a persistent SQLite file on the host/volume | Watchlist rows |
| Backend API → Browser DOM | `getWatchlist()` failure strings render into `watchlist-load-error` / `watchlist-add-error` slots | Error message text |
| None (02-05) | CSS/layout-only changes to already-shipped, already-tested watchlist components | N/A |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | `app/db/repository.py` SQL statements | high | mitigate | All statements use `?` placeholders bound via `execute()` parameter tuples — verified: no f-string/`.format()`/`%` SQL interpolation found in `repository.py`. | closed |
| T-02-02 | Information Disclosure | `GET /api/watchlist` response | low | accept | Single-user app, no auth, no secrets — response carries only tickers, timestamps, public price data. | closed |
| T-02-03 | Denial of Service | `app/db/connection.py` | low | accept | Short-lived local-file connections at single-user request rate; WAL mode avoids lock contention. | closed |
| T-02-04 | Tampering | `db/finally.db` path resolution | medium | mitigate | `FINALLY_DB_PATH` is read from `os.environ` only (`backend/app/db/connection.py`) — verified: no request-derived value can set it. | closed |
| T-02-05 | Tampering | `add_watchlist_ticker` SQL | high | mitigate | Verified: `INSERT INTO watchlist (...)` uses `?` placeholders, ticker bound as parameter. | closed |
| T-02-06 | Denial of Service | unbounded ticker string | medium | mitigate | Verified: `is_valid_ticker_format()` (`app/market/ticker.py`) enforces `[A-Z0-9]{1,5}` and is called in `app/api/watchlist.py` before any DB write, cache write, or market-source notify. | closed |
| T-02-07 | Tampering | ticker in outbound Massive request | medium | mitigate | Same `is_valid_ticker_format()` gate runs before any notify — verified present on the shared add-ticker path. | closed |
| T-02-08 | Spoofing | none applicable | low | accept | Single-user app, no auth/sessions; all rows scoped to `user_id="default"`. | closed |
| T-02-09 | Tampering | `remove_watchlist_ticker` SQL | high | mitigate | Verified: `DELETE FROM watchlist WHERE user_id = ? AND ticker = ?` uses bound parameters. | closed |
| T-02-10 | Tampering | path traversal via `{ticker}` | medium | mitigate | Ticker is only ever used as a SQL bind parameter / dict key, never a filesystem path; `normalize_ticker()` applied as defense in depth. | closed |
| T-02-11 | Tampering | unintended cascading delete | high | mitigate | Verified: `DELETE FROM watchlist` targets only the `watchlist` table — no joined/cascading statement touches `positions`, `trades`, `portfolio_snapshots`, or `chat_messages`. | closed |
| T-02-12 | Repudiation | no removal audit trail | low | accept | Single-user simulated environment, no compliance requirement; append-only log scoped to `trades` only per spec. | closed |
| T-02-04-01 | Information Disclosure / Tampering (XSS) | `frontend/components/Watchlist.tsx` `watchlist-load-error` render | low | accept | Rendered as a plain React child (`{loadError}`), never `dangerouslySetInnerHTML` — React auto-escapes; same pattern as pre-existing `watchlist-add-error` slot. | closed |
| T-02-05-01 | Tampering (unexpected UI state via CSS-only change) | `WatchlistRow.tsx`/`Watchlist.tsx`/`page.tsx` styling | low | accept | Pure Tailwind utility class additions (sizing, color, focus-ring, overflow, alignment) — no new input surface, no `dangerouslySetInnerHTML`, no new network calls; click/keydown handlers and data-fetching logic byte-for-byte unchanged. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-02, T-02-03, T-02-08, T-02-12, T-02-04-01, T-02-05-01 | Single-user, no-auth simulated trading app (PLAN.md §7) — spoofing/repudiation/session threats are out of scope by design; XSS/UI-tampering surfaces use React's default auto-escaping with no new input or `dangerouslySetInnerHTML` introduced. | plan-time (recorded per-plan in each PLAN.md `<threat_model>` block) | 2026-09-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-19 | 14 | 14 | 0 | /gsd-secure-phase (register_authored_at_plan_time: true, ASVS L1 — grep-level verification of all `mitigate` dispositions against implementation) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-19

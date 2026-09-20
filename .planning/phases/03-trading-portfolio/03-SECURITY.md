---
phase: "3"
slug: "trading-portfolio"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-20"
verified: "2026-09-20"
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `POST /api/portfolio/trade` | Untrusted JSON body reaches money-mutating logic | ticker, side, quantity |
| `PriceCache` → trade execution | In-process, trusted, but a missing entry must be handled rather than assumed present | live price |
| repository → SQLite | All parameters cross into SQL text assembly | trade/watchlist/snapshot rows |
| `GET /api/portfolio` / `/history` response → React state | Server-supplied numbers rendered into the DOM and SVG | cash, positions, snapshots |
| SSE tick stream → live recompute (header, positions table, heatmap, chart) | Server-pushed prices drive continuously recomputed displayed figures and tile geometry | price ticks |
| background snapshot task → SQLite | An unattended writer appends rows on a timer with no request context | portfolio_snapshots rows |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `execute_trade` quantity parameter | high | mitigate | `math.isfinite(quantity) and quantity > 0` check before any arithmetic (`repository.py:213`) — strengthened post-plan by CR-01 fix to also reject NaN/Infinity | closed |
| T-03-02 | Tampering | `POST /api/portfolio/trade` ticker parameter | high | mitigate | `SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?` gates every trade on the transaction's own connection (`repository.py:227`) | closed |
| T-03-03 | Tampering / Repudiation | cash and position read-then-write sequence | high | mitigate | `BEGIN IMMEDIATE` acquires the write lock before the first SELECT (`repository.py:225`) — strengthened post-plan by WR-01 fix to close a TOCTOU race the original `with conn:` block alone did not cover | closed |
| T-03-04 | Tampering | SQL assembled in `repository.py` | high | mitigate | `?` placeholders on every statement; `ruff --select S608 app/` reports zero findings | closed |
| T-03-05 | Tampering | float money arithmetic | medium | mitigate | `round(x, 2)` / `round(x, 4)` at write time; `1e-9` epsilon on over-sell check and close-out delete | closed |
| T-03-06 | Information Disclosure | `ValueError` text returned to the client | low | accept | Fixed user-facing copy from the UI-SPEC Copywriting Contract; single-user app, no auth boundary | accepted |
| T-03-07 | Spoofing | absent authentication on the trade endpoint | low | accept | PLAN.md §7 fixes this app as single-user with a hardcoded `user_id`; out of scope per REQUIREMENTS.md | accepted |
| T-03-08 | Tampering | ticker strings and numeric fields rendered in `Header.tsx` | low | accept | React escapes interpolated text by default; no `dangerouslySetInnerHTML` | accepted |
| T-03-09 | Information Disclosure | header figures rendered before the portfolio loads | low | mitigate | `formatMoney(null/undefined/NaN)` renders an em dash (`format.ts:6`), never a fabricated zero | closed |
| T-03-10 | Denial of Service | per-tick recomputation of the total across all positions | low | accept | Watchlist bounded to ~10 tickers; single linear pass at ~500ms SSE cadence | accepted |
| T-03-11 | Tampering | ticker strings rendered as SVG `text` inside Treemap tiles | low | accept | React escapes interpolated SVG text; tickers format-validated to 1-5 alphanumeric chars at the Phase 2 API boundary | accepted |
| T-03-12 | Tampering | non-finite numbers reaching tile geometry or table cells | medium | mitigate | Every displayed value routes through `format.ts`'s null-safe helpers and `deriveLivePosition`'s `avg_cost > 0` guard | closed |
| T-03-13 | Information Disclosure | a holding silently dropped from the table or heatmap | medium | mitigate | No filter applied to the positions array; zero-P&L / off-watchlist cases render through the neutral colour branch instead of being excluded | closed |
| T-03-14 | Denial of Service | per-tick re-layout of the treemap | low | accept | Position count bounded by the watchlist (~10 entries); recharts recomputes well inside the ~500ms cadence | accepted |
| T-03-15 | Tampering | SQL in `record_snapshot` and `get_snapshots` | high | mitigate | `?` placeholders on every statement; `ruff --select S608` clean | closed |
| T-03-16 | Denial of Service | unbounded growth of `portfolio_snapshots` | low | accept | ~2 rows/min + 1/trade in a single-user demo; `idx_snapshots_user_recorded` index keeps reads ordered without a scan | accepted |
| T-03-17 | Repudiation | a snapshot write failing silently and truncating the series | medium | mitigate | Loop catches broad `Exception`, calls `logger.exception`, continues rather than exiting the task (`snapshot_task.py`) | closed |
| T-03-18 | Tampering | valuation drift between the periodic writer and the REST snapshot | medium | mitigate | Both route through the single `total_portfolio_value(conn, price_cache)` helper, asserted equal in tests including the D-03 avg_cost-fallback case | closed |
| T-03-19 | Tampering | unparseable `recorded_at` reaching the chart's X axis | low | mitigate | `Date.parse` feeds a numeric axis with an `auto` domain; `formatMoney` coerces non-finite values to an em dash | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-06 | Fixed, non-sensitive error copy in a single-user, no-auth app | Phase 3 threat model (plan-time) | 2026-09-20 |
| AR-03-02 | T-03-07 | No-auth is a project-wide, explicitly scoped decision (PLAN.md §7), not a Phase 3 gap | Phase 3 threat model (plan-time) | 2026-09-20 |
| AR-03-03 | T-03-08 | React's default escaping is sufficient; no raw-HTML injection point exists | Phase 3 threat model (plan-time) | 2026-09-20 |
| AR-03-04 | T-03-10 | Bounded watchlist size makes the recomputation cost negligible | Phase 3 threat model (plan-time) | 2026-09-20 |
| AR-03-05 | T-03-11 | Ticker format validation upstream (Phase 2) plus React's SVG text escaping | Phase 3 threat model (plan-time) | 2026-09-20 |
| AR-03-06 | T-03-14 | Bounded position count keeps treemap layout cost negligible | Phase 3 threat model (plan-time) | 2026-09-20 |
| AR-03-07 | T-03-16 | Single-user demo scale; indexed reads avoid a table scan | Phase 3 threat model (plan-time) | 2026-09-20 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-20 | 19 | 12 | 0 | Orchestrator (grep-level L1 verification against current `main`, ASVS level 1, all threats plan-authored) |

Two mitigations (T-03-01, T-03-03) were strengthened after the original plan-time threat model was written, via the phase's own code-review fix cycle (03-REVIEW.md CR-01/WR-01) — the `isfinite()` guard and `BEGIN IMMEDIATE` write-lock respectively. Both are confirmed present in the current codebase, not merely claimed.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-20

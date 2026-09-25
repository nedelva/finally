---
phase: 01-live-price-terminal
verified: 2026-09-18T03:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files: [".gitignore", ".planning/REQUIREMENTS.md", ".planning/phases/01-live-price-terminal/01-01-PLAN.md", ".planning/phases/01-live-price-terminal/01-01-SUMMARY.md", ".planning/phases/01-live-price-terminal/01-02-PLAN.md", ".planning/phases/01-live-price-terminal/01-02-SUMMARY.md", ".planning/phases/01-live-price-terminal/01-03-PLAN.md", ".planning/phases/01-live-price-terminal/01-03-SUMMARY.md", ".planning/phases/01-live-price-terminal/01-04-PLAN.md", ".planning/phases/01-live-price-terminal/01-04-SUMMARY.md", ".planning/phases/01-live-price-terminal/01-05-PLAN.md", ".planning/phases/01-live-price-terminal/01-05-SUMMARY.md", ".planning/phases/01-live-price-terminal/01-UAT.md", "backend/app/main.py", "backend/app/market/__init__.py", "backend/app/market/cache.py", "backend/app/market/models.py", "backend/app/market/seed_prices.py", "backend/app/market/stream.py", "backend/tests/market/test_cache.py", "backend/tests/market/test_models.py", "backend/tests/market/test_stream.py", "backend/tests/test_main.py", "frontend/__tests__/ConnectionDot.test.tsx", "frontend/__tests__/MainChart.test.tsx", "frontend/__tests__/Sparkline.test.tsx", "frontend/__tests__/Watchlist.test.tsx", "frontend/__tests__/usePriceFlash.test.ts", "frontend/__tests__/usePriceStream.test.tsx", "frontend/app/globals.css", "frontend/app/layout.tsx", "frontend/app/page.tsx", "frontend/components/ConnectionDot.tsx", "frontend/components/Header.tsx", "frontend/components/MainChart.tsx", "frontend/components/Sparkline.tsx", "frontend/components/Watchlist.tsx", "frontend/components/WatchlistRow.tsx", "frontend/lib/PriceStreamContext.tsx", "frontend/lib/format.ts", "frontend/lib/types.ts", "frontend/lib/usePriceFlash.ts", "frontend/lib/usePriceStream.ts", "frontend/next.config.js", "frontend/package.json", "frontend/postcss.config.mjs", "frontend/tsconfig.json", "frontend/vitest.config.ts", "frontend/vitest.setup.ts"]
covered_digest: "v1:sha256:873d9d39cd32efca1b66c7ad0c59989adc451139ab96eadbb555b4c1dd18a4c0"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "MKT-03 sparklines rendered flat (cent-level price variance pinned below a zero-anchored Recharts domain) — fixed by adding an explicit domain={[\"dataMin\",\"dataMax\"]} YAxis in commit 0c8b7e1 (both render paths confirmed by direct read of Sparkline.tsx at current HEAD), re-tested by the user and confirmed working (01-UAT.md item 3: pass (after fix))"
    - "MKT-05 connection-dot self-recovery (the one behavior_unverified_items entry from the initial run — real EventSource network-drop recovery, which unit tests structurally cannot exercise) — confirmed by the user's live network-offline/online UAT test (01-UAT.md item 5: pass)"
    - "Remaining 5 of 7 human_verification items (MKT-01, MKT-02, MKT-04, disclosure visibility, no-portfolio-figures-in-header) — all confirmed pass in 01-UAT.md with no findings"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Live Price Terminal Verification Report

**Phase Goal:** The user opens http://localhost:8000 and watches the 10 default tickers stream live prices in a dark, Bloomberg-style terminal — making the already-built market-data engine visible for the first time.
**Verified:** 2026-09-18T03:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Sparkline Y-axis fix) and completed human UAT

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User loads the app at localhost:8000 and sees a watchlist grid of the 10 default tickers whose prices update continuously without manual refresh | ✓ VERIFIED | `DEFAULT_TICKERS` = the 10-ticker list (`backend/app/market/seed_prices.py`); `Watchlist.tsx` renders one row per `tickers` entry from `usePriceStreamContext()`; `backend/tests/test_main.py::test_first_frame_contains_all_default_tickers` and `frontend/__tests__/Watchlist.test.tsx` pass (re-run at current HEAD: backend 90/90, frontend 54/54). Human confirmation: `01-UAT.md` item 1 — pass. |
| 2 | A ticker's price flashes green on an uptick and red on a downtick, fading back to normal within roughly half a second | ✓ VERIFIED | `usePriceFlash.ts` sets `flash-up`/`flash-down`, clears via `setTimeout(..., 550)`; `usePriceFlash.test.ts` passes; keyframes in `globals.css`. Human confirmation: `01-UAT.md` item 2 — pass. |
| 3 | Each watchlist row carries a sparkline that fills in progressively as prices arrive after load | ✓ VERIFIED | `Sparkline.tsx` now renders an explicit `<YAxis hide domain={["dataMin","dataMax"]} />` on both render paths (commit `0c8b7e1`), replacing the earlier zero-anchored default domain that pinned cent-level price variation below the visible chart height — confirmed by direct read of `Sparkline.tsx` at current HEAD, not just the commit message. Note: `Sparkline.test.tsx`'s "renders an SVG path for 3+ points" assertion passed both before and after this fix (a flat line is still a `<path>`), so the green suite alone does not certify truth 3 — the operative evidence is the user's visual re-test. Human confirmation: `01-UAT.md` item 3 — initially failed ("sparklines rendered flat"), root-caused, fixed, re-tested — pass (after fix). |
| 4 | Clicking a ticker in the watchlist draws a larger price chart for that ticker in the main chart area | ✓ VERIFIED | `WatchlistRow` exposes `onSelect`; `page.tsx` holds `selectedTicker` state, passes history to `MainChart`; `MainChart.test.tsx` passes. Human confirmation: `01-UAT.md` item 4 — pass. |
| 5 | The header shows a connection dot that is green while streaming, changes colour when the stream drops, and returns to green by itself once the browser reconnects | ✓ VERIFIED | `ConnectionDot.tsx` renders green/amber/red from the `status` prop, sourced only from the real `EventSource`'s `onopen`/`onerror` (`usePriceStream.ts`) — no hand-rolled reconnect loop. `usePriceStream.test.tsx` proves the connecting→connected→reconnecting mapping under a mocked EventSource; the real-network self-recovery leg (previously ⚠️ PRESENT_BEHAVIOR_UNVERIFIED — jsdom has no real network stack to exercise this) is now confirmed by the user's live devtools-offline/online test: `01-UAT.md` item 5 — pass ("dot leaves green while offline, returns to green by itself, no reload"). |

**Score:** 5/5 roadmap truths VERIFIED. All 7 human_verification items from the initial run (`01-UAT.md`) now pass, closing the one previously-deferred behavior (MKT-05 self-recovery) and the one regression found during human testing (MKT-03 flat sparklines).

### What Changed Since the Initial Verification Run

Initial run (2026-09-18T02:45:00Z) scored 4/5 automated and routed to `human_needed` with 7 items deferred to end-of-phase human UAT (per `workflow.human_verify_mode: end-of-phase`), including the one behavior automated tests structurally cannot exercise (MKT-05's real-network self-recovery).

The user then ran all 7 UAT items (`01-UAT.md`) and found one issue: **MKT-03 sparklines rendered flat.** Root cause: `frontend/components/Sparkline.tsx` had no `<YAxis>`. Recharts defaults an unrendered axis's domain to `[0, dataMax]` — for a ~$150–250 stock with cent-level fluctuations, that pins nearly the entire visible price range below the chart, so the line reads as flat. `MainChart.tsx` already avoided this with an explicit `domain={["auto","auto"]}` YAxis; `Sparkline.tsx` never got the same treatment.

**Files changed between the initial verification and this re-verification** (`git log --name-only b2a0aca~1..HEAD -- backend frontend`): `backend/app/market/cache.py`, `backend/tests/test_main.py`, `frontend/__tests__/MainChart.test.tsx`, `frontend/__tests__/Watchlist.test.tsx`, `frontend/components/Sparkline.tsx`, `frontend/components/WatchlistRow.tsx`. All six were re-scanned for debt markers in this pass (`grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"`) — none found.

**Fix verified in this re-verification pass:**
- Read `frontend/components/Sparkline.tsx` at current HEAD directly: confirmed `import { ..., YAxis } from "recharts"`, a `priceYAxis()` helper returning `<YAxis hide domain={["dataMin", "dataMax"]} />`, and that helper is called in **both** render branches (explicit-dimensions `<LineChart>` and `<ResponsiveContainer>` paths) — matches `git show 0c8b7e1`'s diff, no partial application.
- Read `frontend/components/WatchlistRow.tsx` at current HEAD directly (not just `01-REVIEW-FIX.md`'s description of the WR-01 fix): confirmed no `role` attribute is present on the row, so native `<tr>` row semantics hold as claimed.
- Read `backend/app/market/cache.py` at current HEAD directly: confirmed line 35 is `ts = timestamp if timestamp is not None else time.time()` (the WR-02 fix, commit `db5168c`), replacing the earlier `timestamp or time.time()` that would have silently discarded an explicit `timestamp=0.0`. This sits on the timestamp path behind the session-anchor/percent-change truths (01-03 row below); covered by `test_cache.py`'s 16 tests within the green 90/90 backend run.
- Re-ran the full frontend suite at current HEAD: **54/54 pass** (unchanged count from the pre-fix run).
- Re-ran `npm run typecheck` (clean) and `npm run build` (succeeds, static export regenerated) at current HEAD.
- Re-ran the full backend suite at current HEAD: **90/90 pass**.
- Re-ran the disclosure-string check against the freshly rebuilt export in this pass (not reused from the prior run): `grep -o "Simulated market data" frontend/out/index.html` → match found.
- The user re-tested the running application against the rebuilt frontend and confirmed the fix in `01-UAT.md` (item 3: `result: pass (after fix)`), and separately confirmed all 7 items now pass with 0 issues (`01-UAT.md` frontmatter: `status: complete`, `passed: 7`, `issues: 0`).

This specific defect class (a line technically renders but reads as visually flat) is not currently covered by an automated assertion — `Sparkline.test.tsx` checks that a `<path>` element exists, not the vertical span of its `d` attribute or the `YAxis` domain prop, so a deterministic regression test (e.g. asserting the rendered path's bounding box spans a non-trivial fraction of the chart height for varying input) is a cheap, addable follow-up. It was, correctly, caught by human UAT this time — that is the expected shape of a UAT-caught regression, not an audit gap.

### Merged Plan-Level Must-Haves (01-01 through 01-05 frontmatter)

Unchanged from the initial run except for the callouts below. All plan-level `must_haves.truths` and `prohibitions` remain ✓ VERIFIED at current HEAD: backend 90/90 pytest, frontend 54/54 vitest (both re-run in this pass), `npm run typecheck` clean, `npm run build` succeeds, freshly-rebuilt export still contains "Simulated market data" (re-checked in this pass).

| Plan | Truth (abbreviated) | Status | Evidence |
|------|---------------------|--------|----------|
| 01-01 | `frontend/lib/` no longer `.gitignore`-excluded; 6+ modules tracked | ✓ VERIFIED | Unchanged from initial run |
| 01-01 | `node_modules/`, `out/` excluded | ✓ VERIFIED | Unchanged |
| 01-01 | Static export builds to `frontend/out/index.html` | ✓ VERIFIED | Re-confirmed: `npm run build` succeeds at current HEAD |
| 01-01 | Price up/down yields flash-up/flash-down, clears ~550ms; unchanged price yields no flash | ✓ VERIFIED | Unchanged; human-confirmed `01-UAT.md` item 2 |
| 01-02 | One uvicorn process serves API + built frontend; `/` returns export, `/api/health` returns 200 | ✓ VERIFIED | Unchanged |
| 01-02 | Market data source starts/stops with app lifespan | ✓ VERIFIED | Unchanged |
| 01-02 | SSE frame contains all 10 tickers, each with exactly 7 `PriceTick` fields | ✓ VERIFIED | Unchanged |
| 01-02 | App boots and `/api/health` works when static dir absent | ✓ VERIFIED | Unchanged |
| 01-02 | Exactly one EventSource for the whole app, closed on unmount, no leak on remount | ✓ VERIFIED | Unchanged |
| 01-02 | Price history append-only, chronological, duplicates retained | ✓ VERIFIED | Unchanged |
| 01-02 | History capped at `PRICE_HISTORY_LIMIT`, oldest evicted past limit | ✓ VERIFIED | Unchanged |
| 01-02 | Connection status: connecting → connected → reconnecting per browser events | ✓ VERIFIED | Mapping verified by test; self-recovery now human-confirmed (`01-UAT.md` item 5) |
| 01-02 | Prohibition: simulated data must be disclosed | ✓ VERIFIED | Re-checked against fresh export in this pass; human-confirmed visible on screen: `01-UAT.md` item 6 |
| 01-03 | Two `create_stream_router()` calls produce independent, non-cross-contaminating routers | ✓ VERIFIED | Unchanged |
| 01-03 | Empty-cache read never consumes the version generation | ✓ VERIFIED | Unchanged |
| 01-03 | Idle connection gets a periodic keepalive comment | ✓ VERIFIED | Unchanged |
| 01-03 | Session % change anchored to session-open price, not tick-to-tick | ✓ VERIFIED | `cache.py` changed in `db5168c` (falsy-zero timestamp fix, read directly at HEAD); covered by `test_cache.py` (16/16) within the green 90/90 run |
| 01-03 | Removing and re-adding a ticker resets its session anchor | ✓ VERIFIED | Unchanged |
| 01-03 | SSE payload still exactly 7 fields (no frontend type drift) | ✓ VERIFIED | Unchanged |
| 01-04 | Dark grid, one row per ticker, symbol/price/session-% | ✓ VERIFIED | Unchanged |
| 01-04 | Rows update from shared stream, no per-row connection | ✓ VERIFIED | Unchanged |
| 01-04 | Missing price renders em dash, not 0/blank/NaN | ✓ VERIFIED | `frontend/lib/format.ts` read directly at current HEAD: `formatPrice`/`formatPercent`/`formatMoney`/`formatQuantity`/`formatTime`/`formatClock` all null/NaN-guard to `"—"` |
| 01-04 | Sparkline safe at 0/1/N points, and now correctly scaled to the data range | ✓ VERIFIED | Fixed in `0c8b7e1`; re-verified by direct code read + passing tests + human re-test |
| 01-04 | All numbers via shared null-safe formatters | ✓ VERIFIED | `format.ts` functions confirmed used in `WatchlistRow.tsx`, `MainChart.tsx` |
| 01-04 | Prohibition: disclosure survives the rewrite | ✓ VERIFIED | Unchanged |
| 01-05 | Dot green/amber/red per status, machine-readable via `data-status`/`aria-label` | ✓ VERIFIED | Unchanged |
| 01-05 | Dot self-recovers via native EventSource retry, no hand-rolled loop | ✓ VERIFIED | Mapping verified by test; live self-recovery now human-confirmed (`01-UAT.md` item 5 — pass) |
| 01-05 | Click selects ticker, draws chart; selected row visually distinguished | ✓ VERIFIED | Unchanged; `WatchlistRow.tsx` re-read at HEAD, no `role` attribute (native row semantics), `aria-selected` + background class present |
| 01-05 | Chart has labelled axes + tooltip; safe with no selection / empty history | ✓ VERIFIED | Unchanged |
| 01-05 | No portfolio total / cash balance in header | ✓ VERIFIED | Human-confirmed: `01-UAT.md` item 7 — pass |
| 01-05 | Prohibition: header carries disclosure | ✓ VERIFIED | Unchanged |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.gitignore` | Node exclusions added, `lib/` narrowed | ✓ VERIFIED | Unchanged |
| `frontend/package.json`, `next.config.js`, `tsconfig.json`, `postcss.config.mjs` | Scaffold config | ✓ VERIFIED | Build/typecheck/test succeed at current HEAD |
| `frontend/app/globals.css` | Theme tokens + flash keyframes | ✓ VERIFIED | Unchanged |
| `backend/app/main.py` | `create_app`, `resolve_static_dir`, `STATIC_DIR_ENV_VAR`, `app` | ✓ VERIFIED | Unchanged |
| `backend/app/market/seed_prices.py` | `DEFAULT_TICKERS` (10 tickers) | ✓ VERIFIED | Unchanged |
| `backend/app/market/cache.py` | `PriceCache.update()`, falsy-zero timestamp fix | ✓ VERIFIED | Read directly at HEAD; `test_cache.py` 16/16 pass |
| `frontend/lib/usePriceStream.ts` | `usePriceStream`, `PRICE_HISTORY_LIMIT` | ✓ VERIFIED | Unchanged |
| `frontend/lib/PriceStreamContext.tsx` | `PriceStreamProvider`, `usePriceStreamContext` | ✓ VERIFIED | Unchanged |
| `frontend/lib/format.ts` | Null-safe numeric/time formatters | ✓ VERIFIED | Read directly at HEAD; all six exports null/NaN-guard |
| `frontend/components/Watchlist.tsx`, `WatchlistRow.tsx`, `Sparkline.tsx` | Grid, row, sparkline | ✓ VERIFIED | Both `WatchlistRow.tsx` (WR-01 fix) and `Sparkline.tsx` (YAxis fix) read directly at current HEAD, not inferred from fix reports |
| `frontend/components/ConnectionDot.tsx`, `Header.tsx`, `MainChart.tsx` | Status dot, header, chart | ✓ VERIFIED | Unchanged |
| `backend/app/market/stream.py`, `models.py`, `cache.py` | SSE router factory, dual-anchor model, session tracking | ✓ VERIFIED | `cache.py` re-read at HEAD (see above); `stream.py`/`models.py` unchanged |
| `.planning/phases/01-live-price-terminal/01-UAT.md` | Human verification record, all 7 items resolved | ✓ VERIFIED | `status: complete`, `passed: 7`, `issues: 0` |
| Test files (backend `tests/market/test_stream.py`, `test_models.py`, `test_cache.py`, `tests/test_main.py`; frontend `__tests__/*.test.ts(x)`) | Behavioural coverage | ✓ VERIFIED | 90 backend + 54 frontend tests, all passing (re-run at current HEAD by this verifier) |

### Key Link Verification

Unchanged from the initial run — all key links (SSE router mount, market source lifespan wiring, static file fallback chain, `EventSource` same-origin path, context provider wiring, flash-hook wiring, formatter wiring, sparkline data-prop wiring, watchlist grid mount, header/dot wiring, row-selection-to-chart wiring) remain ✓ WIRED at current HEAD; none of the fix commits (`0c8b7e1`, `7a45ea8`, or the earlier review-fix commits) touch any of these connection points — confirmed by the `git log --name-only` diff above, which shows only 6 files changed, none of them wiring/mount points.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `Watchlist.tsx` rows | `ticks[ticker]`, `history[ticker]` | `usePriceStreamContext()` → `usePriceStream()` → real `EventSource` against `/api/stream/prices` → `PriceCache` fed by `SimulatorDataSource` (GBM) | Yes | ✓ FLOWING |
| `Sparkline.tsx` (via `WatchlistRow`) | `data` prop → `<LineChart>` `dataKey="price"`, now scaled via `domain={["dataMin","dataMax"]}` YAxis | Same live `history[ticker]` slice as above — the fix changed only how the existing real data is scaled, not its source | Yes | ✓ FLOWING |
| `MainChart.tsx` | `history` prop | `page.tsx` slices `history[selectedTicker]` from the same live stream state | Yes | ✓ FLOWING |
| `Header.tsx` | `status` prop | `usePriceStreamContext().status`, derived from real `EventSource.onopen`/`onerror` | Yes | ✓ FLOWING |
| `backend` SSE payload | `price_cache.get_all()` | `PriceCache` written by `SimulatorDataSource` (GBM per-tick generation), not a static/mock return | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend full test suite (current HEAD) | `uv run --extra dev pytest -q` (run once) | `90 passed, 2 warnings` | ✓ PASS |
| Frontend full test suite (current HEAD) | `npm run test -- --run` (run once) | `Test Files 6 passed (6)`, `Tests 54 passed (54)` | ✓ PASS |
| Frontend typecheck (current HEAD) | `npm run typecheck` | exit 0, no output | ✓ PASS |
| Frontend production build (current HEAD) | `npm run build` | Compiled successfully, static export regenerated | ✓ PASS |
| Simulated-data disclosure in freshly rebuilt export | `grep -o "Simulated market data" frontend/out/index.html` (re-run in this pass, not reused) | Match found | ✓ PASS |
| Sparkline fix present in both render paths | `git show 0c8b7e1` + direct read of `Sparkline.tsx` | `priceYAxis()` helper defined and called in both the explicit-dimensions and `ResponsiveContainer` branches | ✓ PASS |
| WatchlistRow native row semantics (WR-01) | Direct read of `WatchlistRow.tsx` | No `role` attribute present | ✓ PASS |
| cache.py falsy-zero timestamp fix (WR-02) | Direct read of `cache.py` line 35 | `ts = timestamp if timestamp is not None else time.time()` | ✓ PASS |
| Debt-marker scan on files changed since initial run | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` over the 6 changed files | No matches | ✓ PASS |
| Live browser terminal (streaming, flash, sparkline fill — post-fix, chart draw, dot self-recovery, disclosure visibility, no header $-figures) | N/A — live browser session against running server, network-offline/online toggle | Executed by the user; recorded in `01-UAT.md` — 7/7 pass, 0 issues | ✓ PASS (human-executed, evidence on file) |

### Probe Execution

SKIPPED (no probes declared in any plan; no `scripts/*/tests/probe-*.sh` files exist in the repo — unchanged from initial run).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MKT-01 | 01-02, 01-03, 01-04 | Watchlist of 10 default tickers, live-updating via SSE | ✓ SATISFIED | Automated tests + `01-UAT.md` item 1 |
| MKT-02 | 01-01, 01-04 | Flash green/red on price change, fading | ✓ SATISFIED | Automated tests + `01-UAT.md` item 2 |
| MKT-03 | 01-04 | Sparkline mini-chart per row, accumulated from SSE since page load | ✓ SATISFIED | Fixed (`0c8b7e1`, confirmed by direct code read) + automated tests + `01-UAT.md` item 3 (pass after fix) |
| MKT-04 | 01-05 | Click ticker → larger detailed chart | ✓ SATISFIED | Automated tests + `01-UAT.md` item 4 |
| MKT-05 | 01-05 | Connection-status dot reflecting SSE state, auto-reconnect | ✓ SATISFIED | Automated mapping tests + `01-UAT.md` item 5 (real network-drop self-recovery, human-confirmed) |

`REQUIREMENTS.md` marks all five as `[x]` complete with `Status: Complete` in its traceability table (lines 12–16, 72–76), consistent with this verification. No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly MKT-01 through MKT-05 to Phase 1, and all five appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in any of the 6 files changed since the initial verification run (`cache.py`, `test_main.py`, `MainChart.test.tsx`, `Watchlist.test.tsx`, `Sparkline.tsx`, `WatchlistRow.tsx`), grepped directly in this pass | — | none |
| `frontend/lib/api.ts`, `hooks.ts`, `positionMath.ts` | whole files | Dead code — no callers, no tests anywhere in the current tree (built ahead of Phase 3, per PLAN.md) | ℹ️ Info | Unchanged from initial run; not touched by any post-initial-verification commit. Documented in `01-REVIEW-FIX.md` as WR-03 (skipped, deferred to human/orchestrator triage) — not a phase-goal blocker. |
| `frontend/components/Sparkline.tsx`, `MainChart.tsx` | several | Hardcoded hex colours instead of CSS theme tokens (Recharts SVG presentation attributes don't resolve CSS custom properties) | ℹ️ Info | Documented, justified rationale in `01-UI-REVIEW.md` Pillar 3; does not affect functional correctness of any of the 5 success criteria. |

The one BLOCKER from `01-UI-REVIEW.md` (`role="button"` on `<tr>`) remains fixed (WR-01, commit `b2a0aca`) — re-confirmed in this pass by direct read of `WatchlistRow.tsx` at current HEAD (no `role` attribute present).

### Human Verification Required

None outstanding. All 7 items deferred by the initial verification run were executed by the user and recorded in `01-UAT.md` (`status: complete`, `passed: 7`, `issues: 0`, `pending: 0`, `blocked: 0`). One issue was found during UAT (MKT-03 flat sparklines), root-caused, fixed (`0c8b7e1`), and re-tested as passing.

### Gaps Summary

No gaps. This re-verification confirms, by direct inspection of current-HEAD source (not by trusting SUMMARY/fix-report narration):

1. The single UAT-found defect (MKT-03 flat sparklines) has a real, correctly-scoped fix at current HEAD — read directly from `Sparkline.tsx`, matched against the commit diff, applied to both render paths, with no shortcuts. The automated test suite does not itself distinguish flat from non-flat rendering (a `<path>` element exists either way), so the fix's correctness rests on the human re-test in `01-UAT.md`, not on the green suite — stated plainly rather than implied.
2. The fix, and the three review-fix commits that landed alongside it (WR-01 `WatchlistRow.tsx`, WR-02 `cache.py`, WR-04 `test_main.py`), introduced no regressions: full backend (90/90) and frontend (54/54) suites, typecheck, and production build all remain green at current HEAD, and all changed files were individually re-read (not just cited from prior reports) and re-scanned for debt markers.
3. The previously-deferred behavior (MKT-05 real-network self-recovery, ⚠️ PRESENT_BEHAVIOR_UNVERIFIED in the initial run because jsdom cannot exercise a real network drop) is now confirmed by the user's live test in `01-UAT.md`, closing the last open item.
4. All 5 roadmap success criteria (MKT-01 through MKT-05) are now ✓ VERIFIED — 4 by a combination of automated tests plus human confirmation of the visual/timing aspects tests can't see, and MKT-05 additionally by the human-executed real-network test that is the only way to observe genuine browser-level self-recovery.
5. Requirements coverage, security (`01-SECURITY.md`: `threats_open: 0`), and Nyquist validation (`01-VALIDATION.md`: 0 gaps) all remain clean and unaffected by the fix.

Phase 1 goal achieved: the user can open http://localhost:8000 and watch the 10 default tickers stream live prices in a dark, Bloomberg-style terminal, with flashing price updates, progressively-filling sparklines (now correctly scaled), a clickable detailed chart, and a connection-status dot that genuinely self-recovers after a real network interruption.

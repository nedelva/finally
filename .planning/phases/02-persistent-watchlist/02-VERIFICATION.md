---
phase: 02-persistent-watchlist
verified: 2026-09-19T16:20:00Z
status: passed
score: 41/41 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/ROADMAP.md", ".planning/debug/add-ticker-405-g02-2.md", ".planning/debug/remove-button-hit-area-g02-4.md", ".planning/debug/watchlist-empty-on-load.md", ".planning/debug/watchlist-load-error-silent.md", ".planning/debug/watchlist-scroll-chart-height-g02-5.md", ".planning/phases/02-persistent-watchlist/02-01-PLAN.md", ".planning/phases/02-persistent-watchlist/02-01-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-02-PLAN.md", ".planning/phases/02-persistent-watchlist/02-02-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-03-PLAN.md", ".planning/phases/02-persistent-watchlist/02-03-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-04-PLAN.md", ".planning/phases/02-persistent-watchlist/02-04-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-05-PLAN.md", ".planning/phases/02-persistent-watchlist/02-05-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-SECURITY.md", ".planning/phases/02-persistent-watchlist/02-UAT.md", ".planning/phases/02-persistent-watchlist/02-UI-REVIEW.md", ".planning/phases/02-persistent-watchlist/02-UI-SPEC.md", ".planning/phases/02-persistent-watchlist/02-VALIDATION.md", "backend/app/api/watchlist.py", "backend/app/db/connection.py", "backend/app/db/init.py", "backend/app/db/repository.py", "backend/app/db/schema.py", "backend/app/main.py", "backend/app/market/simulator.py", "backend/app/market/ticker.py", "db/.gitkeep", "frontend/__tests__/Watchlist.test.tsx", "frontend/app/page.tsx", "frontend/components/Watchlist.tsx", "frontend/components/WatchlistRow.tsx", "frontend/lib/hooks.ts"]
covered_digest: "v1:sha256:68cbf606ed8d8c7d0ae08949e715702ea0cc3d460a3d041d3e5da9535f9a8316"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 35/41
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  human_items_resolved:
    - item: "Live re-test of G-02-4 (remove-button hit area) — confirmed PASS live (02-UAT.md test 6, result: pass)."
    - item: "Live re-test of G-02-5 (watchlist scroll / chart-height decoupling) — confirmed PASS live (02-UAT.md test 7, result: pass)."
    - item: "Concurrent same-ticker add race — confirmed both via live user report (02-UAT.md test 8, result: pass) AND independently re-run by this verifier against the live dev server (port 8000, process started 2026-09-19T12:52, i.e. after the last backend commit 70072a5 on 2026-09-18 — so the code under test is HEAD): two truly concurrent POST /api/watchlist for ticker QQQQ9 returned exactly one 201 and one 409 (\"QQQQ9 is already on your watchlist.\"), and the watchlist ended with exactly one QQQQ9 row."
    - item: "P-02-01/P-02-02a/P-02-02b/P-02-03 (4 judgment-tier prohibitions) — explicitly reviewed and signed off by the user against the code evidence gathered this session. See prohibitions_signoff below."
  human_items_still_open: []
prohibitions_signoff:

  - statement: "P-02-01 — MUST NOT present a fabricated, zero, or stale-guess price for a ticker the price cache cannot price."
    plan: "02-01"
    verification: judgment
    evidence: "backend/app/api/watchlist.py build_watchlist() (lines 40-50) emits price=None, previous_price=None, change=None, change_percent=None, direction=\"flat\" on cache miss — no fabrication path found."
    accepted_by: "user"
    accepted_at: "2026-09-19T16:20:00Z"
  - statement: "P-02-02a — MUST NOT silently substitute, auto-correct, or fuzzy-match a submitted ticker into a different symbol than the user typed."
    plan: "02-02"
    verification: judgment
    evidence: "backend/app/market/ticker.py normalize_ticker() (lines 19-25) is exactly raw.strip().upper() — no substitution/fuzzy-match logic anywhere in the shared normalization path."
    accepted_by: "user"
    accepted_at: "2026-09-19T16:20:00Z"
  - statement: "P-02-02b — MUST NOT silently drop an accepted ticker, or enforce an undocumented maximum watchlist size by discarding entries."
    plan: "02-02"
    verification: judgment
    evidence: "grep across backend/app/api/watchlist.py and backend/app/db/repository.py for length/count/cap/limit logic on inserts returns zero matches — no capacity-limiting code exists on the add path."
    accepted_by: "user"
    accepted_at: "2026-09-19T16:20:00Z"
  - statement: "P-02-03 — MUST NOT let removing a ticker from the watchlist delete or mutate any row outside the watchlist table."
    plan: "02-03"
    verification: judgment
    evidence: "Dedicated passing test backend/tests/api/test_watchlist.py::test_remove_does_not_touch_positions_trades_snapshots_or_chat_messages, reconfirmed passing this session (139/139 backend suite green)."
    accepted_by: "user"
    accepted_at: "2026-09-19T16:20:00Z"
---

# Phase 02: Persistent Watchlist Verification Report (Re-Verification — Closed)

**Phase Goal:** The user controls which tickers they watch, and that choice — along with the rest of the app's state — now lives in a real SQLite database instead of memory
**Verified:** 2026-09-19T16:20:00Z
**Status:** passed
**Re-verification:** Yes — closing out the 3 items left open by the prior verification (2026-09-19T15:05:00Z, status human_needed, 35/41), using 02-UAT.md's completed retest (tests 6-8), this session's own independent adversarial checks, and the user's explicit sign-off on the 4 judgment-tier prohibitions surfaced during this pass.

## What Changed Since the Prior Verification

`git diff --stat 0a53fd4..HEAD` (the prior verification's commit through this session) touches exactly one source-of-truth file: `.planning/phases/02-persistent-watchlist/02-UAT.md` (48 lines changed — tests 6, 7, 8 added with results, summary block updated to `total: 8, passed: 6, issues: 2, pending: 0`). **No backend or frontend source file changed.** This means:

- The prior verification's 35/41 code-level findings all carry forward unchanged (re-confirmed this session: `uv run pytest` → 139 passed; `npm run test -- Watchlist` → 44/44 passed).
- The only things that could newly resolve are exactly what UAT tests 6-8, this session's independent checks, and the user's explicit prohibition sign-off cover.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (primary contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User adds a ticker and it appears in the grid and starts streaming prices within seconds | ✓ VERIFIED | Unchanged since prior pass (no code diff); UAT test 2 confirmed live, "happy with it" apart from the now-fixed hit area. |
| 2 | User removes a ticker and it disappears from the grid and stops receiving updates | ✓ VERIFIED | Unchanged; UAT test 2 confirmed removal correctness live; UAT test 6 confirms the remove control itself is now reliably clickable. |
| 3 | Reloading the browser shows the user's own watchlist, not the built-in default list | ✓ VERIFIED | Unchanged; UAT test 1 passed live. |
| 4 | A malformed or empty ticker entry is rejected with a visible message and leaves the watchlist unchanged | ✓ VERIFIED | Unchanged; `Watchlist.test.tsx` validation tests still passing (44/44 this session). |

**ROADMAP score:** 4/4 success criteria hold.

### Score Reconciliation (35/41 → 41/41)

All 6 previously-open items across the prior verification's `behavior_unverified_items` (1) and `human_verification` (5, after merging the superseded 02-01 no-scroll item into the G-02-5 check) now resolve:

1. **G-02-4 (remove-button hit area)** — UAT test 6: `result: pass`. Closes the 02-05 D1-D3 code/unit-tested-only items (hit box, color affordance, focus ring) with live confirmation. **+3** (34→37, folding in the 02-05 D5 UI-SPEC-text truth already counted at 35).
2. **G-02-5 (watchlist scroll / chart-height decoupling)** — UAT test 7: `result: pass`, explicitly noting it also closes 02-01's original "no-scroll/max-size" must-have. **+2** (the 02-05 D4 truth plus the superseded 02-01 truth). 37→39.
3. **Concurrent same-ticker add race (02-02 backstop)** — UAT test 8: `result: pass`, AND independently reproduced by this verifier this session (see Behavioral Spot-Checks) against the live dev server confirmed to be running HEAD backend code. This flips from `behavior_unverified` (present+wired, untested) to `✓ VERIFIED` on direct observed-behavior evidence, per Step 5b's acceptance of directly observed behavior for a backstop item. **+1**. 39→40.

Reconciling against the prior report's own stated denominator: prior score was 35/41 with 1 behavior-unverified + 5 human-verification-listed (2 of which, the 02-01 no-scroll item and 02-05 D4, were explicitly noted as "the same underlying concern... not double-verified"). Resolving all of: 02-05 D1-D4 (4 truths) + the concurrency backstop (1 truth) + the already-superseded 02-01 item (counted once, not twice, consistent with the prior report's own accounting) accounts for the remaining 6 → **35 + 6 = 41/41.**

**Score:** 41/41 truths verified. 0 present-but-behavior-unverified.

### Independent Verification of the Concurrency Item (not just trusting the report)

Per this project's adversarial-verification requirement, this was re-run independently rather than accepted on the strength of the report alone:

1. Confirmed the dev server on port 8000 (PIDs 31883/31885, started `2026-09-19T12:50:58`) started **after** the last backend commit (`70072a5`, `2026-09-18T13:30:01`) — so the code under test is HEAD, not a stale process (the exact failure mode that produced the false G-02-2 finding earlier in this phase).
2. Fired two genuinely concurrent `POST /api/watchlist` requests (shell background jobs, `wait`) for a fresh ticker (`QQQQ9`).
3. Result: one `201` (`{"ticker":"QQQQ9", ...}`), one `409` (`{"error":"QQQQ9 is already on your watchlist."}`), and `GET /api/watchlist` afterward shows **exactly one** `QQQQ9` row. Cleaned up via `DELETE`.

This matches the UAT-reported result exactly and independently confirms the `UNIQUE(user_id, ticker)` constraint + `IntegrityError → 409` translation holds under real concurrency.

### Prohibitions (must_haves.prohibitions — now signed off, resolved)

Re-scanned this session across all 5 plan files' frontmatter (`grep -n "prohibitions:" -A20 02-0{1..5}-PLAN.md`). **4 prohibitions total, all `status: resolved` in frontmatter, all `verification: judgment`** (none declared `verification: test`, so the test-tier fail-closed path does not apply here):

| ID | Statement (abbreviated) | Plan | This session's independent code evidence | Sign-off |
|----|--------------------------|------|---------------------------------------------|----------|
| P-02-01 | No fabricated/stale price for an uncached ticker | 02-01 | `build_watchlist()` emits `price: None, direction: "flat"` on cache miss (watchlist.py:40-50) — no fabrication path found. | ✓ Signed off by user, 2026-09-19T16:20:00Z |
| P-02-02a | No silent ticker substitution/fuzzy-match | 02-02 | `normalize_ticker()` is exactly `raw.strip().upper()` (ticker.py:19-25) — nothing else. | ✓ Signed off by user, 2026-09-19T16:20:00Z |
| P-02-02b | No silent drop / undocumented max watchlist size | 02-02 | `grep` for cap/limit/count logic across `watchlist.py` + `repository.py` returns zero matches. | ✓ Signed off by user, 2026-09-19T16:20:00Z |
| P-02-03 | No cascading delete beyond `watchlist` table | 02-03 | Dedicated passing test `test_remove_does_not_touch_positions_trades_snapshots_or_chat_messages` (confirmed passing this session, 139/139 backend suite green). | ✓ Signed off by user, 2026-09-19T16:20:00Z |

Per this project's verifier contract (ADR-550 D3/D4), a judgment-tier prohibition's frontmatter `status: resolved` alone (set by an earlier automated/LLM security audit — `02-SECURITY.md`, "Run By: /gsd-secure-phase," a grep-level check, not a human sign-off) is explicitly non-authoritative and must never be silently absorbed into a `passed` verdict. This session surfaced that gap (the prior report had flagged these only in prose, never routed them into its `human_verification:` frontmatter), presented the underlying code evidence for all four, and the user has now explicitly reviewed and signed off on each — recorded in `prohibitions_signoff` above. With this sign-off, no must-have of any kind remains open.

### Code Review / Anti-Pattern Findings

- **Debt-marker scan (this session, full phase surface):** `grep -rn -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all `covered_files` code paths (backend + frontend, excluding docs) — zero matches (the one `placeholder=` hit in `WatchlistRow.tsx`/`Watchlist.tsx` is the legitimate HTML attribute). No BLOCKER.
- **No new anti-patterns found this session.** Since no source file changed since the prior pass, the prior report's carried-forward advisories stand unchanged (WR-01 no in-UI retry on load error — declared trade-off; WR-02 no `role="alert"`/`aria-live`; `WatchlistRow.tsx`'s `<tr>` still has no focus-visible ring at the row level, distinct from the button-level ring added by 02-05). None are blocking.

### Required Artifacts

All artifacts unchanged and re-confirmed present since the prior pass (no source diff): `backend/app/api/watchlist.py`, `backend/app/db/{connection,init,repository,schema}.py`, `backend/app/market/{simulator,ticker}.py`, `frontend/components/{Watchlist,WatchlistRow}.tsx`, `frontend/app/page.tsx`, `frontend/lib/hooks.ts`, `frontend/__tests__/Watchlist.test.tsx`. ✓ VERIFIED (carried forward, `git diff --stat 0a53fd4..HEAD` confirms zero source changes).

### Key Link Verification

Unchanged and carried forward from the prior verification (no source diff since). All links previously ✓ WIRED remain so; the two "code-level, pending real-browser confirmation" links (remove-button hit box, chart-height decoupling) are now upgraded to fully ✓ WIRED + live-confirmed via UAT tests 6-7.

### Data-Flow Trace (Level 4)

Unchanged: `Watchlist.tsx` grid rows still flow from `useWatchlist()` → `GET /api/watchlist` → SQLite `watchlist` table. ✓ FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend full suite | `uv run pytest -q` (from `backend/`) | `139 passed, 2 warnings` | ✓ PASS |
| Frontend `Watchlist` test file | `npm run test -- Watchlist` (from `frontend/`) | `44 passed (44)` | ✓ PASS |
| Source diff since prior verification | `git diff --stat 0a53fd4..HEAD` | Only `02-UAT.md` changed | ✓ PASS — confirms no regression risk |
| Concurrent same-ticker add race (independent re-run, not trusting the report) | Two truly concurrent `curl -X POST http://localhost:8000/api/watchlist` for `QQQQ9` | `201` + `409`, exactly 1 row afterward | ✓ PASS |
| Dev server freshness check (avoids the G-02-2 stale-process trap) | `ps -eo pid,lstart,command \| grep uvicorn` vs `git log -1 -- backend/` | Server PID 31883 started `2026-09-19T12:50:58`, after last backend commit `70072a5` (`2026-09-18T13:30:01`) | ✓ PASS — confirms the concurrency test ran against HEAD code |
| Debt-marker scan | `grep -rn -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | Zero non-attribute matches | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|--------------|--------|----------|
| WTCH-01 | User can add a ticker to the watchlist manually | ✓ SATISFIED | Unchanged; add path fully live-confirmed (UAT tests 2, 6). |
| WTCH-02 | User can remove a ticker from the watchlist manually | ✓ SATISFIED | Unchanged; remove path fully live-confirmed, including the previously-defective hit area (UAT tests 2, 6). |

No orphaned requirements.

### Anti-Patterns Found

None (BLOCKER-level). See Code Review section above.

### Human Verification Required

None. All 4 judgment-tier prohibitions (P-02-01, P-02-02a, P-02-02b, P-02-03) have been explicitly reviewed and signed off by the user this session against the code evidence gathered — see `prohibitions_signoff` in the frontmatter. All other truths were already code/test/live-verified. No human verification items remain open.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria hold, both at the code level and via live UAT (8/8 tests now resolved — 6 clean passes, 2 that surfaced real issues which were fixed by plan 02-05 and re-confirmed passing on retest). All 41 plan-level must-have truths are verified, including the 3 items left open by the prior verification pass (G-02-4, G-02-5, concurrency backstop), the last of which this verifier also independently reproduced against a freshness-checked live server rather than relying solely on the reported evidence. The 4 judgment-tier prohibitions surfaced during this pass (a gap in the prior report's own frontmatter, corrected here) have been reviewed against the code evidence gathered and explicitly signed off by the user.

**Phase 02 is verified complete.** No further human action is required to close this phase.

---

_Verified: 2026-09-19T16:20:00Z_
_Verifier: Claude (gsd-verifier)_

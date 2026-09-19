---
phase: 02-persistent-watchlist
verified: 2026-09-19T15:05:00Z
status: human_needed
score: 35/41 must-haves verified
covered_files: [".planning/REQUIREMENTS.md", ".planning/ROADMAP.md", ".planning/debug/add-ticker-405-g02-2.md", ".planning/debug/remove-button-hit-area-g02-4.md", ".planning/debug/watchlist-empty-on-load.md", ".planning/debug/watchlist-load-error-silent.md", ".planning/debug/watchlist-scroll-chart-height-g02-5.md", ".planning/phases/02-persistent-watchlist/02-01-PLAN.md", ".planning/phases/02-persistent-watchlist/02-01-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-02-PLAN.md", ".planning/phases/02-persistent-watchlist/02-02-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-03-PLAN.md", ".planning/phases/02-persistent-watchlist/02-03-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-04-PLAN.md", ".planning/phases/02-persistent-watchlist/02-04-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-05-PLAN.md", ".planning/phases/02-persistent-watchlist/02-05-SUMMARY.md", ".planning/phases/02-persistent-watchlist/02-SECURITY.md", ".planning/phases/02-persistent-watchlist/02-UAT.md", ".planning/phases/02-persistent-watchlist/02-UI-REVIEW.md", ".planning/phases/02-persistent-watchlist/02-UI-SPEC.md", ".planning/phases/02-persistent-watchlist/02-VALIDATION.md", "backend/app/api/watchlist.py", "backend/app/db/connection.py", "backend/app/db/init.py", "backend/app/db/repository.py", "backend/app/db/schema.py", "backend/app/main.py", "backend/app/market/simulator.py", "backend/app/market/ticker.py", "db/.gitkeep", "frontend/__tests__/Watchlist.test.tsx", "frontend/app/page.tsx", "frontend/components/Watchlist.tsx", "frontend/components/WatchlistRow.tsx", "frontend/lib/hooks.ts"]
covered_digest: "v1:sha256:bff2c6dac677850b311aead52824e1cb5b0b3ea870de122ba534254be812ee3b"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 32/36
  note: "Prior VERIFICATION.md (2026-09-19T13:10:00Z) had no `gaps:` key (status was human_needed, not gaps_found), so Step 0 formally routes to INITIAL MODE — reported as a re-verification anyway because a full UAT retest (commit a821b8a, 02-UAT.md) and a second gap-closure plan (02-05, commits acdd613/dadbab2/91ef4e7/2e0a6ab) ran since. See Score Reconciliation."
  gaps_closed:
    - "G-02-4 (remove button hit area sub-24px, no resting-state affordance) — fixed by 02-05 Task 1: WatchlistRow.tsx remove button now h-6 w-6, permanent bg-[var(--color-down)]/10 + border-[var(--color-down)]/40, focus:ring-[var(--color-primary-blue)]. Read directly in source; unit-tested (3 new tests, lines 296/306/315); not yet re-confirmed live in a browser (SUMMARY explicitly states no dev-server session was started this plan)."
    - "G-02-5 (watchlist panel unbounded, page-level scroll, chart height coupled to watchlist row count) — fixed by 02-05 Task 2: Watchlist.tsx wraps the loading/loadError/empty/table branches in a data-testid=\"watchlist-scroll-container\" div (lg:max-h-[440px] overflow-y-auto, add-ticker form kept outside it); page.tsx's row gained lg:items-start (data-testid=\"terminal-layout-row\"). Read directly in source; unit-tested (4 new tests, lines 536/556/576/599/633); MainChart.tsx confirmed untouched via git log; not yet re-confirmed live in a browser."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Two concurrent POST /api/watchlist requests for the same new ticker never produce two watchlist rows — the UNIQUE (user_id, ticker) constraint is the serialization point, and the losing request surfaces as a 409 rather than a 500 (02-02 must_haves backstop item)."
    test: "Fire two concurrent add_watchlist_ticker(\"XXXX\") calls (e.g. via asyncio.gather over asyncio.to_thread, or two threads) against the same SQLite file and confirm exactly one row exists and the second raises/translates to 409, not a 500 or a silent duplicate."
    expected: "Exactly one watchlist row for the ticker; the losing request either raises sqlite3.IntegrityError -> ValueError -> 409, or blocks/serializes cleanly — never a 500 and never two rows."
    why_human: "No concurrency test exists in backend/tests/db/test_repository.py or backend/tests/api/test_watchlist.py (re-confirmed by grep this session — no thread/asyncio.gather-based race test). backend/ has zero diff since the prior verification's covered commit (f717f80..HEAD -- backend/ is empty) — 02-05 touched only frontend files, so this item is unchanged."
human_verification:
  - test: "Start the app in a real browser. Click a watchlist row's × remove button several times across several rows, including near the edges of the visible colored box, not dead-center. Tab to a remove button with the keyboard."
    expected: "Each remove button shows a small, permanently visible reddish box around the × glyph (not hover-only, never purple); every click — including near-edge clicks — removes the ticker on the first try; row heights look unchanged from before this fix; a blue focus ring appears on Tab."
    why_human: "This is the live re-test of gap G-02-4. The fix (frontend/components/WatchlistRow.tsx) is read-verified in source and unit-tested via classList/className assertions (3 passing tests), but jsdom does not compute real layout or pixel hit-testing — the 02-05-SUMMARY explicitly records that no real-browser session was run this plan, deferring to end-of-phase UAT per this project's workflow.human_verify_mode=end-of-phase."
  - test: "In a real browser at desktop (lg:) width, use the add-ticker form to add ~15-20 tickers (enough to exceed the watchlist panel's normal height) and observe: (a) whether the browser/page-level scrollbar appears or the watchlist panel itself scrolls internally, (b) whether the add-ticker form and its error slot stay visible while scrolled down in the list, (c) whether the main chart's bordered box height stays constant as tickers are added/removed. Then narrow the window below the lg: breakpoint with the same long watchlist and confirm the watchlist/chart stack full-width with normal page scroll and no nested internal scrollbar."
    expected: "At lg: width: the watchlist panel's own list region scrolls (bounded, data-testid=\"watchlist-scroll-container\", lg:max-h-[440px] overflow-y-auto) while the add-ticker form stays pinned above it; the main chart's box height is unaffected by watchlist row count (page.tsx's terminal-layout-row now carries lg:items-start, decoupling it from MainChart's h-full). Below lg:, both panels remain full-width and stacked with ordinary page scroll, no nested scrollbar. Note: because the scroll cap (440px) plus the form's own height (~62px) totals roughly 500px, a genuinely short desktop viewport may still show a page-level scrollbar to reach content below the fold — that is expected and is a different claim from 'row count drives page height', which is what this check is actually confirming."
    expected_but_prior_scope: "This item supersedes/closes 02-01-PLAN's original, still-unconfirmed 'no-scroll/max-size' must-have — the two are the same underlying concern, now addressed by the 02-05 fix rather than left as an open design decision."
    why_human: "This is the live re-test of gap G-02-5. The fix (frontend/components/Watchlist.tsx, frontend/app/page.tsx) is read-verified in source, confirmed structurally correct (the scroll container wraps only the 4-way state branch, the add-ticker form and error `<p>` sit outside it as siblings), and unit-tested (5 passing classList/DOM-containment tests). `git log` confirms `frontend/components/MainChart.tsx` has zero commits since before this phase, satisfying the plan's explicit 'do not touch MainChart.tsx' constraint. But jsdom performs no real CSS layout, so the actual scroll/height-decoupling behavior a live browser produces has never been observed — the 02-05-SUMMARY explicitly defers this to end-of-phase UAT."
  - test: "Fire two concurrent add_watchlist_ticker(\"XXXX\") calls against the same SQLite file and confirm exactly one row exists, with the loser surfacing as 409, not 500 or a silent duplicate."
    expected: "Exactly one watchlist row; loser raises IntegrityError -> 409, never a 500, never two rows."
    why_human: "Carried forward from the prior verification, unchanged — no concurrency test exists and 02-05 did not touch backend code (see behavior_unverified_items above)."
---

# Phase 02: Persistent Watchlist Verification Report (Re-Verification After Second Gap-Closure Round)

**Phase Goal:** The user controls which tickers they watch, and that choice — along with the rest of the app's state — now lives in a real SQLite database instead of memory
**Verified:** 2026-09-19T15:05:00Z
**Status:** human_needed
**Re-verification:** Yes — after a full UAT retest (`02-UAT.md`, commit `a821b8a`) found 3 passes and 2 new issues (G-02-4, G-02-5), and gap-closure plan `02-05` (commits `acdd613`/`dadbab2`/`91ef4e7`/`2e0a6ab`) closed both at the code/unit-test level.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (primary contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User adds a ticker (e.g. PYPL) through the watchlist control and it appears in the grid and starts streaming prices within seconds | ✓ VERIFIED | Add path unchanged by 02-05 (`git diff --stat` shows only `WatchlistRow.tsx`, `Watchlist.tsx`, `page.tsx`, `Watchlist.test.tsx`, `02-UI-SPEC.md` touched). UAT test 2 confirmed this live and the user reported being "happy with it" apart from the remove-button hit area (G-02-4, now code-fixed). |
| 2 | User removes a ticker and it disappears from the grid and stops receiving updates | ✓ VERIFIED | `handleRemove`/`removeWatchlistTicker` wiring untouched by 02-05 — only the remove `<button>`'s className changed (styling, not behavior). UAT test 2 confirmed removal functions; the only reported defect was the hit-area size, not removal correctness. |
| 3 | Reloading the browser shows the user's own watchlist, not the built-in default list | ✓ VERIFIED | `Watchlist.tsx` still sources rows exclusively from `useWatchlist()` (REST); `app/main.py`'s lifespan unchanged. UAT test 1 (no loading flicker) passed live, confirming the populated-on-reload behavior. |
| 4 | A malformed or empty ticker entry is rejected with a visible message and leaves the watchlist unchanged | ✓ VERIFIED | Validation paths unchanged by 02-05. `Watchlist.test.tsx`'s empty/whitespace-submission tests still present and passing (44/44 in the full `Watchlist` file this session). |

**ROADMAP score:** 4/4 success criteria hold. Neither G-02-4 nor G-02-5 (the two new UAT findings) contradicts any of these four criteria — both are refinements on top of already-working add/remove functionality (hit-area ergonomics and layout/scroll behavior), not defects in the core add/remove/persist/reject behaviors themselves.

### Score Reconciliation (32/36 -> 35/41)

The prior verification (2026-09-19T13:10:00Z) scored 32/36 across 02-01 through 02-04. This pass adds 02-05's 5 declared truths (new denominator 41) and resolves 2 of the prior verification's 3 open human-judgment items via the intervening UAT retest:

1. **Two prior human-judgment truths flip to VERIFIED via live UAT confirmation, not code re-inspection:** 02-01's "no visible loading-flicker / layout jump on initial load" (UAT test 1: pass) and 02-03's "failed-DELETE error renders visibly" (UAT test 5: pass — see the note on `02-UAT.md`'s test-5 arithmetic below). **32 -> 34.**
2. **02-05 contributes 5 new truths.** D5 (`02-UI-SPEC.md` amended to describe the shipped contracts) is fully verifiable from the document itself — read directly, confirmed amended in 5 places plus a dated addendum — **34 -> 35.** D1-D4 (24x24px hit box + colors, focus ring, bounded scroll container, chart-height decoupling) are all read-verified in source and backed by 9 new passing unit tests (`frontend/__tests__/Watchlist.test.tsx` lines 296, 306, 315, 536, 556, 576, 599, 633), but each asserts CSS classes on jsdom nodes, not real browser layout/paint/click behavior — the 02-05-SUMMARY itself states no real-browser session was run. Per this project's "visual appearance always needs human" rule (a category distinct from the code-transition-only `PRESENT_BEHAVIOR_UNVERIFIED` status), these route to human verification and are **not** counted toward the verified score.
3. **What stayed the same:** the 02-02 concurrent-add backstop item (unchanged — `git diff --stat f717f80..HEAD -- backend/` is empty, confirming zero backend changes since the prior verification's covered commit).

**02-UAT.md test-5 arithmetic note:** the file shows `result: pass` immediately followed by a stray `result: [pending]` line for test 5. The file's own summary block (`total: 5, passed: 3, issues: 2, pending: 0`) only balances if test 5 counts as `pass` — the `[pending]` line is a stale edit artifact, not a live result. This report treats test 5 as passed and this supersedes the prior verification's note about `02-UAT.md` having stale duplicated blocks (the file has since been rewritten with a single, internally-consistent test-5 entry, modulo this one leftover line).

### Additional Plan-Level Must-Haves (41 truths across 02-01/02-02/02-03/02-04/02-05 frontmatter)

| Category | Verified | Behavior-Unverified | Human/Uncertain |
|---|---|---|---|
| 02-01 (10 truths) | 9 (was 8; +1 loading-flicker, UAT test 1 pass) | 0 | 1 (no-scroll/max-size — superseded by 02-05's fix, merged into the G-02-5 human item below, not double-verified) |
| 02-02 (12 truths) | 11 | 1 (concurrent-add race, unchanged) | 0 |
| 02-03 (10 truths) | 10 (was 9; +1 failed-DELETE render, UAT test 5 pass) | 0 | 0 |
| 02-04 (4 truths) | 4 (unchanged) | 0 | 0 |
| 02-05 (5 truths) | 1 (D5, UI-SPEC text) | 0 | 4 (D1-D4 — code/unit-verified, real-browser confirmation pending) |
| **Total** | **35** | **1** | **5** |

**Score:** 35/41 truths verified. 1 present-but-behavior-unverified (backend concurrency, untested). 5 routed to human/uncertain judgment, consolidated into 2 browser-check items plus the 1 carried concurrency item in Human Verification below (the 02-01 no-scroll item and 02-05's D3/D4 describe the same underlying concern and are reported as a single check, not two).

### Code-Level Verification of the Two New Gap Fixes

Both fixes were read directly against source (not trusted from SUMMARY.md) and cross-checked against the plan's `must_haves`:

| Fix | File | Verified Detail |
|---|---|---|
| G-02-4 hit area | `frontend/components/WatchlistRow.tsx:115` | `className="inline-flex h-6 w-6 items-center justify-center align-middle rounded border border-[var(--color-down)]/40 bg-[var(--color-down)]/10 text-sm text-[var(--color-down)] hover:bg-[var(--color-down)]/20 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-blue)]"` — matches the plan's exact prescribed class list, verbatim. No `secondary-purple`. |
| G-02-4 row-height math | `frontend/components/WatchlistRow.tsx:105-108,115` + `frontend/components/Sparkline.tsx` | The sparkline `<td>` (`py-1.5` = 12px padding + Recharts-rendered content) and the remove `<td>` (`py-1.5` = 12px padding + `h-6` = 24px button) both total 36px, as the plan claims. Additionally verified (beyond the plan's own claim) that Recharts' `RechartsWrapper` (`node_modules/recharts/es6/chart/RechartsWrapper.js`) renders its chart inside a `<div class="recharts-wrapper" style={{height: 24, ...}}>` — a block-level div, not a bare inline `<svg>` — so there is no inline-baseline/descent drift risk in the sparkline cell that could contradict the row-height-unchanged claim. |
| G-02-5 scroll bound | `frontend/components/Watchlist.tsx:93-121,122` | The `<form data-testid="watchlist-add-form">` and the `watchlist-add-error` `<p>` are structural siblings appearing *before* the `<div data-testid="watchlist-scroll-container" className="lg:max-h-[440px] overflow-y-auto">` wrapper — confirmed by direct source read, not just the passing `scrollContainer.contains(form) === false` unit assertion. |
| G-02-5 chart decoupling | `frontend/app/page.tsx:43-46` | Row div carries `lg:items-start` alongside `flex flex-col gap-4 lg:flex-row`; `frontend/components/MainChart.tsx` confirmed untouched via `git log --oneline -- frontend/components/MainChart.tsx` (last commit `a2ccba9`, predates this phase's UI-SPEC entirely). |
| 02-UI-SPEC.md amendments | `.planning/phases/02-persistent-watchlist/02-UI-SPEC.md:77,115,129,148,151,152,170-181` | Color table, "10 covered, 4 backstop" summary line, overflow-treatment row (now `✅ covered`), remove-affordance bullet, new layout-decoupling bullet, testid list, and a dated "Addendum — Gap Closure (G-02-4, G-02-5)" section all confirmed present via direct read/grep. |

### Prohibitions (must_haves.prohibitions — judgment-tier, non-authoritative)

Unchanged since the prior verification — 02-05 touched only styling/layout classNames in already-reviewed files, none of the four prohibition-bearing logic paths (`backend/app/api/watchlist.py`'s price-fabrication guard, `backend/app/market/ticker.py`'s normalization, the no-cap watchlist logic, `backend/app/db/repository.py`'s DELETE scope). All four remain **honored**, flagged `unverified-prohibition — human review recommended` per this project's fail-closed default for the three judgment-tier items; the fourth (no-cascade-on-remove) remains backed by a passing test.

### Code Review / Anti-Pattern Findings

- **Debt-marker scan (this session):** `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` on all 5 files 02-05 modified (`WatchlistRow.tsx`, `Watchlist.tsx`, `page.tsx`, `Watchlist.test.tsx`, `02-UI-SPEC.md`) — zero matches (the one `placeholder=` hit is the legitimate HTML attribute, excluded). No BLOCKER.
- **Carried-forward, non-blocking (unchanged, 02-05 did not touch these paths):** WR-01 (`loadError` has no in-UI retry — declared trade-off in 02-04-PLAN's objective), WR-02 (no `role="alert"`/`aria-live` on loading/load-error slots).
- **New from this session's own read (not previously flagged as a distinct item, folded into the accessibility advisory group below):** `WatchlistRow.tsx:88`'s `<tr>` still carries `focus:outline-none` with no replacement focus-visible treatment on the row itself — 02-05's new focus ring targets the remove *button*, a different element; the row's own keyboard-focus indicator gap (flagged in `02-UI-REVIEW.md`) is unaffected by this plan.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/components/WatchlistRow.tsx` | 24x24px accessible remove hit box, permanent affordance, focus ring | ✓ VERIFIED | Read directly; className matches plan verbatim (see table above). |
| `frontend/components/Watchlist.tsx` | Bounded, internally-scrolling list region excluding the add-ticker form | ✓ VERIFIED | Read directly; scroll container wraps only the 4-way state branch (lines 122-168); form/error `<p>` are prior siblings. |
| `frontend/app/page.tsx` | Row container decoupled from chart-height stretch at `lg:` | ✓ VERIFIED | Read directly; `lg:items-start` + `data-testid="terminal-layout-row"` present at line 43-46. |
| `frontend/__tests__/Watchlist.test.tsx` | New coverage for hit-area/color/focus and scroll-container/layout-decoupling | ✓ VERIFIED | All 9 named tests confirmed present verbatim by direct grep (lines 296, 306, 315, 536, 556, 576, 599, 633) and by a live `npm run test -- Watchlist` run this session: 44/44 passed. |
| `.planning/phases/02-persistent-watchlist/02-UI-SPEC.md` | Remove-affordance/overflow sections describe corrected contract | ✓ VERIFIED | Read directly; 5 amendment points plus addendum confirmed present. |
| `frontend/components/MainChart.tsx` | Untouched (explicit plan constraint) | ✓ VERIFIED | `git log --oneline -- frontend/components/MainChart.tsx` shows no commits since before this phase. |
| All 02-01/02-02/02-03/02-04 artifacts | Unchanged | ✓ VERIFIED (carried forward) | `git diff --stat f717f80..HEAD -- backend/` is empty; only the 5 files listed in 02-05's frontmatter changed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `WatchlistRow.tsx` remove `<button>` | Visible hit box / affordance | `h-6 w-6 inline-flex items-center justify-center align-middle` + permanent `bg`/`border` classes | ✓ WIRED (code-level) | Classes present and read-confirmed; real-browser click-reliability confirmation still pending (see Human Verification). |
| `Watchlist.tsx`'s `watchlist-scroll-container` | Loading/loadError/empty/table branches | Single wrapping `<div>` around the existing 4-way ternary | ✓ WIRED | All 4 branches confirmed to render inside the container by 4 separate passing tests (lines 556, 576, 599, plus the populated case at 536). |
| `watchlist-add-form` / `watchlist-add-error` | Kept outside `watchlist-scroll-container` | Structural sibling placement, not conditional rendering | ✓ WIRED | Confirmed both by direct source read and by the passing `scrollContainer.contains(form) === false` assertion in all 4 branch tests. |
| `page.tsx`'s `terminal-layout-row` | `MainChart.tsx`'s height | `lg:items-start` removes `align-items: stretch` | ✓ WIRED (code-level) | Class present, `MainChart.tsx` confirmed untouched; real-browser height-independence confirmation still pending. |
| All 02-01/02-02/02-03/02-04 key links | — | — | ✓ WIRED (carried forward, unchanged) | No files in this chain touched by 02-05; backend diff empty since prior verification. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `Watchlist.tsx` grid rows (carried forward) | `watchlist` | `useWatchlist()` -> `GET /api/watchlist` -> SQLite `watchlist` table | Yes | ✓ FLOWING |
| `Watchlist.tsx`'s scroll container bound | `lg:max-h-[440px]` (static Tailwind value, not data-driven) | N/A — this is a CSS layout constant, not a rendered data value | N/A | Not applicable — a fixed layout bound is the correct implementation, not a stub. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full frontend `Watchlist` test file (44 tests, includes all 9 new 02-05 cases) | `npm run test -- Watchlist` (from `frontend/`) | `44 passed (44)` | ✓ PASS |
| Frontend typecheck | `npm run typecheck` (from `frontend/`) | clean, no `error TS` | ✓ PASS |
| Frontend production build | `npm run build` (from `frontend/`) | `Compiled successfully`, static pages generated | ✓ PASS |
| Backend regression carry-forward (no backend files touched by 02-05) | `git diff --stat f717f80..HEAD -- backend/` | empty output | ✓ PASS — confirms the prior verification's 138-passing backend suite result carries forward without re-running it |
| `MainChart.tsx` untouched (plan's explicit constraint) | `git log --oneline -- frontend/components/MainChart.tsx` | last commit `a2ccba9`, predates this phase | ✓ PASS |
| Named-test existence check — do 02-05-SUMMARY's D1-D5 tests exist verbatim? | `grep -n 'it("' frontend/__tests__/Watchlist.test.tsx` filtered for hit-area/scroll/layout titles | All 8 unit-test titles found at claimed lines (296, 306, 315, 536, 556, 576, 599, 633) | ✓ PASS |
| Debt-marker scan on all 5 files 02-05 modified | `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` excluding the legitimate `placeholder=` attribute | Zero matches | ✓ PASS |
| Recharts sparkline rendering mechanism (independent check, not in plan) | Read `node_modules/recharts/es6/chart/RechartsWrapper.js` | Confirms a block-level wrapping `<div>`, not a bare inline `<svg>` | ✓ PASS — supports, does not contradict, the plan's row-height-unchanged math |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| WTCH-01 | 02-01 (foundation), 02-02 (implements), 02-04/02-05 (UX gap closure) | User can add a ticker to the watchlist manually | ✓ SATISFIED | Add path unchanged and functionally confirmed live by UAT test 2; the reported defect (G-02-4, hit-area size on the adjacent remove control) is now code-fixed, pending final browser confirmation. `REQUIREMENTS.md` marks `[x]`. |
| WTCH-02 | 02-01 (foundation), 02-03 (implements), 02-04/02-05 (UX gap closure) | User can remove a ticker from the watchlist manually | ✓ SATISFIED | Remove path unchanged and functionally confirmed live by UAT test 2 ("Other than that, I am happy with it"); the reported defect (hit-area size) is code-fixed, pending final browser confirmation. `REQUIREMENTS.md` marks `[x]`. |

No orphaned requirements — `REQUIREMENTS.md`'s traceability table maps only WTCH-01/WTCH-02 to Phase 2; 02-05's frontmatter lists both as the requirements this closure serves, not a new requirement.

### Advisory — Accessibility Follow-Ups (non-blocking per this project's config)

Reported for visibility, not treated as phase-blocking gaps, per `02-UI-REVIEW.md`'s own 17/24 advisory framing:

| # | Finding | Source | Status |
|---|---------|--------|--------|
| 1 | `WatchlistRow.tsx:88`'s `<tr>` carries `focus:outline-none` with no replacement focus-visible ring — a row-level WCAG 2.4.7 gap distinct from 02-05's new remove-*button* focus ring | `02-UI-REVIEW.md` | Open, non-blocking |
| 2 | `watchlist-add-input` has no `aria-label` (relies on placeholder text only) | `02-UI-REVIEW.md` | Open, non-blocking |
| 3 | No `role="alert"`/`aria-live="polite"` on the loading/load-error slots (WR-02, `02-REVIEW.md`) | `02-REVIEW.md` | Open, non-blocking |

### Anti-Patterns Found

None (BLOCKER-level). See Code Review / Anti-Pattern Findings above for the full debt-marker scan result and the carried-forward, non-blocking warnings.

### Human Verification Required

1. **Live re-test of G-02-4 (remove-button hit area).** Click a watchlist row's × remove button several times across several rows, including near the edges of the visible colored box. Tab to a remove button with the keyboard. Expected: a permanently visible reddish box around the × (never purple, never hover-only); reliable first-click removal, including near-edge clicks; unchanged row heights; a visible blue focus ring on Tab. Why human: the fix is read-verified in source and unit-tested via classList assertions, but jsdom performs no real hit-testing or paint — the 02-05-SUMMARY states no real-browser session ran this plan.

2. **Live re-test of G-02-5 (watchlist scroll / chart-height decoupling).** At desktop (`lg:`) width, add ~15-20 tickers and observe whether the watchlist panel itself scrolls internally (not the whole page), whether the add-ticker form stays pinned and visible while scrolled, and whether the main chart's box height stays constant. Then narrow below `lg:` and confirm both panels stack full-width with ordinary page scroll and no nested internal scrollbar. Expected: internal scroll bounded to `lg:max-h-[440px]`, form always visible, chart height row-count-independent, mobile/tablet layout unaffected. Why human: same as above — read-verified and unit-tested (5 passing DOM-structure assertions), but never observed in a real browser. This item also closes the still-open 02-01 "no-scroll/max-size" must-have, which describes the same underlying concern.

3. **Concurrent same-ticker add race (carried forward, unchanged).** Fire two concurrent `add_watchlist_ticker("XXXX")` calls against the same SQLite file and confirm exactly one row exists, with the loser surfacing as 409, not 500 or a silent duplicate. Why human: no concurrency test exists in the backend suite; 02-05 made zero backend changes (confirmed via empty `git diff --stat` since the prior verification's commit).

### Gaps Summary

No gaps block the phase goal — all four ROADMAP success criteria hold, confirmed both at the code level (unchanged since the prior pass) and via live UAT (test 1, test 2's non-hit-area parts, test 3, test 5 all passed in the retest). Both new UAT findings from the retest are closed at the code/unit-test level:

- **G-02-4** (remove-button hit area) and **G-02-5** (watchlist scroll / chart-height coupling) were both diagnosed with clear, verified root causes and fixed by plan 02-05. Every claimed file change, class name, test, and UI-SPEC amendment was independently read-confirmed against source this session — not trusted from SUMMARY.md. `git log` confirms the explicit "do not touch MainChart.tsx" constraint was honored, and `git diff` confirms zero backend regression risk (no backend files touched).
- Neither fix has been re-confirmed in an actual running browser yet — the 02-05-SUMMARY says so explicitly, consistent with this project's `human_verify_mode: end-of-phase` configuration, which defers exactly this kind of visual/interaction confirmation to the verifier's end-of-phase pass rather than the executor's cold-start.

What remains open: **2 browser re-confirmation items** for the newly-fixed G-02-4/G-02-5 (superseding the prior report's broader "visual confirmation" and "no-scroll/max-size" items, which are substantially narrowed now that G-02-1/G-02-2/G-02-3 and the non-hit-area parts of the add/remove UI are all live-confirmed passing), and **1 unchanged backend concurrency item**. Routing to `human_needed`, not `passed`, per this project's rule that any non-empty human-verification list precludes a `passed` status even when all ROADMAP success criteria are met.

**Note for the next UAT session:** a fresh, targeted UAT pass covering only the 2 items above (remove-button click reliability + watchlist scroll/chart-height behavior) should be sufficient to close this phase — the broader set of concerns from the first two UAT rounds (G-02-1 through G-02-3, plus the non-hit-area parts of G-02-2's original test 2) are now live-confirmed resolved and do not need re-testing.

---

_Verified: 2026-09-19T15:05:00Z_
_Verifier: Claude (gsd-verifier)_

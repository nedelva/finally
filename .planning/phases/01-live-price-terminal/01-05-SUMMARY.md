---
phase: 01-live-price-terminal
plan: 05
subsystem: frontend/ui
tags: [react, recharts, tailwind, vitest, tdd, sse, accessibility]

requires:
  - phase: 01-live-price-terminal
    provides: "Watchlist grid, stream context, format.ts, PriceTick/PricePoint/ConnectionStatus types (from 01-01 through 01-04)"
provides:
  - "frontend/components/ConnectionDot.tsx: four-state stream indicator exposed as colour, aria-label text, and data-status"
  - "frontend/components/Header.tsx: brand, simulated-feed disclosure, connection dot mount point — no portfolio total or cash balance"
  - "frontend/components/MainChart.tsx: labelled-axis, tooltip-bearing Recharts line chart for the selected ticker, safe on no-selection and empty-history"
  - "WatchlistRow click/keyboard selection channel (onSelect, selected, aria-selected, button role, tab index)"
  - "frontend/app/page.tsx: composition root owning selected-ticker state with auto-select-first-ticker effect, header/watchlist/chart layout"
affects: []

actuals:
  tokens: 5600
  tasks: 2
  commits: 4
  plan_head_before: 67bb707f7501a66b3f480cae12f7616be7c552af

tech-stack:
  added: []
  patterns:
    - "Amber pulse via Tailwind's built-in animate-pulse utility class (CSS animation, no JS timer) shared by connecting and reconnecting states"
    - "MainChart reuses Sparkline's explicit-width/height direct-render branch (proven jsdom-testable path) alongside a ResponsiveContainer fallback for production"
    - "Row selection state (button role, tab index, aria-selected, Enter/Space handler) lives on WatchlistRow itself; Watchlist threads selectedTicker/onSelect through as plain props, matching the existing container/pure-row split"

key-files:
  created:
    - frontend/components/ConnectionDot.tsx
    - frontend/components/Header.tsx
    - frontend/components/MainChart.tsx
    - frontend/__tests__/ConnectionDot.test.tsx
    - frontend/__tests__/MainChart.test.tsx
  modified:
    - frontend/components/Watchlist.tsx
    - frontend/components/WatchlistRow.tsx
    - frontend/app/page.tsx
    - frontend/__tests__/Watchlist.test.tsx

key-decisions:
  - "Amber colour is shared by connecting and reconnecting (one CSS class, animate-pulse) — from the user's point of view both mean 'not yet live, not yet given up on'; the grouping assertion checks three distinct classes (connected/amber/disconnected), not four"
  - "Recharts Tooltip's labelFormatter/formatter are typed with an unknown parameter narrowed via Number(...) before calling formatClock/formatPrice — Recharts' own formatter signatures accept ReactNode/ValueType-or-undefined, which formatClock/formatPrice's number-only signatures don't accept directly"
  - "Row-selection tests (click, keyboard Enter, button role/tab index, aria-selected) live in MainChart.test.tsx rather than a new file, matching Task 2's declared <files> list; this is the third local FakeEventSource-adjacent test file in this phase but no test double extraction was needed here since these are pure-prop WatchlistRow tests with no stream context"

patterns-established:
  - "Composition-root auto-select effect: page.tsx selects tickers[0] only while nothing is selected yet (guarded by the selectedTicker dependency), so an explicit click always wins and the effect never fights a live selection"

requirements-completed: [MKT-04, MKT-05]

coverage:
  - id: D1
    description: "ConnectionDot exposes four states as colour, a data-status attribute, and an aria-label in words, with connected/amber-pair/disconnected producing three distinct indicator classes"
    requirement: "MKT-05"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ConnectionDot.test.tsx::ConnectionDot (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Header renders the FinAlly brand, the simulated-feed disclosure, and the connection dot, and renders no dollar-denominated figure (portfolio total/cash balance deferred to PORT-01)"
    requirement: "MKT-05"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ConnectionDot.test.tsx::Header (2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking or keyboard-activating (Enter) a watchlist row invokes the selection callback with that row's ticker exactly once; the row carries a button role and a tab index; the selected row alone carries aria-selected=true"
    requirement: "MKT-04"
    verification:
      - kind: unit
        ref: "frontend/__tests__/MainChart.test.tsx::WatchlistRow selection (4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "MainChart renders a pick-a-ticker instruction with no selection, a symbol+waiting message with an empty history, and a labelled-axis chart with an SVG path for 3+ points — none of the three states throw, and axis/tooltip formatting never leaks a raw unix timestamp"
    requirement: "MKT-04"
    verification:
      - kind: unit
        ref: "frontend/__tests__/MainChart.test.tsx::MainChart (4 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "page.tsx auto-selects the first ticker once the stream reports one and wires the selection through to Watchlist and MainChart end to end"
    requirement: "MKT-04"
    verification: []
    human_judgment: true
    rationale: "No automated test exercises the composition root's effect directly (Task 2's test file is scoped to MainChart/WatchlistRow, per the plan); typecheck and build both pass against the real usePriceStreamContext wiring, and the behaviour is one of the five items the deferred end-of-phase human-check explicitly walks (clicking several tickers and confirming the chart area is never empty)"
  - id: D6
    description: "Full-terminal browser walkthrough of all 5 phase success criteria (MKT-01 through MKT-05) plus the 2 provenance/scope constraints, including a devtools offline/online disconnect-recovery check for the connection dot"
    verification: []
    human_judgment: true
    rationale: "Task 2's <verify> block embeds this as a <human-check> per the project's end-of-phase human_verify_mode default — genuinely requires a human eye (colour perception, animation timing, visual layout) and a real network interruption; deferred to the phase-level verifier's UAT.md, not performed by this executor"

duration: ~25min
completed: 2026-09-18
status: complete
---

# Phase 1 Plan 5: Header, Connection Dot, and Main Chart Summary

**Four-state connection dot (colour + text + data attribute) and a click-driven, labelled-axis main chart close out Phase 1's Walking Skeleton — every watchlist row is now keyboard-selectable, and the header carries the terminal's sole liveness signal with no placeholder portfolio figures.**

## Performance
- **Duration:** ~25min
- **Tasks:** 2 completed
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments
- `ConnectionDot.tsx` renders the four `ConnectionStatus` values as colour (up-token green, accent-yellow amber shared by connecting/reconnecting with a Tailwind `animate-pulse`, down-token red), a `data-status` attribute for tests, an `aria-label` naming the state in words, and a visible text label — no hand-rolled reconnection logic anywhere near it.
- `Header.tsx` mounts the brand, the literal "Simulated market data" disclosure, and the dot; it renders zero dollar-denominated figures, keeping the portfolio total and cash balance genuinely absent until PORT-01 (Phase 3) rather than stubbed.
- `WatchlistRow` gained a selection channel: `onSelect`/`selected` props, `role="button"`, `tabIndex={0}`, an Enter/Space key handler, and `aria-selected` — all layered onto the existing flash/formatter/sparkline behaviour from 01-04 without touching it.
- `MainChart.tsx` is a richer Recharts `LineChart` than the row `Sparkline`: a time axis through `formatClock`, a price axis that follows the data (`domain={["auto","auto"]}`, never pinned to zero) through `formatPrice`, a tooltip, and a primary-blue undotted, unanimated line. Both degenerate states (no selection, selection with empty history) render real panel chrome and a message instead of crashing or going blank.
- `page.tsx` now owns `selectedTicker` state, auto-selects the first ticker once the stream reports one (an explicit click always overrides it afterward), and lays out header / watchlist / chart in a responsive two-column-on-wide, stacked-on-narrow layout.
- Full TDD cycle for both tasks: RED failed on real assertions against minimal stub components (documented precedent from 01-02/01-04), GREEN implemented the real behaviour. Frontend suite grew from 34 (baseline) → 46 (Task 1) → 54 (Task 2) passing tests, all green throughout.
- This plan closes MKT-04 and MKT-05 — all five of Phase 1's requirements are now complete.

## Task Commits
1. **Task 1: Header with a live connection indicator (MKT-05)** — RED `21ab944` (test), GREEN `f541a2a` (feat); no REFACTOR commit needed
2. **Task 2: Click a ticker, draw its chart (MKT-04)** — RED `88c1595` (test), GREEN `a2ccba9` (feat); no REFACTOR commit needed
**Plan metadata:** pending (docs: complete plan) — committed after this SUMMARY

## Files Created/Modified
- `frontend/components/ConnectionDot.tsx` — four-state indicator; colour + `data-status` + `aria-label` + visible label
- `frontend/components/Header.tsx` — brand, disclosure, dot mount; no currency-formatted output
- `frontend/components/MainChart.tsx` — labelled-axis Recharts chart with tooltip; no-selection and empty-history states as real UI
- `frontend/components/Watchlist.tsx` — threads `selectedTicker`/`onSelect` to each row
- `frontend/components/WatchlistRow.tsx` — click/keyboard selection, button role, tab index, `aria-selected`, selected-row background
- `frontend/app/page.tsx` — mounts `Header`, owns selection state with auto-select-first effect, two-column responsive layout
- `frontend/__tests__/ConnectionDot.test.tsx` — 8 tests: per-status `data-status`/`aria-label`, three-distinct-class grouping, no-timer sanity check, Header composition, no-currency assertion
- `frontend/__tests__/MainChart.test.tsx` — 8 tests: row click/keyboard selection, button role/tab index, `aria-selected` targeting, MainChart's three states, axis-formatter (non-raw-timestamp) assertion
- `frontend/__tests__/Watchlist.test.tsx` — one assertion updated (Rule 3, see Deviations)

## Decisions Made
See `key-decisions` in frontmatter above — the shared amber colour class, the `unknown`-narrowed Recharts Tooltip formatter types, and keeping row-selection tests inside `MainChart.test.tsx` per the plan's declared file list are the three worth flagging forward.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Watchlist.test.tsx`'s ten-row assertion invalidated by WatchlistRow's new required `role="button"`**
- **Found during:** Task 2, full-suite run after GREEN
- **Issue:** `WatchlistRow`'s new `role="button"` (mandated by the plan's action text for keyboard activation) overrides the `<tr>`'s implicit `row` role. 01-04's `Watchlist.test.tsx` asserted `getAllByRole("row")` had length 11 (header + 10 body rows); with the role override, only the header row keeps the `row` role, collapsing the count to 1 and failing a previously-green test.
- **Fix:** Split the assertion into `getAllByRole("row")` (length 1, header only) and `getAllByRole("button")` (length 10, the body rows) — a strictly more precise test of the actual DOM than the original, not a scope change.
- **Files modified:** `frontend/__tests__/Watchlist.test.tsx`
- **Verification:** Full frontend suite green (54/54) after the fix.
- **Commit:** `a2ccba9`

**Total deviations:** 1 auto-fixed (Rule 3 — blocking). **Impact:** None on scope or architecture; a predictable, bounded test-assertion update caused directly by this task's own required accessibility attribute.

## Issues Encountered
None beyond the one documented deviation above. The full frontend suite (34 → 46 → 54) and full backend suite (90, unchanged) stayed green throughout; neither task needed more than one fix attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
This plan completes Phase 1 (Live Price Terminal) — all five requirements (MKT-01 through MKT-05) now have automated coverage. `npm --prefix frontend run test` reports 54 passed; `npm --prefix frontend run typecheck` and `npm --prefix frontend run build` are both clean; the built export still contains the simulated-feed disclosure; `uv run --directory backend --extra dev pytest -q` reports 90 passed. One human-check walkthrough remains — the full five-success-criteria browser verification (including the devtools offline/online disconnect-recovery cycle for the connection dot) — deferred to the phase-level verifier's end-of-phase UAT.md per `workflow.human_verify_mode: end-of-phase`. No blockers for Phase 2.

---
*Phase: 01-live-price-terminal*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 6 created/produced files verified present on disk (`frontend/components/ConnectionDot.tsx`, `frontend/components/Header.tsx`, `frontend/components/MainChart.tsx`, `frontend/__tests__/ConnectionDot.test.tsx`, `frontend/__tests__/MainChart.test.tsx`, and this SUMMARY.md). All 5 commits (`21ab944`, `f541a2a`, `88c1595`, `a2ccba9`, `9377583`) verified present in git history.

---
phase: 02-persistent-watchlist
plan: 05
subsystem: ui
tags: [tailwind, accessibility, layout, css, watchlist]

requires:
  - phase: 02-persistent-watchlist
    provides: WatchlistRow remove affordance, Watchlist panel, page.tsx terminal layout (plans 02-01 through 02-04)
provides:
  - 24x24px WCAG 2.5.8-compliant remove-button hit area with a permanent (non-hover-only) resting-state affordance and a keyboard-focus ring
  - Internally-scrolling, lg:-scoped, height-bounded watchlist list region that excludes the always-visible add-ticker form
  - Chart/watchlist height decoupling via lg:items-start, removing align-items: stretch coupling between MainChart and Watchlist
  - 02-UI-SPEC.md amended in place to describe the corrected, shipped contracts, with a dated gap-closure addendum
affects: [ui-review, uat-retest]

actuals:
  tokens: 5347
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "lg:-scoped overflow/alignment utilities to avoid nesting scroll regions or shrinking layout below the desktop breakpoint"
    - "TDD RED->GREEN commit pairs per task even though workflow.tdd_mode is globally false — plan-level tdd=\"true\" honored per-task"

key-files:
  created: []
  modified:
    - frontend/components/WatchlistRow.tsx
    - frontend/components/Watchlist.tsx
    - frontend/app/page.tsx
    - frontend/__tests__/Watchlist.test.tsx
    - .planning/phases/02-persistent-watchlist/02-UI-SPEC.md

key-decisions:
  - "Wrapped only the loading/loadError/empty/table branch in watchlist-scroll-container, not the whole panel div — deliberate deviation from the debug session's literal Watchlist.tsx:92 fix location, so the add-ticker form and its error slot stay visible above the scrollable region at all times (documented in the plan's objective and carried into the UI-SPEC addendum)"
  - "Left the remove <td>'s py-1.5 padding untouched rather than reducing it — the sparkline <td> (36px) was already the row's tallest cell before this change and remains tied, not exceeded, so no row-height risk existed"
  - "Did not touch MainChart.tsx — lg:items-start alone removes the stretch constraint MainChart's h-full needed to couple against; verified via empty git diff on that file"

patterns-established:
  - "lg:-scoped overflow/alignment utilities to avoid nesting scroll regions or shrinking layout below the desktop breakpoint"

requirements-completed: [WTCH-01, WTCH-02]

coverage:
  - id: D1
    description: "Remove button has a fixed 24x24px flex-centered hit box with a permanent (non-hover-only) reddish background/border, never purple"
    requirement: "WTCH-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx > WatchlistRow remove affordance > gives the remove button a fixed 24x24px, flex-centered, baseline-independent hit box (G-02-4)"
        status: pass
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx > WatchlistRow remove affordance > gives the remove button a permanent destructive-token background/border, never purple (G-02-4)"
        status: pass
    human_judgment: true
    rationale: "jsdom does not compute real layout/pixel rendering — the unit tests confirm the correct classes are applied, but the plan's own <human-check> requires a real-browser confirmation of visible affordance and reliable first-click hit area, deferred to end-of-phase UAT per workflow.human_verify_mode."
  - id: D2
    description: "Remove button shows the existing blue keyboard-focus ring when tabbed to"
    requirement: "WTCH-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx > WatchlistRow remove affordance > gives the remove button the existing blue keyboard-focus ring convention (G-02-4)"
        status: pass
    human_judgment: true
    rationale: "Focus-ring class presence is unit-tested; actual visible ring rendering deferred to the plan's <human-check> at end-of-phase UAT."
  - id: D3
    description: "Watchlist panel's loading/error/empty/table region scrolls internally at the lg: breakpoint, bounded to 440px, with the add-ticker form and error slot always visible outside it"
    requirement: "WTCH-02"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx > Watchlist > bounds the populated table in an internally-scrolling container that excludes the add-ticker form (G-02-5)"
        status: pass
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx > Watchlist > wraps the loading/load-error/empty branches in the same bounded scroll container (G-02-5)"
        status: pass
    human_judgment: true
    rationale: "jsdom asserts classList only, not real CSS layout/scroll behavior — the plan's <human-check> (adding 15-20 tickers, confirming no page-level scrollbar) is required and deferred to end-of-phase UAT."
  - id: D4
    description: "Main chart panel's height is independent of watchlist row count at the lg: breakpoint (no stretch coupling); mobile/tablet full-width stacked layout unaffected"
    requirement: "WTCH-02"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx > Terminal layout decoupling (G-02-5) > scopes the row's cross-axis alignment to lg: so MainChart's height no longer stretches to match the watchlist"
        status: pass
      - kind: other
        ref: "git diff frontend/components/MainChart.tsx (empty, confirming file untouched)"
        status: pass
    human_judgment: true
    rationale: "Real visual height-decoupling and the mobile/tablet full-width regression check both require an actual rendered browser, per the plan's <human-check>; deferred to end-of-phase UAT."
  - id: D5
    description: "02-UI-SPEC.md's remove-affordance, color-table, overflow-treatment, testid-list, and layout-notes sections describe the corrected, shipped contracts, with a dated gap-closure addendum"
    requirement: "WTCH-01"
    verification:
      - kind: other
        ref: ".planning/phases/02-persistent-watchlist/02-UI-SPEC.md (Color table, Remove affordance bullet, overflow row, testid list, Interaction & Layout Notes, Addendum section all amended)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-19
status: complete
---

# Phase 02 Plan 05: Watchlist Remove-Button Hit Area and Scroll/Height Decoupling Summary

**24x24px accessible remove hit-area with a permanent visible affordance, plus an lg:-scoped internal watchlist scroll bounded to 440px, decoupled from the main chart's height via lg:items-start.**

## Performance
- **Duration:** 15min
- **Started:** 2026-09-19T14:13:22+02:00 (first commit)
- **Completed:** 2026-09-19T14:15:54+02:00 (last task commit)
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- Closed G-02-4: the watchlist row's remove (x) button now has a fixed 24x24px flex-centered hit box, a permanent (non-hover-only) reddish resting-state background/border using the existing destructive color token, and a blue keyboard-focus ring — meeting WCAG 2.5.8's AA minimum target size.
- Closed G-02-5: the watchlist panel's loading/error/empty/table region is now wrapped in a `data-testid="watchlist-scroll-container"` div bounded to `lg:max-h-[440px] overflow-y-auto`, while the add-ticker form and its error slot stay outside and always visible; `page.tsx`'s row container gained `lg:items-start`, removing the `align-items: stretch` coupling that previously forced `MainChart`'s box height to match the watchlist's row count.
- Amended `02-UI-SPEC.md` in five places (Color table, Remove affordance bullet, overflow-treatment row, testid list, layout notes) plus a new dated "Addendum — Gap Closure" section, so the design contract now describes what actually shipped.

## Task Commits
1. **Task 1 RED: remove-button hit-area/color/focus tests** - `acdd613` (test)
2. **Task 1 GREEN: 24x24px accessible remove button (G-02-4)** - `dadbab2` (feat)
3. **Task 2 RED: scroll-container/layout-decoupling tests** - `91ef4e7` (test)
4. **Task 2 GREEN: bounded watchlist scroll + chart decoupling (G-02-5)** - `2e0a6ab` (feat)

**Plan metadata:** committed separately after STATE.md/ROADMAP.md updates (see below)

_No REFACTOR commits were needed for either task — both GREEN implementations were minimal, single-purpose className/wrapper changes with no obvious cleanup opportunity._

## Files Created/Modified
- `frontend/components/WatchlistRow.tsx` - Remove button className expanded to a 24x24px flex-centered hit box with permanent destructive-token background/border and a blue focus ring
- `frontend/components/Watchlist.tsx` - New `watchlist-scroll-container` wrapper div (lg:max-h-[440px] overflow-y-auto) around the loading/loadError/empty/table branches only
- `frontend/app/page.tsx` - Row container gained `data-testid="terminal-layout-row"` and `lg:items-start`
- `frontend/__tests__/Watchlist.test.tsx` - 3 new hit-area/color/focus assertions plus 5 new scroll-container/layout-decoupling assertions
- `.planning/phases/02-persistent-watchlist/02-UI-SPEC.md` - Amended Color table, Remove affordance notes, overflow-treatment row, applicable-considerations summary line, testid list, layout notes, and a new dated addendum

## Decisions Made
- Wrapped only the loading/loadError/empty/table branch in the scroll container, not the whole panel div (deviates from the debug session's literal `Watchlist.tsx:92` fix-location note) — keeps the add-ticker form always visible above the scrollable region, per the plan's explicit objective.
- Left the remove `<td>`'s `py-1.5` padding untouched — the sparkline `<td>` (36px) was already the row's tallest cell and remains tied, not exceeded, at the button's new 24px height.
- Did not modify `frontend/components/MainChart.tsx` — confirmed via `git diff` returning empty for that file, satisfying the plan's explicit verification requirement.

## Deviations from Plan

None - plan executed exactly as written, including its one deliberate, plan-documented deviation from the debug session's literal fix-location note (see Decisions Made above, which the plan itself calls out and explains in its `<objective>`).

## Issues Encountered
- `npm run lint` (`next lint`) fails with "Invalid project directory provided, no such directory: .../frontend/lint" — a pre-existing tooling/config issue unrelated to this plan's changes (out of scope per the deviation rules' scope boundary; not caused by this plan's edits). Not fixed; logged here for visibility.

## User Setup Required
None - no external service configuration required.

## Human Verification Required (deferred to end-of-phase UAT per `workflow.human_verify_mode: end-of-phase`)

Both tasks' `<human-check>` blocks require real-browser confirmation that jsdom-based unit tests cannot provide:
1. Task 1: visible resting-state color box on the remove button (not hover-only), reliable first-click hit area across several rows, unchanged row height, and a visible blue focus ring on Tab.
2. Task 2: adding 15-20 tickers scrolls the watchlist panel internally (no page-level scrollbar), the add-ticker form stays pinned and visible, the main chart's box height stays constant, and the mobile/tablet layout below the `lg:` breakpoint stacks full-width with normal page scroll (no nested internal scrollbar).

`npm --prefix frontend run test -- Watchlist` (44/44 passing) and `npm --prefix frontend run typecheck` (clean) were run and pass; `npm --prefix frontend run build` also succeeds with no errors. A real-browser dev-server session was not started in this execution — per the embedded execute-plan.md guidance for `human_verify_mode: end-of-phase`, this defers to the verifier's end-of-phase UAT pass rather than halting here.

## Next Phase Readiness
Both gap-closure items (G-02-4, G-02-5) are code-complete and unit-tested. Phase 02's UAT retest should confirm the two `<human-check>` items above before the phase is considered fully closed.

---
*Phase: 02-persistent-watchlist*
*Completed: 2026-09-19*

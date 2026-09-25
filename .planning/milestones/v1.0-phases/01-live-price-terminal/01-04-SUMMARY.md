---
phase: 01-live-price-terminal
plan: 04
subsystem: frontend/ui
tags: [react, recharts, tailwind, vitest, tdd, sse]

requires:
  - phase: 01-live-price-terminal
    provides: "Shared stream context, usePriceFlash, format.ts, PriceTick/PricePoint types (from 01-01/01-02)"
provides:
  - "frontend/components/Watchlist.tsx: grid container reading the shared stream context once, one row per ticker"
  - "frontend/components/WatchlistRow.tsx: pure-props row with price flash, session-change colour, sparkline cell"
  - "frontend/components/Sparkline.tsx: axis-free Recharts LineChart, zero/one/multi-point-safe, explicit-dimension render path"
  - "frontend/app/page.tsx rendering the real watchlist grid in place of 01-02's plain table, disclosure preserved"
affects: [01-05]

actuals:
  tokens: 4200
  tasks: 2
  commits: 4
  plan_head_before: d95556647da90ebd2512f9f3463ce678916693dc

tech-stack:
  added: []
  patterns:
    - "Container/pure-row split: Watchlist.tsx calls usePriceStreamContext exactly once; WatchlistRow takes plain props and is testable without a provider"
    - "Sparkline explicit-dimension render path for testability: when width+height are supplied, render the chart directly instead of via ResponsiveContainer, since jsdom reports zero-sized containers"
    - "Session-change colour vs. tick-to-tick flash are driven from two independent props (tick.change_percent vs. usePriceFlash(tick.price)), matching plan 01-03's split anchors"

key-files:
  created:
    - frontend/components/Watchlist.tsx
    - frontend/components/WatchlistRow.tsx
    - frontend/components/Sparkline.tsx
    - frontend/__tests__/Watchlist.test.tsx
    - frontend/__tests__/Sparkline.test.tsx
  modified:
    - frontend/app/page.tsx

key-decisions:
  - "Watchlist.tsx's header ships all four columns (Symbol, Price, Chg %, Chart) in Task 1, ahead of WatchlistRow's fourth cell landing in Task 2 — matches the plan's own Task 1 action text verbatim ('a header row labelling the symbol, price, change percentage, and sparkline columns') and avoids Task 2 needing to touch a file outside its declared <files> list"
  - "Sparkline's line stroke is a literal hex (#209dd7), not var(--color-primary-blue), mirroring RESEARCH.md's own code example — SVG presentation attributes don't reliably resolve CSS custom properties the way a style declaration would"
  - "WatchlistRow passes explicit width={80} height={24} to Sparkline in production (not just in tests) — deterministic sizing inside a table cell, and it exercises the same explicit-dimension path the tests verify rather than a second, untested ResponsiveContainer branch"

patterns-established:
  - "Zero/one/many-point chart guard: an empty array renders a correctly-sized empty box (keeps column widths stable), a single point is let through to the chart uncensored, matching the sparkline's real 'fills in progressively' lifecycle from page load"

requirements-completed: [MKT-01, MKT-02, MKT-03]

coverage:
  - id: D1
    description: "Watchlist.tsx renders one WatchlistRow per ticker in the shared stream context's ticker list, reading ticks/history/tickers exactly once"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::Watchlist > renders exactly ten rows when the shared stream reports ten tickers"
        status: pass
    human_judgment: false
  - id: D2
    description: "WatchlistRow renders an em dash in price/percentage cells before a tick arrives, and the shared formatters afterward, with an explicit sign on the percentage"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::WatchlistRow (2 placeholder/formatter tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WatchlistRow's price cell carries flash-up/flash-down for 550ms on a price change, driven by usePriceFlash, and neither class on an unchanged price"
    requirement: "MKT-02"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::WatchlistRow (4 flash-timing tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The session change-percentage cell is coloured by the up/down theme token independently of the flash, matching plan 01-03's session-anchored change_percent vs. tick-to-tick direction split"
    requirement: "MKT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Watchlist.test.tsx::WatchlistRow (2 colour tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sparkline renders safely for zero, one, and many points, and at explicit pixel dimensions rather than a jsdom-vacuous measured container"
    requirement: "MKT-03"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Sparkline.test.tsx::Sparkline (4 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "WatchlistRow wires its history prop straight into Sparkline with no second cap, and renders the sparkline cell safely with absent/empty history"
    requirement: "MKT-03"
    verification:
      - kind: unit
        ref: "frontend/__tests__/Sparkline.test.tsx::WatchlistRow sparkline integration (2 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual/terminal aesthetic of the finished grid — dense dark panel, tabular-figure alignment, muted uppercase header, compact row padding per PLAN.md section 2"
    verification: []
    human_judgment: true
    rationale: "No automated check can judge whether the grid actually reads as a professional trading terminal versus merely functionally correct; a human should visually confirm the dark theme, spacing, and flash/sparkline motion in a running browser"

duration: ~35min
completed: 2026-09-18
status: complete
---

# Phase 1 Plan 4: Watchlist Grid With Flash And Sparklines Summary

**Replaced plan 01-02's deliberately plain price table with a real terminal-style watchlist grid: a container/pure-row split reading the shared SSE context once, per-cell price-flash driven by the existing 01-01 hook, session-change colour independent of the flash (per 01-03's split anchors), and an axis-free Recharts sparkline per row that is explicitly guarded for the zero-point and one-point states every row passes through on first paint.**

## Performance
- **Duration:** ~35min
- **Started:** 2026-09-18T01:53:00Z (approx, per baseline test run)
- **Completed:** 2026-09-18T02:28:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `Watchlist.tsx` is the grid container: it calls `usePriceStreamContext()` exactly once and renders one `WatchlistRow` per entry of the context's ticker list, keyed by symbol, inside a dense dark panel (theme border/panel tokens, muted uppercase header, tabular-figure numeric columns).
- `WatchlistRow.tsx` is a pure-props component — no stream access of its own — with three data cells (symbol, price, session change %) plus a sparkline cell. Price flash comes straight from `usePriceFlash(tick?.price)` applied to the price cell's class list; every numeric value renders through `formatPrice`/`formatPercent`, so a missing tick reads as an em dash, never a raw or thrown value.
- `Sparkline.tsx` is an axis-free Recharts `LineChart`: a zero-length data array renders a correctly sized empty box (keeps column widths stable rather than asking Recharts to draw from nothing), a single point is let through uncensored, and explicit `width`/`height` render the chart directly rather than through `ResponsiveContainer` — the latter reports zero size under jsdom, which would make a responsive-only test vacuous.
- `page.tsx` now renders `Watchlist` under the existing `PriceStreamProvider`, with the literal "Simulated market data" disclosure text preserved and re-verified against the built static export (`frontend/out/index.html`).
- Full TDD cycle for both tasks: RED tests fail on real assertions (not module-resolution errors) against a deliberately minimal stub, GREEN implements the real behaviour. Frontend suite grew from 19 (baseline) → 28 (Task 1) → 34 (Task 2) passing tests, all green.
- This plan is the third and final plan to touch MKT-01, MKT-02, and MKT-03 — all three requirements are now marked complete.

## Task Commits
1. **Task 1: Replace the plain table with the real watchlist grid, flashing on every price move** — RED `ec38ac2` (test), GREEN `e706d6f` (feat); no REFACTOR commit needed
2. **Task 2: Add the progressively-filling sparkline to every row** — RED `61dd21d` (test), GREEN `b27420c` (feat); no REFACTOR commit needed
**Plan metadata:** pending (docs: complete plan) — committed after this SUMMARY

## Files Created/Modified
- `frontend/components/Watchlist.tsx` — grid container; reads `ticks`/`history`/`tickers` from `usePriceStreamContext` once, renders the 4-column header (Symbol, Price, Chg %, Chart) and one `WatchlistRow` per ticker
- `frontend/components/WatchlistRow.tsx` — pure-props row: symbol cell, flash-driven price cell, colour-driven change-percent cell, sparkline cell; exports `WatchlistRowProps`
- `frontend/components/Sparkline.tsx` — axis-free Recharts `LineChart`; guards zero-length data, renders at explicit pixel dimensions when supplied, otherwise wraps in a fixed-size `ResponsiveContainer` box
- `frontend/app/page.tsx` — renders `Watchlist` in place of the plain table; disclosure text and provider placement unchanged
- `frontend/__tests__/Watchlist.test.tsx` — 9 tests: placeholder em dash, formatter wiring, flash-up/flash-down/clear-after-550ms/unchanged-price, up/down colour, ten-row container rendering
- `frontend/__tests__/Sparkline.test.tsx` — 6 tests: zero/one/multi-point rendering, explicit-dimension rendering, WatchlistRow sparkline-cell integration (present + absent/empty history)

## Decisions Made
See `key-decisions` in frontmatter above — the header-columns-ahead-of-the-row decision, the literal-hex stroke color, and passing explicit dimensions from WatchlistRow (not just from tests) are the three worth flagging forward.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' TDD cycles needed a minimal stub component (rather than a genuinely missing file) to keep RED from producing a module-resolution failure, mirroring the documented precedent from plan 01-02's `usePriceStream.ts` RED phase; this is the same TDD-flow accommodation already established in this phase, not a new deviation.

**Total deviations:** 0 auto-fixed. **Impact:** None — no scope, architecture, or file-list changes from the plan as written.

## Issues Encountered
None. The full frontend suite stayed green throughout (19 → 28 → 34), and neither task needed more than one fix attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The watchlist grid, price flash, and sparklines are complete and fully wired to the shared stream context established in 01-02 and the session-anchored percentages fixed in 01-03.
- `frontend/components/` now exists as a real directory with three exported components (`Watchlist`, `WatchlistRow`, `Sparkline`) available for 01-05 (main chart, header, connection dot) to build alongside without touching this plan's files.
- `npm --prefix frontend run test` reports 34 passed; `npm --prefix frontend run typecheck` and `npm --prefix frontend run build` are both clean; the built export still contains the simulated-feed disclosure.
- No blockers for 01-05. MKT-01, MKT-02, and MKT-03 are all satisfied; the phase's remaining requirements (MKT-04 main chart, MKT-05 connection dot) are 01-05's scope.

---
*Phase: 01-live-price-terminal*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 5 created files verified present on disk (`frontend/components/Watchlist.tsx`, `frontend/components/WatchlistRow.tsx`, `frontend/components/Sparkline.tsx`, `frontend/__tests__/Watchlist.test.tsx`, `frontend/__tests__/Sparkline.test.tsx`), plus the SUMMARY.md itself. All 4 task commits (`ec38ac2`, `e706d6f`, `61dd21d`, `b27420c`) verified present in git history.

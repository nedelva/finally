---
phase: quick-260922-ljr
plan: 01
subsystem: ui
tags: [react, nextjs, vitest, tailwind, jsdom]

# Dependency graph
requires:
  - phase: 04-ai-copilot
    provides: ChatPanel.tsx, page.tsx sidebar layout, 04-UI-SPEC.md typography contract
provides:
  - Scroll effect that re-pins the chat message list to the newest message after a collapse/expand cycle
  - lg:overflow-y-auto on the chat sidebar wrapper, giving capped sidebar content a scroll path at >=1024px
  - UI-SPEC-compliant line-heights (leading-[1.5]/[1.4]/[1.3]) on all 12 ChatPanel text sites
affects: [04-ai-copilot, ui-review]

# Actuals (#2632)
actuals:
  tokens: 2619
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scroll-to-bottom effects that run inside a conditionally-mounted container must include the mount-toggle state (here `collapsed`) in their dependency array, or a remount resets scrollTop without the effect re-running."
    - "Tailwind line-height uses the UI-SPEC's own unitless arbitrary values (leading-[1.5], leading-[1.4], leading-[1.3]) rather than the named leading-* scale, since the named scale's ratios (leading-snug=1.375, leading-6/14px=1.71) don't match declared typography roles."

key-files:
  created: []
  modified:
    - frontend/components/chat/ChatPanel.tsx
    - frontend/app/page.tsx
    - frontend/__tests__/ChatPanel.test.tsx

key-decisions:
  - "Added collapsed to the scroll effect's dependency array rather than restructuring the conditional mount into a CSS-hidden node — matches the plan's explicit constraint and keeps the fix to a one-line diff."
  - "Added lg:overflow-y-auto to the sidebar wrapper rather than refactoring ChatPanel into a flex column — flex-1 would resolve to flex-basis:0% inside a max-height-capped, content-determined-height container and collapse the message list, and jsdom has no layout engine to verify such a change."
  - "Line-height classes use unitless Tailwind arbitrary values (leading-[1.5]/[1.4]/[1.3]) per the UI-SPEC table, not the review's suggested leading-6/leading-snug, which compute to different ratios."

patterns-established:
  - "Structural gates (grep-based adjacency/count checks) paired with automated tests verify Tailwind class placement without a layout engine."

requirements-completed: [CHAT-01, CHAT-06]

coverage:
  - id: D1
    description: "Collapsing and re-expanding the chat panel re-pins the message list to the newest message, not the top"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ChatPanel.test.tsx#scroll-to-bottom on expand > re-pins the message list to the newest message after collapse then expand"
        status: pass
    human_judgment: false
  - id: D2
    description: "The chat sidebar's message input and Send button are reachable on every viewport, including short (~620px tall) laptop viewports at >=1024px width"
    verification:
      - kind: other
        ref: "grep structural gate on frontend/app/page.tsx (Task 2 <verify><automated>) confirming both lg:max-h-[calc(100vh-4rem)] and lg:overflow-y-auto are present, plus npm --prefix frontend run typecheck"
        status: pass
    human_judgment: true
    rationale: "jsdom performs no layout, so viewport-reachability at ~620px tall / >=1024px wide cannot be asserted by an automated test. The plan's own <verify> for this task defers to a human-check for this reason."
  - id: D3
    description: "Every ChatPanel text element carries the line-height its 04-UI-SPEC typography role declares (Body 1.5, Label 1.4, Heading 1.3)"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "frontend/__tests__/ChatPanel.test.tsx#typography (04-UI-SPEC line-heights) > applies the Heading, Body, and Label line-heights to their respective elements"
        status: pass
      - kind: other
        ref: "grep structural gate counting text-sm/text-xs/text-base occurrences against their adjacent leading-[...] pairs in ChatPanel.tsx (Task 3 <verify><automated>)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-22
status: complete
---

# Quick Task 260922-ljr: Fix the 3 UI Blockers from Phase 04's UI Review

**Closed all three BLOCKER findings from `04-UI-REVIEW.md` (chat scroll-to-top bug, unreachable Send button on capped sidebars, missing UI-SPEC line-heights) with three atomic commits and two new passing tests.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-22T13:43:11Z
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments
- Fixed the chat message list scrolling to the top instead of the newest message after a collapse/expand cycle, by adding `collapsed` to the scroll effect's dependency array
- Added `lg:overflow-y-auto` to the chat sidebar wrapper so a capped sidebar (`lg:max-h-[calc(100vh-4rem)]`) always has a scroll path to the Send button at `>=1024px`
- Applied the UI-SPEC's declared line-heights (`leading-[1.5]` Body, `leading-[1.4]` Label, `leading-[1.3]` Heading) to all 12 text sites in `ChatPanel.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-pin the message list to the newest message on expand** - `8190b83` (fix)
2. **Task 2: Give the capped chat sidebar a scroll path so the form is always reachable** - `5e71bf0` (fix)
3. **Task 3: Apply the UI-SPEC line-height values to every ChatPanel text element** - `cd5f9fd` (fix)

**Plan metadata:** committed separately by the orchestrator (docs artifacts excluded from this executor's commits per task instructions).

## Files Created/Modified
- `frontend/components/chat/ChatPanel.tsx` - Scroll effect now depends on `collapsed`; all 12 text-size class sites gained an adjacent `leading-[...]` class matching their UI-SPEC typography role
- `frontend/app/page.tsx` - Sidebar wrapper div gained `lg:overflow-y-auto` alongside its existing `lg:max-h-[calc(100vh-4rem)]` cap
- `frontend/__tests__/ChatPanel.test.tsx` - Added a scoped "scroll-to-bottom on expand" test (with a per-test `scrollHeight` stub) and a "typography (04-UI-SPEC line-heights)" test asserting the Heading/Body/Label classes

## Decisions Made
- Kept the scroll fix to a one-line dependency-array addition rather than restructuring the conditional mount, per the plan's explicit instruction not to convert the `!collapsed && (...)` block into a CSS-hidden node.
- Rejected a flex-column restructure of `ChatPanel` for the sidebar overflow fix (would collapse the message list to zero height under `flex-1`/`flex-basis:0%` inside a max-height-capped container, and jsdom can't verify layout changes) in favor of the single-class `lg:overflow-y-auto` addition, matching the plan's stated rationale.
- Used unitless Tailwind arbitrary values (`leading-[1.5]`, `leading-[1.4]`, `leading-[1.3]`) rather than the UI-REVIEW's suggested named classes (`leading-6`, `leading-snug`), since those compute to different ratios (1.71 and 1.375 respectively) than the UI-SPEC's declared 1.5/1.4/1.3.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' automated gates (`ChatPanel.test.tsx` test counts, the sidebar structural grep gate, the typography structural grep gate, and `npm --prefix frontend run typecheck`) passed on first attempt with no auto-fixes required.

## Issues Encountered

`frontend/node_modules` was not installed in this worktree; ran `npm install` (dependencies only, no version changes) before the first test run could execute. Not a deviation from the plan's code changes — a one-time environment setup step.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three `04-UI-REVIEW.md` BLOCKER findings are closed; Phase 04's chat panel now complies with its approved 04-UI-SPEC.md design contract.
- WARNING-level findings from the same review (non-scale spacing values, missing `aria-expanded`/`role="alert"`/`aria-live` attributes) remain open by design — explicitly out of scope for this task.
- Full frontend suite (158 tests across 13 files) and `tsc --noEmit` both pass clean.
- Human verification recommended for the sidebar reachability fix (D2 above) at a real `>=1024px` wide, `~620px` tall viewport with the history-error banner showing — jsdom cannot assert this and no automated check exists for it.

---
*Phase: quick-260922-ljr*
*Completed: 2026-09-22*

## Self-Check: PASSED

All claimed files found on disk (`frontend/components/chat/ChatPanel.tsx`, `frontend/app/page.tsx`, `frontend/__tests__/ChatPanel.test.tsx`, this SUMMARY.md). All claimed commit hashes (`8190b83`, `5e71bf0`, `cd5f9fd`) found in `git log --oneline --all`.

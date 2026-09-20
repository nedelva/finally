---
status: diagnosed
trigger: "UAT gap G-02-4 (phase 02-persistent-watchlist, minor severity): watchlist row remove (×) button is hard to click — user reported it's \"too small and require very precise positioning of the mouse cursor and sometimes it needs two-three clicks until is triggered,\" confirmed via DevTools it is an actual <button>, and requested styling that makes it \"stand out from the surrounding background.\""
created: 2026-09-19T00:00:00Z
updated: 2026-09-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — the remove button's click-target is exactly its 14px glyph's intrinsic content box (no padding, no min-width/min-height, no background) because both the implementation (WatchlistRow.tsx:109-118) and the governing 02-UI-SPEC.md (line 148) specified only `text-sm text-[var(--color-down)]` with zero hit-area or affordance treatment.
test: read WatchlistRow.tsx button markup, its wrapping <td>, Watchlist.tsx table structure, Sparkline.tsx (adjacent cell, checked for overlap), globals.css (checked for any global button/pointer-events rules), 02-UI-SPEC.md's Remove affordance contract, and existing test suite (Watchlist.test.tsx) for styling constraints.
expecting: either a genuinely undersized hit-box (confirmed), or an overlapping/intercepting sibling element stealing the first click (ruled out).
next_action: none — diagnosis complete, goal is find_root_cause_only per task instructions. Handing back to caller with fix-direction hints; no code changes made.

## Symptoms

expected: "The watchlist row remove (×) control is easy to hit with a mouse — a reasonably sized, clearly-actionable target." (G-02-4 truth statement, 02-UAT.md:52)
actual: Remove glyph is too small, requires precise cursor positioning, and sometimes needs 2-3 clicks to register. User wants styling that makes it visually stand out from the surrounding background.
errors: none (no console/network errors — this is a pure UX/CSS sizing and affordance defect, not a functional break)
reproduction: Open the watchlist panel in a real browser, attempt to click the × glyph at the right edge of any row — clicks landing just outside the glyph's own tiny bounding box (e.g. in the cell's padding, or slightly off-center of the × stroke) do nothing.
started: Present since Phase 2 (persistent-watchlist) shipped the remove affordance; not a regression — it matches the originally-approved UI-SPEC exactly.

## Eliminated

- hypothesis: Overlapping/absolutely-positioned sibling (e.g. Sparkline's Recharts SVG) intercepts clicks meant for the remove button.
  evidence: Sparkline renders in its own `<td>` (Watchlist.tsx / WatchlistRow.tsx:105-107), physically to the left of and non-overlapping with the remove button's `<td>` (WatchlistRow.tsx:108-119). Recharts `LineChart` is explicitly sized (width=80, height=24) and confined to its own cell with no negative margins or absolute positioning found in Sparkline.tsx.
  timestamp: 2026-09-19T00:00:00Z

- hypothesis: Double-fire / event-bubbling bug causes the first click to be "swallowed," requiring a second click.
  evidence: handleRemoveClick (WatchlistRow.tsx:65-68) calls event.stopPropagation() then onRemove?.(ticker) — single, correct invocation, no debounce/guard logic that could swallow a first click. No test or code shows a race or double-handler registration (router-singleton anti-pattern documented elsewhere in this repo is in the SSE stream module, unrelated to this component).
  timestamp: 2026-09-19T00:00:00Z

- hypothesis: The click "miss" is caused by a mousedown/mouseup straddling a row remount (the price stream re-renders the table every ~500ms).
  evidence: Watchlist.tsx:155 keys each WatchlistRow with `key={entry.ticker}` — a stable key across re-renders means React reconciles (updates props on) the existing row/button DOM node rather than unmounting/remounting it on every tick. A stable DOM node cannot cause a straddled mousedown/mouseup to be lost. This rules out remount-during-click as a contributor to the "2-3 clicks" symptom, leaving repeated near-misses against an undersized hit-box (see Evidence) as the sole explanation.
  timestamp: 2026-09-19T00:00:00Z

## Evidence

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/components/WatchlistRow.tsx lines 108-119 (the remove button's full markup)
  found: |
    <td className="py-1.5 pr-3 text-right">
      <button
        type="button"
        data-testid={`remove-${ticker}`}
        aria-label={`Remove ${ticker} from watchlist`}
        onClick={handleRemoveClick}
        onKeyDown={handleRemoveKeyDown}
        className="text-sm text-[var(--color-down)]"
      >
        ×
      </button>
    </td>
    The button's className is ONLY `text-sm text-[var(--color-down)]` — no padding utility (p-*, px-*, py-*), no min-width/min-height, no background, no border, no rounded corners, no hover/focus visual state. The <td> wrapping it carries the padding (py-1.5 pr-3) and text-right alignment, but that padding belongs to the table cell, not the button — clicking inside the cell's padding region (which is visually contiguous with and appears part of the clickable "zone" to a user) does NOT hit the button element.
  implication: The button's actual clickable box is exactly the browser's default inline content-box for a single "×" (U+00D7) character at 14px (text-sm) font size — on typical UI fonts this renders to roughly 8-10px wide by ~17-20px tall (one line-height). This is far below the WCAG 2.5.5 (Level AAA) 44×44px and WCAG 2.5.8 (Level AA, 2.2) 24×24px minimum target-size guidelines. This directly explains "requires very precise positioning" (the true hit-box is much smaller than the visually-implied clickable region of the cell) and "sometimes needs two-three clicks" (repeated near-misses against a target smaller than typical cursor-placement precision, not a functional double-fire bug).

- timestamp: 2026-09-19T00:00:00Z
  checked: .planning/phases/02-persistent-watchlist/02-UI-SPEC.md lines 45-49, 64, 77, 79, 148 (the approved design contract for this exact element)
  found: Line 148 specifies the remove affordance as "a small button rendering × (Unicode U+00D7), text-sm (14px), colored text-[var(--color-down)]" — this is a verbatim match to what was implemented. The spec's color-usage table (line 77) assigns `--color-down` (#dc2626) to "Remove-ticker button/glyph" and explicitly (line 79) forbids using the purple accent (`--color-secondary-purple`) for the remove affordance ("Accent reserved for: the Add Ticker submit button background/border only ... Do not use purple for the remove affordance"). The spec never specifies a background, border, hover state, or minimum touch-target size for this element — it is silent on hit-area/affordance, only on glyph typography and color.
  implication: This is not an implementation bug that deviated from spec — the implementation is spec-compliant. The root cause is a design-contract gap: 02-UI-SPEC.md's Remove affordance clause (line 148) specified only the glyph's typography/color and omitted padding, hit-area sizing, background, and hover/focus treatment entirely. A correct fix must touch styling only (className changes), and per line 79's explicit constraint, must NOT use the purple secondary color — a background/border fix should use `--color-down` (red, already assigned to this element) or a neutral/border token (`--color-border`), not purple.

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/app/globals.css line 1 (`@import "tailwindcss"`) against installed Tailwind version (frontend/package.json: "tailwindcss": "4.3.3")
  found: globals.css itself defines no button rules, but `@import "tailwindcss"` pulls in Tailwind v4's Preflight base layer, which includes a universal reset targeting buttons: `margin: 0; padding: 0; border: 0 solid` and `background-color: transparent` (applied via `button, [type='button']` and the general `*` reset). This strips the browser UA stylesheet's default button padding/border (Chrome/Firefox default `<button>` UA styles are roughly `padding: 1px 6px` plus a ~2px outset border, which alone would have given the glyph a materially larger, roughly 20x20px+ box even with zero authored classes).
  implication: This is CONFIRMING evidence for the root cause, not a separate ruled-out hypothesis (superseding the earlier "no global button reset" elimination entry below — Preflight IS a global button reset, and it is actively in effect here). The button's hit-box isn't merely "unstyled" — Tailwind's Preflight has deliberately zeroed out what would otherwise be a larger default UA hit-box, and WatchlistRow.tsx's className never re-adds any padding to compensate. The fix must add padding/min-size explicitly; relying on any UA default is not an option under this Tailwind setup.

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/components/Watchlist.tsx lines 107-114 (the "Add Ticker" submit button, for contrast/design-system precedent)
  found: |
    <button
      type="submit"
      ...
      className="rounded bg-[var(--color-secondary-purple)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
    >
  implication: Every other interactive button already shipped in this codebase (the add-ticker submit button) has explicit padding (px-4 py-1.5), a background color, and rounded corners — giving it a generously-sized, visually-bounded click target. The remove button is the only interactive control in the watchlist panel with zero padding/background — an inconsistency with the project's own established button pattern, not just a UX best-practice violation.

- timestamp: 2026-09-19T00:00:00Z
  checked: grep for "hover:" across frontend/components and frontend/app; frontend/components/Watchlist.tsx line 105 (add-ticker input's focus classes)
  found: Zero `hover:` matches anywhere in the frontend — no hover-state convention exists yet. A `focus:` convention DOES exist, however: the add-ticker `<input>` (Watchlist.tsx:105) carries `focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-blue)]` — a blue focus ring is the project's one precedent for an interactive-state visual treatment.
  implication: No hover convention to reuse (a fix introducing hover styling is the first such pattern and should pick a token deliberately — see root_cause fix-direction notes), but keyboard-focus styling should reuse the existing blue-ring pattern (`focus:ring-1 focus:ring-[var(--color-primary-blue)]`) rather than invent a second focus convention — the remove button currently has no visible focus indicator at all, which is a secondary (keyboard-accessibility) gap alongside the mouse hit-area gap.

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/__tests__/Watchlist.test.tsx (all remove-button-related tests, lines ~210-295 and ~560-600)
  found: Existing tests assert only behavior — aria-label attribute, onRemove firing with correct ticker, stopPropagation against row onSelect, Enter-key activation — none assert on className or button dimensions.
  implication: A styling-only fix (adding padding/background/hover/min-size classes to the button) is unconstrained by and will not break the existing test suite.

## Resolution

root_cause: "The remove button (frontend/components/WatchlistRow.tsx:109-118) has className=\"text-sm text-[var(--color-down)]\" with no padding, no min-width/min-height, and no background/border — so its actual clickable hit-box is exactly the browser's default inline content-box for a single 14px '×' glyph (~8-10px × ~17-20px), far under standard touch/click-target minimums (WCAG 2.5.8 AA: 24×24px; 2.5.5 AAA: 44×44px). The wrapping <td> carries visual padding (py-1.5 pr-3) that makes the clickable-looking zone appear larger than the button's true hit box, so clicks near — but not exactly on — the glyph's tiny box silently miss, producing the reported 'requires precise positioning' / '2-3 clicks to trigger' symptom. This is not a bubbling/overlap/z-index defect (all ruled out in Eliminated) and not an implementation deviation from spec — it is a design-contract gap: 02-UI-SPEC.md line 148 specified only the glyph's typography/color for this element and never specified a hit-area size or background/hover affordance, so the implementation faithfully shipped an under-sized, backgroundless control."
fix: "NOT APPLIED — diagnosis only, per task instructions. Fix-direction notes for the implementing agent:

  SCOPE — two files, not one: since the root cause is a design-contract gap (not an implementation deviation), the fix must touch BOTH:
    1. frontend/components/WatchlistRow.tsx:109-118 (the button's className)
    2. .planning/phases/02-persistent-watchlist/02-UI-SPEC.md:148 (the Remove affordance clause) and its color table at :77 — update the spec to describe the corrected hit-area/affordance contract so the design doc doesn't keep describing the broken control.

  SIZING CONSTRAINTS (all three must hold simultaneously): (a) WCAG 2.5.8 AA minimum target size is 24x24px; (b) 02-UI-SPEC.md:45-49 restricts new elements to the 8px(sm)/16px(md) Tailwind scale, or the existing 6px (py-1.5) row-padding exception; (c) the fix must not grow row height (~32px: 20px line-height + py-1.5's 12px). A fixed 24x24px box centered in the cell (e.g. inline-flex, items-center, justify-center, h-6 w-6, rounded) satisfies all three without growing the row — verify against the actual rendered row height before committing to exact classes.

  COLOR CONSTRAINT: 02-UI-SPEC.md:79 explicitly forbids purple (`--color-secondary-purple`) on the remove affordance — that token is reserved for the Add Ticker submit button only. Any new background/border/hover treatment must use `--color-down` (already assigned to this element, line 77) or a neutral token (`--color-border`), not purple.

  FOCUS STATE: reuse the existing blue-ring convention (`focus:ring-1 focus:ring-[var(--color-primary-blue)]`, precedent at Watchlist.tsx:105) rather than inventing a new focus treatment — the button currently has no visible focus indicator.

  OPEN DESIGN DECISION (surface to user/spec-owner, don't resolve unilaterally): the user asked for styling that makes the control 'stand out from the surrounding background' — this reads as a request for a visible resting-state treatment (e.g., a subtle red-tinted chip/circle around the × at all times), not merely a hover-only reveal. A hover-only fix (background appears only on mouse-over) would fix the click-precision problem but not satisfy 'stand out' since nothing is visible until the cursor is already there. A permanent low-opacity red background on all ten rows is a more visible design change and should be confirmed as in-scope before implementing, since it changes the resting appearance of every watchlist row rather than being a hover-only affordance."
verification: "N/A — no fix applied"
files_changed: []

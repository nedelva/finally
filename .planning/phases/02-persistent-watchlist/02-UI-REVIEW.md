# Phase 02 — UI Review

**Audited:** 2026-09-19
**Baseline:** 02-UI-SPEC.md (approved design contract)
**Screenshots:** Captured (desktop 1440×900, tablet 768×1024, mobile 375×812)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All declared copy strings match contract exactly; input placeholder, button label, empty state, and error messages verified in source |
| 2. Visuals | 3/4 | Layout and visual hierarchy correct; watchlist focal point clear; but remove affordance blends with adjacent session-change-% red, and scroll region has no affordance indication |
| 3. Color | 2/4 | Color tokens correct (`#753991` purple, `#dc2626` red); but `--color-down` now serves dual semantic purposes (price-decrease + destructive) with no visual distinction, creating confusion at row level; primary / secondary / accent distribution held |
| 4. Typography | 4/4 | New elements use exact declared sizes (14px text-sm for body/error/glyph, 16px semibold for button); zero new weights introduced; Phase 1 table typography unchanged |
| 5. Spacing | 2/4 | Form and error text use declared scale (sm/md); but 5th column (remove button cell) uses `pr-3` = 12px, which is neither the 8px / 16px / 6px values specified in the contract — a contract breach introduced in 02-03 and never corrected |
| 6. Experience Design | 2/4 | Loading/error/empty states render with correct precedence and copy; form in-flight disabled state (`Adding…`) verified in source; remove action executes immediately as designed; but keyboard focus indicator stripped from primary interaction (row click-to-chart), and remove-affordance input lacks accessible name — WCAG failures |

**Overall: 17/24** (71% — contains 2 blockers, 3 WCAG violations, 2 contract breaches, 1 regression from gap-closure phase)

---

## Priority Fixes (6 total, listed by severity)

### BLOCKER Issues (fix before shipping)

1. **Keyboard focus ring missing on watchlist row (WCAG 2.4.7)** — `WatchlistRow.tsx:88` applies `focus:outline-none` to the `<tr tabIndex={0}>` with no replacement `focus:ring`. A keyboard user tabbing through the watchlist sees zero indication of focus on the primary click-to-chart affordance. **Fix:** Add `focus:ring-1 focus:ring-[var(--color-primary-blue)]` to the row's className, matching the treatment already applied to the remove button (line 115). User impact: Full keyboard navigation is blocked for screen-reader users and power users relying on Tab; accessibility lawsuit risk (WCAG 2.4.7 failure). Concrete fix: `className={`... focus:ring-1 focus:ring-[var(--color-primary-blue)] ...`}`

2. **Add-ticker input has no accessible name (WCAG 3.3.2)** — `Watchlist.tsx:98-106` has no `<label>` or `aria-label`, only a placeholder. Screen readers announce "textbox" with no context; placeholder vanishes on first keystroke per spec. **Fix:** Add `aria-label="Add a ticker symbol"` to the input element. User impact: Blind and low-vision users cannot understand the field's purpose; form is unusable without labels. Concrete fix: `<input ... aria-label="Add a ticker symbol" ... />`

### WARNING Issues (fix recommended; degrades quality)

3. **Scroll container has no overflow affordance** — `Watchlist.tsx:122` bounds the table to `lg:max-h-[440px] overflow-y-auto` but provides no visual cue (scrollbar, fade, count) that rows exist beyond the visible 11. Desktop screenshot shows ABC as the last visible row; internally, 5 more rows are present but hidden with zero indication. User clicks "remove ABC" expecting the grid to show DEF next, but DEF is already there, invisible above. **Fix:** Add a scroll affordance — options include: (a) force macOS scrollbar visible via `.overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-500`, or (b) add a count badge ("15 tickers" / "showing 1-11"), or (c) fade the bottom edge with a `mask-image` gradient. User impact: Power users on desktop with large watchlists will be confused by invisible rows; usability degradation for >11 tickers. Concrete fix: Add `[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-gray-600` classes to the scroll container div.

4. **Remove affordance color blend with session-change percentage** — `WatchlistRow.tsx:115` renders the remove button with permanent `bg-[var(--color-down)]/10 ... border-[var(--color-down)]/40` background/border, creating a column of red boxes running directly beside the Change % column (also mostly red for down-tickers). The two reds are now semantically indistinguishable at a glance: "Is this red box a down-move indicator or a remove button?" 02-05 amended the UI-SPEC's remove-affordance section to document the shipped behavior but never revisited the Color section's justification that `--color-down` serves both semantics with no visual distinction. **Fix:** Either (a) use a neutral background like `bg-gray-600/20` for the remove button (reduce saturation), or (b) add affordance text like a label below the × or a tooltip, or (c) introduce a second destructive token like dark red (`#991919`). User impact: Visual parsing of the watchlist is slower; power traders scanning for down-moves may misread the grid. Concrete fix (minimal): Change `bg-[var(--color-down)]/10` to `bg-gray-600/15` and `border-[var(--color-down)]/40` to `border-gray-600/40`.

5. **Spacing contract breach on 5th column** — `Watchlist.tsx:86` (header cell) and `WatchlistRow.tsx:108` (remove button cell) both use `pr-3` = 12px padding-right. The UI-SPEC explicitly requires: "New elements this phase must use only `sm`(8px)/`md`(16px) for their own layout, or the `6px` row-padding exception." 12px is not in that list. Mitigation: It mirrors the sparkline cell (`pr-3`) for alignment, so reducing it risks column misalignment. **Fix:** Either (a) update the UI-SPEC's spacing exceptions to formally include 12px with rationale ("column alignment with sparkline cell"), or (b) reduce both to `pr-2.5` = 10px (odd but closer to spec), or (c) refactor the remove cell to use `pr-0` and add `px-1` directly to the button to keep the 24×24px hit area without the cell padding. User impact: Low (layout holds, alignment is correct); specification compliance issue, not a visual defect. Concrete fix: Add to UI-SPEC's exceptions table: "12px (`pr-3`) — 5th column (remove affordance, sparkline alignment) to match sparkline cell padding."

6. **Tablet layout: chart pushed below watchlist, empty state undesigned** — Tablet (768px) screenshot shows the chart panel starting at ~y=830, below 16 fully-visible watchlist rows. The chart itself renders only the word "Chart" with an empty body below, unlike desktop which shows the selected ticker's candlestick. Per PLAN.md §2, the app is "functional on tablet" — this is not a functional tablet layout. **Fix (a) Layout:** The stacked-below layout is correct (touchscreen-friendly, no side-by-side panels). Verify that pressing L width (1024px for `lg:`) on the viewport properly triggers the side-by-side layout. (b) Empty chart state: Per the UI-SPEC, the chart's empty state ("no selection") has no declared copy or styling. Add a fallback heading like "Select a ticker to view its chart" in the empty chart area. User impact: Tablet users waste vertical scroll to see the chart; empty chart state is confusing. Concrete fix: (a) Confirm responsive behavior at `lg:` breakpoint; (b) add empty-state text to MainChart: `{selectedTicker ? <CandlestickChart> : <div className="text-center text-gray-500">Select a ticker to view its chart</div>}`

### Minor Issue

7. **Seed database differs from PLAN.md default** — Screenshots show AAPL, MSFT, AMZN, TSLA, JPM, V, NFLX, PYPL, META, JP, ABC, DEF, GHI, NOP, QRS, TUV (16 tickers). PLAN.md §7 seeds exactly ten: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX. Missing: GOOGL, NVDA. Extra: ABC, DEF, GHI, NOP, QRS, TUV, JP. This suggests either test detritus or a non-default seed. **Fix:** Verify database seeding in `backend/app/db/init.py` matches PLAN.md's default list, or document the alternate seed if intentional. User impact: None on functionality; the visuals audited above are not specific to ticker choice. Concrete fix: `grep -A10 "DEFAULT_TICKERS\|seed" backend/app/db/init.py` and confirm against PLAN.md §7.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4 — PASS)

**Evidence-based pass:**

- Button label "Add Ticker" ✓ (`Watchlist.tsx:113`)
- Input placeholder "Add ticker (e.g. PYPL)" ✓ (`Watchlist.tsx:104`)
- Empty state heading "Watchlist is empty" ✓ (`Watchlist.tsx:147`)
- Empty state body "Add a ticker above to start streaming its price." ✓ (`Watchlist.tsx:148`)
- Client-side error "Enter a ticker symbol to add it." ✓ (`Watchlist.tsx:45`)
- In-flight button label "Adding…" ✓ (`Watchlist.tsx:113` ternary)
- Loading state "Loading watchlist…" ✓ (`Watchlist.tsx:133`)

All four declared error strings (empty, malformed, duplicate, generic) are rendered in source; none verified rendered in a running UI (no interactive test captured), but the copy strings match the contract byte-for-byte. No generic labels like "OK" or "Submit" used. Empty/error states use the declared copy verbatim.

**Score justification:** Copywriting is a code-level contract. All declared strings match exactly. No generic labels present. UI-SPEC signatures verified. No deviation. Score 4/4 reflects perfect compliance.

---

### Pillar 2: Visuals (3/4 — NEEDS WORK)

**Strengths:**

- Watchlist panel is the clear focal point on desktop (left side, bordered)
- Add-ticker form row is visually distinct (purple button draws the eye first)
- Remove affordance (× button) is visible on each row
- Table has clear row separation with borders and alternating row background on selection
- Connection status indicator (green dot) is visible in header
- Sparkline mini-charts render in the fourth column
- Price flash animation (green/red brief color) is enabled per `usePriceFlash` hook

**Issues:**

- **Remove affordance blends with session-change-% column:** The new 5th column (remove button with red box) runs immediately adjacent to the Change % column, which is also predominantly red for down-tickers. Visual scanning of "what's going down" is ambiguous. See Priority Fix #4.
- **Scroll region has no affordance:** The bounded watchlist (`lg:max-h-[440px] overflow-y-auto`) hides rows on desktop with zero indication (no visible scrollbar on macOS, no fade, no count). See Priority Fix #3.
- **Tablet: empty chart state** See Priority Fix #6(b).

**Visual hierarchy:** Correct (form → table → sparklines). **Focal point:** Correct (form row). **Spacing:** Visually consistent (covered under Pillar 5).

**Score justification:** Layout and hierarchy are correct; affordances are present. But color blend and missing scroll affordance degrade visual clarity. Score 3/4: good with notable gaps.

---

### Pillar 3: Color (2/4 — MAJOR ISSUE)

**Color distribution (60/30/10 applied per UI-SPEC):**

- Dominant (60%): `#0d1117` (--color-bg) ✓ Page background and base
- Secondary (30%): `#161b22` (--color-panel) / `#30363d` (--color-border) ✓ Panels, table borders
- Accent (10%): `#753991` (--color-secondary-purple) ✓ Add Ticker button ONLY (verified: no other uses of `--color-secondary-purple` outside of line 111)
- Destructive (error): `#dc2626` (--color-down) — **PROBLEM**

**The problem:** `--color-down` now serves **two distinct semantic purposes** with zero visual differentiation:

1. **Price-decrease indicator:** Session change % column (mostly red for down moves). Example: AAPL -2.99% renders in red.
2. **Destructive action indicator:** Remove button background/border. Example: × button cell.

**Root cause:** When the UI-SPEC was written, the remove affordance was planned as a bare 14px glyph: `text-[var(--color-down)]`. The color assignment made sense — a single red text element. In gap-closure phase 02-05, to meet WCAG 2.5.8's 24×24px hit-area requirement, a **permanent** background + border were added: `bg-[var(--color-down)]/10 + border-[var(--color-down)]/40`. This created a column of persistent red boxes running beside an already-red column. The UI-SPEC's Color section was **not revisited** to resolve the semantic clash.

**Evidence:** 
- `WatchlistRow.tsx:115` — remove button uses `bg-[var(--color-down)]/10` + `border-[var(--color-down)]/40` + `text-[var(--color-down)]`
- `WatchlistRow.tsx:101` — change-percent uses `text-[var(--color-down)]` for negative values
- Desktop screenshot shows ~5 red "%" labels and ~5 red "×" buttons in the same visual field

**Workaround in spec:** The UI-SPEC's Color section says: "`--color-down` is deliberately dual-purpose (price-decrease semantics in Phase 1, destructive/error semantics in Phase 2) — there is no second red in the palette and PLAN.md defines none." This justification was written before the permanent red box was added. It is now stale.

**User impact:** A power trader scanning the watchlist for down-moves sees two categories of red and cannot distinguish at a glance: "Is this position down, or is it marked for deletion?" This slows parsing and creates cognitive load.

**Score justification:** Color tokens are correct and WCAG-compliant (sufficient contrast). But semantic clarity is compromised. Score 2/4: foundational compliance but user-facing color confusion.

---

### Pillar 4: Typography (4/4 — PASS)

**Declared new-element typography (phase 2 only):**

| Element | Size | Weight | Spec | Source | Status |
|---------|------|--------|------|--------|--------|
| Input text | 14px | 400 | text-sm | `Watchlist.tsx:105` | ✓ |
| Input placeholder | 14px | 400 | text-sm | `Watchlist.tsx:105` | ✓ |
| Submit button | 14px | 600 | text-sm + font-semibold | `Watchlist.tsx:111` | ✓ |
| Error message | 14px | 400 | text-sm | `Watchlist.tsx:118` | ✓ |
| Remove glyph (×) | 14px | 400 | text-sm | `WatchlistRow.tsx:115` | ✓ |
| Empty state heading | 14px | 500 | *not specified* | `Watchlist.tsx:147` | ⚠ (font-medium not listed) |
| Empty state body | 14px | 400 | text-sm | `Watchlist.tsx:148` | ✓ |

**Additional:** Phase 1's table header (12px / font-medium / 500) and body text are unchanged and outside this phase's scope per the UI-SPEC's scope note.

**Zero new font weights introduced:** Both 400 (regular) and 600 (semibold) already exist in Phase 1's shipped scale. No new weights added.

**Minor note:** Empty-state heading uses `font-medium` (500) which is not explicitly listed in the "This phase's typography contract (new elements only)" table. However, the empty-state copy itself is listed under the Copywriting Contract, so the heading is implicitly covered by the existing 400/600 palette. The 500 weight appears to be reusing Phase 1's existing treatment (not a new weight). This is a documentation gap (the heading's weight should be listed in the Typography section), not a functional issue.

**Score justification:** All new elements use declared sizes and weights. No size creep (no 12px or 16px text introduced). No new weights. Perfect compliance. Score 4/4.

---

### Pillar 5: Spacing (2/4 — CONTRACT BREACH)

**Declared spacing scale (UI-SPEC):**

| Token | Value | Spec Usage | Actual Usage | Status |
|-------|-------|-----------|--------------|--------|
| xs | 4px | Icon gaps | Not visibly used in watchlist controls | ✓ |
| sm | 8px | Form element gaps | `gap-2` form row (`Watchlist.tsx:96`) | ✓ |
| md | 16px | Default element padding | `p-4` form row, input `px-2`, button `px-4` | ✓ |
| lg | 24px | Section padding | Not used in watchlist | ✓ (not required) |
| xl | 32px | Layout gaps | Not used in watchlist | ✓ (not required) |
| **Exception: 6px** | py-1.5 | Table row vertical padding | All table cells, include remove cell | ✓ |
| **Undeclared: 12px** | pr-3 | *Not in spec* | 5th column header + remove-button cell | ✗ |

**The breach:**

```html
<!-- Watchlist.tsx:86 -->
<th className="py-2 pr-3 font-medium"></th>

<!-- WatchlistRow.tsx:108 -->
<td className="py-1.5 pr-3 text-right">
  <button ...>×</button>
</td>
```

Both use `pr-3` = 12px (0.75rem). The UI-SPEC explicitly states:

> "New elements this phase (add-ticker form row, remove button) must use only `sm`(8px)/`md`(16px) for their own layout, or the `6px` row-padding exception when placed inside the existing table structure — **no new off-scale values**."

12px is not 8, 16, or 6. It is an undeclared off-scale value.

**Mitigation:** The 12px was chosen to match the sparkline cell (`<td className="py-1.5 pr-3">` — line 105), ensuring column alignment. So there is a design rationale (avoid misaligned columns). However, the rationale is not in the UI-SPEC.

**Options to fix:**
1. Update UI-SPEC's exceptions table to add: "12px (`pr-3`) — 5th column alignment with sparkline cell"
2. Reduce both to `pr-2.5` (10px) — odd but closer to scale
3. Refactor: remove cell padding (`pr-0`), add padding directly to button (`px-1`)

See Priority Fix #5.

**Score justification:** Spacing on the form row (sm/md) is correct. But the 5th column breaches the declared scale. Score 2/4: partial compliance with one notable violation.

---

### Pillar 6: Experience Design (2/4 — WCAG FAILURES + MISSING STATES)

**Declared state coverage (UI-SPEC UI Considerations):**

| State | Element | Declared? | Rendered? | Verified | Status |
|-------|---------|-----------|-----------|----------|--------|
| Empty (unfilled form) | add-ticker input | ✓ | ✓ | Placeholder "Add ticker (e.g. PYPL)" | ✓ |
| Loading (submit in-flight) | add-ticker button | ✓ | ✓ | "Adding…" text + disabled state | ✓ |
| Error (validation) | add-ticker form | ✓ | ✓ (source only) | `watchlist-add-error` slot renders verbatim server error | ✓ source |
| Partial fields | add-ticker form | N/A | N/A | Form has one field only | ✓ |
| Empty grid (0 tickers) | watchlist table | ✓ | ✓ | "Watchlist is empty" / "Add a ticker above..." | ✓ |
| Loading grid (initial fetch) | watchlist table | 🧪 backstop | ✓ | "Loading watchlist…" row + table shell, no layout jump (02-04 fix) | ✓ source |
| Error grid (GET failure) | watchlist table | 🧪 backstop | ✓ (source only) | `watchlist-load-error` slot renders verbatim error | ✓ source |
| Populated (1-N tickers) | watchlist table | ✓ | ✓ | Rows render with ticker/price/change/sparkline | ✓ |
| Remove affordance | per row × button | ✓ | ✓ | Immediate removal, no confirm, stopPropagation guard | ✓ source |
| **Focus indicator on row** | row `<tr tabIndex={0}>` | *Not mentioned* | ✗ | `focus:outline-none` with NO `focus:ring` | **✗ BLOCKER** |
| **Accessible name on input** | input element | *Not mentioned* | ✗ | No `aria-label`, no `<label>`, placeholder only | **✗ BLOCKER** |

**WCAG Failures:**

1. **WCAG 2.4.7 — Focus Indicator**: The row click-to-chart affordance (`<tr tabIndex={0}>`) has `focus:outline-none` with no replacement ring. Keyboard users navigating via Tab see zero focus indication. The remove button (line 115) HAS `focus:ring-1 focus:ring-[var(--color-primary-blue)]`, so the pattern exists elsewhere — it's just not applied to the row itself. **Severity: Hard failure, blocks keyboard navigation.**

2. **WCAG 3.3.2 — Label for Form Input**: The add-ticker input has no `aria-label` and no `<label>` element. Only a placeholder ("Add ticker (e.g. PYPL)"). Per WCAG, placeholder alone is not a valid label because: (a) it vanishes when the user types, and (b) placeholder is display text, not an accessible name. Screen readers announce "textbox" with no context. **Severity: Hard failure, makes form unusable for blind users.**

**Other experience design observations:**

- **Scroll container affordance:** Covered under Pillar 2 / Priority Fix #3. The bounded `lg:max-h-[440px] overflow-y-auto` hides rows with no visual cue (no scrollbar, no fade, no count).
- **Remove button color blend:** Covered under Pillar 3 / Priority Fix #4.
- **Tablet chart empty state:** Covered under Priority Fix #6.
- **Error on failed DELETE:** The UI-SPEC leaves this as a backstop item. Code shows `handleRemove()` → `setError(result.error)` on failure (lines 65-73), which renders in the shared `watchlist-add-error` slot. This is covered but not visually tested.

**Score justification:** Loading/error/empty states render correctly. Remove flow is correct. But two WCAG accessibility violations (focus indicator, input name) and one missing affordance (scroll indication) significantly degrade usability. Score 2/4: states are present but interaction accessibility is broken.

---

## Registry Safety

Not applicable — `Tool: none`, `shadcn_initialized: false`, no third-party component registries used. Skipped per guidelines.

---

## Files Audited

- `frontend/components/Watchlist.tsx` (main watchlist container, form, load states)
- `frontend/components/WatchlistRow.tsx` (per-row rendering, remove affordance)
- `frontend/app/page.tsx` (layout, chart/watchlist height decoupling via `lg:items-start`)
- `frontend/app/globals.css` (color token definitions)
- `backend/app/db/repository.py`, `backend/app/api/watchlist.py` (watched via source, copywriting verified)
- `frontend/__tests__/Watchlist.test.tsx` (test assertions verify state coverage)

---

## Summary

Phase 02's implementation is **code-complete and mostly correct** against the UI-SPEC contract, but ships with:

- **2 WCAG accessibility blockers** (focus ring, input label) that break keyboard navigation and screen-reader usability
- **1 regression from gap-closure phase 02-05** (scroll affordance) that hides data from power users
- **2 color/visual clarity issues** (semantic red blend, scroll indication)
- **1 spacing contract breach** (12px off-scale column padding)

The watchlist is **functionally complete** (add/remove/persist/sync all work) and visually **nearly correct** (layout, hierarchy, dark theme all match). The defects are **quality and accessibility issues**, not missing functionality. Before shipping, fix the two WCAG blockers and the scroll affordance. Consider the color blend and spacing contract as follow-up fixes in a post-launch polish pass.

**Recommended action:** Treat items 1 & 2 as must-fix before release. Items 3–6 as recommended follow-up fixes for Phase 2.1 or a design polish sprint.

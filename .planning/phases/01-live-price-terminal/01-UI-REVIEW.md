# Phase 01 — UI Review

**Audited:** 2026-09-18
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists)
**Screenshots:** Not captured (dev server available but browser capture failed; code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | No generic labels; clear empty/loading states; disclosure preserved but not visible in all views |
| 2. Visuals | 2/4 | Hierarchy and focal points exist in code; animation effects untested (cannot verify flash effect timing without rendering) |
| 3. Color | 1/4 | Hardcoded hex values in chart components; CSS theme tokens ignored for SVG elements |
| 4. Typography | 3/4 | Consistent hierarchy (xs/sm/base/xl); only 2 weights used (medium/semibold); reasonable scale |
| 5. Spacing | 3/4 | Standard Tailwind scale used consistently; one minor inconsistency (0.5 gap in Header vs 1.5/2 elsewhere) |
| 6. Experience Design | 2/4 | Connection status clear but flawed; keyboard activation breaks semantic role; empty states present but not comprehensive |

**Overall: 14/24** — Terminal architecture is present but accessibility and visual specification adherence have critical gaps.

---

## Top 3 Priority Fixes

1. **Remove `role="button"` from table rows (BLOCKER)** — `WatchlistRow.tsx:62` applies `role="button"` to `<tr>`, which destroys table semantics and makes `aria-selected` invalid (only supported on `row`, `gridcell`, `option`, `tab`, `treeitem` roles). Screen readers announce buttons instead of rows. **Fix:** Replace row-level click handling with proper `gridcell` role on price cells, or use a div-based grid and restore button semantics without overriding table structure. This breaks accessibility compliance.

2. **Extract hardcoded colors to theme tokens or props** — `Sparkline.tsx:26` and `MainChart.tsx:53, 64, 70, 76, 83` use hardcoded hex values (`#209dd7`, `#30363d`, `#8b949e`, `#161b22`) instead of CSS theme variables. Recharts SVG elements don't resolve CSS custom properties in presentation attributes — the stated reason is legitimate — but the fix is to pass these values as props derived from theme tokens, or use inline `style` objects. **Affected:** 6 hardcoded values across 2 components. **Fix:** Define a `themeColors` config object and pass it to chart components.

3. **Header omits portfolio total and cash balance (WARNING)** — `Header.tsx` intentionally renders no dollar-denominated figures, per plan 01-05's deliberate deferral to PORT-01/Phase 3. However, PLAN.md §10 "Header" lists both as header content. While the deferral is documented and justifiable, the current terminal header reads as incomplete against the spec. **Fix:** Document this gap in PRD or accept it as a known omission until Phase 3. Not a code error, but a spec/roadmap gap to surface.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Findings:**

- **Generic label avoidance:** No "Submit", "OK", "Cancel", "Click Here" patterns found. CTAs are context-specific and clear.
- **Empty states:** 
  - `MainChart.tsx:97` — "Pick a ticker from the watchlist to view its chart" (clear instruction)
  - `MainChart.tsx:118` — "Waiting for data…" (accurate while history accumulates)
  - Both are well-worded and contextual.
- **Connection status text:** `ConnectionDot.tsx:21-26` uses full words ("Connected", "Connecting", "Reconnecting", "Disconnected") not abbreviations.
- **Disclosure compliance:** `Header.tsx:24` renders "AI Trading Workstation — Simulated market data", which survives the watchlist replacement per plan 01-04/01-05 audit notes. ✓
- **Placeholder issue (WARNING):** When no ticker is selected, the chart says "Pick a ticker from the watchlist to view its chart" — but on mobile/narrow viewports where the watchlist is stacked below the chart, this instruction appears without a visible watchlist to act on. Order-dependent UX. Not tested without actual rendering.

**Score rationale:** Generic-label avoidance is strong; disclosure is correct. Deduction: placeholder text order dependency and no loading spinner (only text) during SSE connection ramp-up.

---

### Pillar 2: Visuals (2/4)

**Findings — Code-verified, screenshot-unverified:**

- **Focal point:** Chart area as primary focus (right side on wide, below on narrow); watchlist secondary. ✓
- **Flash animation contract:** `globals.css:21-45` defines keyframes; `WatchlistRow.tsx:48` calls the hook; the hook returns the class name. The animation mechanism is wired. Cannot verify 550ms timing or visual effect (no rendering).
- **Hierarchy indicators:** 
  - Font size: title `text-xl` (brand), chart ticker `text-base`, labels `text-sm`, helper text `text-xs`. ✓
  - Weight: headings `font-semibold`, content `font-medium` or default. ✓
  - Color: primary blue on sparklines (`#209dd7`), accent yellow on brand (`--color-accent-yellow`). ✓
- **Accessibility indicators:** Muted uppercase header with proper semantic structure, tabular-figure alignment on numbers (`tabular-nums` class on price/percentage cells). ✓
- **Untestable without rendering:** 
  - Whether flash-up (green) and flash-down (red) are visually distinguishable on dark background
  - Whether color-contrast meets WCAG (AA/AAA)
  - Animation timing and fade behavior
  - Actual terminal aesthetic vs. intended "Bloomberg-like" design

**Score rationale:** Visual hierarchy and animation infrastructure are present; specific visual fidelity cannot be verified without screenshots. Code review suggests competent design, but no evidence of testing.

---

### Pillar 3: Color (1/4)

**Critical finding: Hardcoded colors violate design system.**

**Inventory:**

| File | Line | Value | Rationale Given | Issue |
|------|------|-------|-----------------|-------|
| `Sparkline.tsx` | 26 | `#209dd7` (primary blue) | SVG `stroke` attr doesn't resolve CSS vars | Hardcoded instead of token |
| `MainChart.tsx` | 53 | `#209dd7` (primary blue) | Same reason | Hardcoded instead of token |
| `MainChart.tsx` | 64 | `#30363d` (border) | Grid stroke; SVG attr | Should use `--color-border` |
| `MainChart.tsx` | 70 | `#8b949e` (gray) | Axis stroke; not in theme | Undeclared, hardcoded |
| `MainChart.tsx` | 76 | `#8b949e` (gray) | Axis stroke; not in theme | Undeclared, hardcoded |
| `MainChart.tsx` | 83 | `#161b22` (panel bg) | Tooltip bg; matches panel | Should derive from theme |

**Declared theme tokens** (in `globals.css:3-12`):
```
--color-bg: #0d1117
--color-panel: #161b22
--color-border: #30363d
--color-accent-yellow: #ecad0a
--color-primary-blue: #209dd7
--color-secondary-purple: #753991
--color-up: #16a34a
--color-down: #dc2626
```

Four of the six hardcoded values match declared tokens; two are external (gray axis colors). **The stated reason (SVG presentation attributes don't resolve CSS vars) is legitimate** — this is a known limitation of Recharts' `stroke` prop. **However, the solution is not "hardcode it"; the solution is to pass these as props or use inline `style` objects.**

**Fix:** Extract a theme colors config, pass to Recharts components:
```typescript
const chartTheme = {
  primary: "var(--color-primary-blue)", // or computed #209dd7
  border: "var(--color-border)",
  grid: "#8b949e",
  tooltip: "var(--color-panel)",
};
<Line stroke={chartTheme.primary} ... />
<CartesianGrid stroke={chartTheme.border} ... />
```

**Score:** 1/4 — Color specification is not followed; hardcoded values prevent theme consistency and future maintainability.

---

### Pillar 4: Typography (3/4)

**Findings:**

**Font sizes in use:**
- `text-xs` (labels, status text) — 3 uses
- `text-sm` (table cells, chart labels) — 4 uses
- `text-base` (chart ticker name) — 1 use
- `text-xl` (brand) — 1 use

**Total: 4 distinct font sizes** (slightly above ideal "2-3 for a minimal interface" but reasonable for a terminal with multiple hierarchy levels).

**Font weights in use:**
- `font-medium` (header cells, chart heading, labels) — 5 uses
- `font-semibold` (brand, ticker name, row symbol) — 3 uses
- Default/unspecified (body text) — implied

**Total: 2 weights** (good restraint).

**Hierarchy logic:** Excellent. Brand is largest (xl, semibold, accent color). Chart ticker is next (base, semibold). Labels and content descend properly (sm, medium; xs, medium). **No weight inflation or size multiplication** — consistent and clean.

**Minor issue:** The `text-left` alignment on header row is explicit, but all numeric columns should use `text-right` or rely on `tabular-nums` for alignment — checking code, I see `tabular-nums` class is applied but no explicit text alignment. This is a micro-optimization (Tailwind's default is `text-left`, so numeric columns relying only on the font should right-align). Not a pillar failure, but worth noting.

**Score:** 3/4 — Hierarchy and restraint are strong; one alignment micro-issue.

---

### Pillar 5: Spacing (3/4)

**Inventory of spacing classes:**

| Class | Usage Count | Scale Value | Notes |
|-------|-------------|-------------|-------|
| `gap-0.5` | 1 (Header) | 0.125rem | Very tight; stands out |
| `gap-1.5` | 1 (ConnectionDot) | 0.375rem | Tight but reasonable |
| `gap-2` | 1 (page) | 0.5rem | Standard |
| `gap-3` | 2 (Watchlist header, MainChart header) | 0.75rem | Generous |
| `gap-4` | 3 (page columns, Watchlist table, Header between brand/dot) | 1rem | Standard |
| `p-3` | 1 (Watchlist table) | 0.75rem | Tight padding |
| `p-4` | 1 (Header, MainChart chrome) | 1rem | Standard |
| `p-8` | 1 (page main) | 2rem | Generous page margin |
| `py-1.5` | 3 (table rows) | 0.375rem | Tight row padding |
| `py-2` | 1 (header row) | 0.5rem | Slightly more spacious |
| `pl-3`, `pr-4` | Multiple (table cells) | 0.75rem / 1rem | Consistent cell padding |

**Pattern:** Heavy use of Tailwind's standard 0.5rem/1rem/1.5rem scale. **Gap of 0.5 is notably tighter than the 1.5/2 used for major sections** — this might create visual inconsistency (Header detail spacing vs. main layout spacing). Minor inconsistency but not a failure.

**No arbitrary values** (no `[12px]` or custom spacing). All values are on-scale. ✓

**Score:** 3/4 — Standard scale used throughout; one minor spacing-rhythm inconsistency between component-internal gaps (0.5) and major layout gaps (2-4).

---

### Pillar 6: Experience Design (2/4)

**Findings:**

**Loading states:**
- SSE stream: Status is exposed via `ConnectionStatus` union. ✓
- Chart data: "Waiting for data…" message while history is empty. ✓
- Watchlist: Renders em-dashes for tickers with no price yet (`formatPrice` behavior). ✓

**Error states:**
- Disconnect: Connection status turns red (`disconnected` state). ✓
- No errors shown to user for API failures, malformed data, etc. (backend spec, not frontend concern for this phase). ✓

**Empty states:**
- No tickers selected: "Pick a ticker from the watchlist to view its chart." ✓
- Selected ticker with no history: "Waiting for data…" ✓
- These are real UI, not skeletons or spinners. ✓

**Disabled states:**
- Watchlist row keyboard activation (Enter/Space on `<tr role="button">`) works. ✓
- No delete/sell/trade buttons exist (deferred to portfolio phase). ✓

**Confirmation for destructive actions:**
- None exist (phase scope does not include trades yet). ✓

**CRITICAL ISSUE: Semantic accessibility broken.**

`WatchlistRow.tsx:62` applies `role="button"` to a table row. This is a **destructive override:**

| Before | After |
|--------|-------|
| `<tr>` → implicit `row` role | `role="button"` overwrites `row` |
| Parent: `<tbody>` | Parent: still tbody (role mismatch) |
| `aria-selected` valid on `row` | `aria-selected` invalid on `button` |
| Screen reader: "row N, symbol AAPL, price 123.45" | Screen reader: "button, AAPL" (no table context) |

The keyboard activation (Enter/Space) is correct *in isolation*, but **the implementation choice breaks table semantics and therefore accessibility.** A screen reader user cannot understand that they are selecting tickers within a table context.

**Proper fix options:**
1. Move click handling to individual cells with `role="gridcell"` instead of row-level button
2. Use a div-based grid (`role="grid"`) with proper cell and row roles
3. Keep the row, remove `role="button"`, use `onclick` + tabindex (native `<tr>` doesn't support click by default, so this requires JavaScript on the parent `<tbody>` or delegation)

**Connection dot connection recovery:**
- EventSource has native retry (`retry: 1000` per backend). ✓
- Plan 01-02 translates open/error to status; the dot just displays. ✓
- **No hand-rolled reconnection** per spec. ✓
- However, **recovery is not guaranteed** — if the backend crashes, EventSource will retry for ~1min then give up. The dot will show red but no error message explains why. Not a failure for this phase (spec does not require debugging UI), but worth noting.

**Confirmation and validation:**
- No blocking validation on selection (immediate effect). ✓
- No confirmation (simulated money, low stakes). ✓

**Score:** 2/4 — Status indication and empty states work; keyboard activation works; but **semantic role destruction is a BLOCKER** for accessibility. Deduction for missing error narrative (connection loss not explained to user, only shown as red dot).

---

## Files Audited

- `frontend/app/globals.css` — Theme tokens, keyframe definitions
- `frontend/app/layout.tsx` — Root metadata and structure
- `frontend/app/page.tsx` — Composition root, Terminal component with selection state
- `frontend/components/Watchlist.tsx` — Grid container reading stream context
- `frontend/components/WatchlistRow.tsx` — Individual row with flash, color, sparkline, **role="button" issue**
- `frontend/components/Sparkline.tsx` — Recharts line chart, **hardcoded #209dd7**
- `frontend/components/Header.tsx` — Brand, disclosure, connection dot
- `frontend/components/ConnectionDot.tsx` — Four-state status indicator with text and aria-label
- `frontend/components/MainChart.tsx` — Labelled-axis chart, **multiple hardcoded colors**
- `frontend/lib/format.ts` — Null-safe formatters (all guarded, em-dash on missing)

---

## Accessibility Findings (Cross-Cutting)

Beyond the pillar scores, two accessibility concerns exist:

1. **Semantic role destruction** (Pillar 6, BLOCKER) — `role="button"` on `<tr>` makes the table unreadable to screen readers. **Must fix before shipping.**

2. **Color-only information** — ConnectionDot correctly adds text and aria-label, ✓ but price flash (green up, red down) is color-only. On dark backgrounds, color contrast may fail WCAG AA. Cannot verify without rendering. No text alternative for the flash (e.g., "↑" or "↓" symbol). Consider adding a subtle icon or text indicator.

3. **Keyboard trap risk** — MainChart's "Pick a ticker" placeholder appears on mobile below the watchlist, but clicking a watchlist row scrolls the chart into view (no explicit scroll behavior in code reviewed). If browsers auto-scroll, good; if not, a user navigating by keyboard might select a row and see no visual change, not realizing the chart is off-screen.

---

## Verification Summary

- **Verified from code:** Copywriting, typography, spacing, structure, accessibility attributes, empty/loading state rendering
- **Untestable without rendering:** Flash animation timing, color contrast, visual hierarchy fidelity, responsive layout behavior, animation smoothness
- **Not captured:** Screenshots of desktop/mobile/tablet at different connection states

---

## Recommendation Count

- **BLOCKER:** 1 (semantic role destruction in WatchlistRow)
- **Priority fixes:** 3 (role="button", hardcoded colors, header spec gap)
- **Minor recommendations:** 3+ (alignment, color contrast check, keyboard scroll behavior verification)

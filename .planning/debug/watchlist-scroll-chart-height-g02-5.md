---
status: diagnosed
trigger: "Layout bug in FinAlly phase 02-persistent-watchlist, tracked as gap G-02-5 (major) in .planning/phases/02-persistent-watchlist/02-UAT.md: watchlist panel has no internal scroll (page scrolls instead when many tickers are added), AND the main chart's height appears coupled to the watchlist panel's height, growing along with it."
created: 2026-09-19T10:54:13Z
updated: 2026-09-19T10:54:13Z
---

## Current Focus

hypothesis: CONFIRMED — see Resolution.root_cause
test: n/a — goal is find_root_cause_only, diagnosis complete
expecting: n/a
next_action: return ROOT CAUSE FOUND to caller; do not fix (diagnosis only per task instructions)

reasoning_checkpoint:
  hypothesis: "Watchlist.tsx's outer panel div (line 92) has no max-height/overflow-y-auto, so it grows unbounded with ticker count. Because page.tsx's row container (line 43, `flex flex-col gap-4 lg:flex-row`) has no `items-start` override, it uses flexbox's default `align-items: stretch`, which stretches both `lg:w-1/2` flex-item wrappers (lines 44 and 47) to equal height (the tallest child in the row = the growing Watchlist). MainChart's root element (`PanelChrome`, MainChart.tsx:41) sets `h-full`, so it fills 100% of that stretched wrapper — visibly inheriting the Watchlist's grown height as empty space below the fixed 320px chart (MainChart.tsx:31,137). Both reported symptoms are two manifestations of the same missing constraint: Watchlist has no bounded height."
  confirming_evidence:
    - "Direct read of Watchlist.tsx:92 — the panel wrapper div (`rounded-lg border ... bg-[...]`) has zero height/overflow classes; content is a `<table>` that grows one `<tr>` per ticker with no cap."
    - "Direct read of page.tsx:40,43 — `<main>` uses `min-h-screen` (grows freely, no ceiling) and the row wrapper `<div className=\"flex flex-col gap-4 lg:flex-row\">` sets no `align-items`/`items-*` utility, so browser default `align-items: stretch` applies to its two flex-item children."
    - "Direct read of MainChart.tsx:41 — PanelChrome's root div is `flex h-full flex-col ...`; `h-full` resolves against the immediate parent, which is the stretched `lg:w-1/2` wrapper in page.tsx, not against any fixed value."
    - "Direct read of MainChart.tsx:31,137 — the actual rendered chart (ResponsiveContainer/LineChart) is wrapped in a div with explicit `style={{ height: PANEL_HEIGHT }}` (320px, fixed) — so the chart's *drawn content* does not grow; only the bordered PanelChrome box around it grows, via h-full. This matches the user's precise wording ('the chart grows and keeps having the same height as the watchlist panel') rather than 'the chart's line graph gets taller'."
    - "grep across frontend/components and frontend/app for overflow|max-h-|h-full|items-start|items-stretch|self-start confirms `h-full` appears exactly once (MainChart.tsx:41) and no overflow/max-height/align override exists anywhere in the tree — nothing opts out of the default stretch or bounds the watchlist."
    - "globals.css and layout.tsx confirm no ancestor (html/body/main) constrains height or sets overflow — ruling out a higher-level clipping/scroll container that the Watchlist could have been relying on."
    - "02-01-PLAN.md:50 (must_haves.truths, verification: backstop) explicitly documents this as a known, unresolved gap from the phase's original planning: \"The watchlist has no server-side maximum size this phase, so the list can grow past what a Phase-1-sized panel comfortably fits; no scroll/clip/wrap decision is specified — if the panel does not already scroll internally this needs a follow-up design decision.\" This is primary-source confirmation the decision was flagged and never actioned across 02-01 through 02-04."
  falsification_test: "If Watchlist.tsx's wrapper div already had `max-h-* overflow-y-auto` (or a sibling ancestor already constrained/clipped page height), the page would not have grown a body-level scrollbar. If page.tsx's row div already had `items-start` (or MainChart's root didn't use `h-full`), MainChart's bordered box would stay at its own intrinsic/fixed height regardless of watchlist row count. Neither is present — confirmed by direct file reads and a repo-wide grep with zero matches for any opt-out."
  fix_rationale: "n/a — diagnosis only, no fix applied. CORRECTION after advisor review: capping Watchlist.tsx's height alone does NOT decouple the two panels — it only masks symptom 2 while the (now-capped) Watchlist remains the taller flex item. If the cap is set below MainChart's natural height (~320px chart + heading + padding), MainChart becomes the taller sibling and the *Watchlist* gets stretched to match it instead — same `align-items: stretch` + `h-full` mechanism, mirrored. Real decoupling requires touching the AND-gate directly: either add `items-start` (or `lg:items-start`) to page.tsx:43's row container, or remove `h-full` from MainChart.tsx:41's PanelChrome. Bounding the Watchlist (max-h + overflow-y-auto) is still required for symptom 1 regardless; it just isn't sufficient on its own for symptom 2. This reconciles with (and should be read as subordinate to) the `and_gate` field below, which had this right originally."
  blind_spots: "Did not visually render the page in a browser/Playwright to screenshot-confirm the pixel behavior — conclusion is from static analysis of the JSX/Tailwind source, which is deterministic (flexbox stretch + h-full percentage resolution are unambiguous CSS mechanics), so this is treated as strong evidence, not weak inference. CORRECTION after advisor review: symptom 1 (page-level scrollbar instead of internal watchlist scroll) is breakpoint-independent — below `lg:`, the row container is `flex-col` and both `lg:w-1/2` children (no width constraint applies below `lg:`) become full-width stacked blocks; the Watchlist still grows unbounded and still pushes total page height past the viewport regardless of breakpoint. Only symptom 2 (chart-height coupling) is specific to the `lg:flex-row` state, since that is the only state where the two panels share a row and a cross-axis stretch context."
  candidate_causes:
    - "code: Watchlist.tsx:92 wrapper div missing `max-h-*`/`overflow-y-auto` — the panel has no height ceiling, so it grows with ticker count (root cause of symptom 1, and the trigger condition for symptom 2)"
    - "code: page.tsx:43 row flex container has no `items-start` override, so default `align-items: stretch` propagates the Watchlist's grown height to the sibling MainChart wrapper; combined with MainChart.tsx:41's `h-full`, this is what visibly couples the chart panel's box height to the watchlist (contributing cause of symptom 2)"
    - "process/spec: 02-01-PLAN.md:50 flagged this exact gap as an unresolved backstop design decision at planning time and no subsequent phase (02-02/02-03/02-04) or UI-SPEC addressed it — the defect is a known gap that was never closed, not a regression introduced by a later change"
  and_gate: "yes, for symptom 2 specifically — MainChart's box only stretches to match Watchlist's height because BOTH conditions hold simultaneously: (a) page.tsx's row container defaults to `align-items: stretch` AND (b) MainChart's root sets `h-full`. Removing either alone (e.g. `items-start`, or removing `h-full`) would decouple the chart from the watchlist's height even if the watchlist itself still had no scroll bound. However, symptom 1 (no internal scroll) is caused by Watchlist.tsx's missing overflow treatment alone (single cause, not an AND). Both symptoms trace back to the same missing height-bound on the Watchlist panel as their shared upstream trigger, so this remains one diagnosed root cause with two downstream effects, one of which (symptom 2) additionally requires the flex-stretch + h-full AND-gate to manifest."

## Symptoms

expected: "The watchlist panel scrolls internally (or has an intentional overflow treatment) once it exceeds one screen's worth of rows — the rest of the page layout, including the main chart, is unaffected by watchlist row count. (02-UAT.md gap G-02-5 truth statement.)"
actual: "Adding more tickers than fit on one screen makes the watchlist panel grow taller; the whole page gets a scrollbar instead of the watchlist panel scrolling internally. Side effect: the main chart area's bordered panel grows to match the watchlist panel's height, even though the chart's own drawn content (LineChart/ResponsiveContainer) stays a fixed 320px."
errors: "None (visual/CSS layout defect, not a runtime error)."
reproduction: "Add enough tickers to the watchlist (via the add-ticker form) to exceed one viewport's height at the `lg:` (desktop) breakpoint. Observe: (1) the browser/page-level scrollbar appears instead of a watchlist-internal one; (2) the main chart panel's bordered box grows taller in lockstep with the watchlist panel."
started: "Present since phase 02-01 (persistent watchlist) introduced unbounded watchlist row growth via `useWatchlist()`/REST-backed membership, replacing Phase 1's fixed 10-ticker set. Explicitly flagged as an unresolved 'backstop' design decision in 02-01-PLAN.md at planning time (see Evidence) and never subsequently addressed through 02-02/02-03/02-04."

## Eliminated

(none — evidence converged directly on a single confirmed hypothesis; no competing hypothesis was tested and disproved)

## Evidence

- timestamp: 2026-09-19T10:54:00Z
  checked: "frontend/app/page.tsx (full file)"
  found: "Line 40: `<main className=\"flex min-h-screen flex-col gap-4 p-8\">` (unbounded height). Line 43: `<div className=\"flex flex-col gap-4 lg:flex-row\">` — becomes a flex row at `lg:`, no `items-*`/`align-items` override present. Lines 44-47: two children `<div className=\"lg:w-1/2\">` wrapping `<Watchlist>` and `<MainChart>` respectively — plain width-only wrappers, no height classes."
  implication: "The row container relies on flexbox's browser default `align-items: stretch`, meaning both `lg:w-1/2` children are forced to the same (tallest) height. No code anywhere opts either child out of this behavior."

- timestamp: 2026-09-19T10:54:00Z
  checked: "frontend/components/Watchlist.tsx (full file)"
  found: "Line 92: outer panel `<div className=\"rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]\">` — no `max-h-*`, no `overflow-y-auto`/`overflow-auto`, no fixed height. Rows render via `watchlist.map(...)` inside a `<table>` (lines 150-165) with one `<tr>` per watchlist entry and no row limit or virtualization."
  implication: "The watchlist panel's height is purely content-driven and unbounded — it grows by exactly one row's height per added ticker, with nothing to cap it or scroll it internally. This is the primary defect behind symptom 1 and the trigger condition for symptom 2."

- timestamp: 2026-09-19T10:54:00Z
  checked: "frontend/components/MainChart.tsx (full file)"
  found: "Line 31: `const PANEL_HEIGHT = 320;`. Line 41 (`PanelChrome`): `<div className=\"flex h-full flex-col gap-2 rounded-lg border ...\">` — sets `h-full`, resolving to 100% of its parent (the stretched `lg:w-1/2` wrapper). Lines 111-122, 135-146: whichever branch renders, the actual chart-drawing element is wrapped in `<div style={{ height: PANEL_HEIGHT }}>` (or `minHeight: height ?? PANEL_HEIGHT` for the empty/loading states) — a fixed 320px regardless of the outer panel's stretched height."
  implication: "MainChart's bordered box (PanelChrome) is the part that visibly stretches to match the watchlist's height; the chart's actual line-graph rendering does not grow — it stays fixed at 320px, leaving growing empty space in the box below it. This precisely matches the user's report: 'the chart grows and keeps having the same height as the watch list panel' (the box, not the graph)."

- timestamp: 2026-09-19T10:54:00Z
  checked: "frontend/app/layout.tsx and frontend/app/globals.css (full files)"
  found: "layout.tsx: `<body className=\"bg-[var(--color-bg)] text-gray-100\">` — no height/overflow classes. globals.css: only defines theme color variables and the price-flash keyframe animations (`.flash-up`/`.flash-down`) — no global height, overflow, or layout rules of any kind."
  implication: "No ancestor above `<main>` constrains height or provides a scroll boundary the Watchlist could be implicitly relying on. Rules out 'a higher-level container already handles this' as an explanation."

- timestamp: 2026-09-19T10:54:00Z
  checked: "repo-wide grep: `overflow|max-h-|h-full|self-start|self-stretch|items-start|items-stretch|align-self` across frontend/components/*.tsx, frontend/components/*.css, frontend/app/*.tsx, frontend/app/*.css"
  found: "Exactly one match: `frontend/components/MainChart.tsx:41` (`h-full`). No `overflow`, no `max-h-`, no `items-start`/`items-stretch`/`self-*` anywhere in the codebase."
  implication: "Confirms by exhaustive search (not just the files read) that nothing in the tree opts the Watchlist into scrolling or opts MainChart out of stretching. The defect is a straightforward absence, not a competing/overridden rule."

- timestamp: 2026-09-19T10:54:00Z
  checked: ".planning/phases/02-persistent-watchlist/02-01-PLAN.md (must_haves.truths section)"
  found: "Line 50: a backstop-verification truth explicitly states: \"The watchlist has no server-side maximum size this phase, so the list can grow past what a Phase-1-sized panel comfortably fits; no scroll/clip/wrap decision is specified — if the panel does not already scroll internally this needs a follow-up design decision.\""
  implication: "Primary-source confirmation that this was a known, explicitly-flagged open design gap at the start of phase 02, not a regression introduced by later work. Grepping 02-02/02-03/02-04 PLAN/SUMMARY docs and 02-UI-SPEC.md for scroll/overflow/height turned up nothing further (only this one hit in 02-01-PLAN.md) — the flagged gap was never picked up by a subsequent plan."

- timestamp: 2026-09-19T10:54:00Z
  checked: ".planning/phases/02-persistent-watchlist/02-UAT.md gap G-02-5"
  found: "gap_id: G-02-5, status: failed, severity: major, reason: \"User reported: adding more tickers make the panel grow larger. as a result only the page get a scroll bar. Another side effect is that the chart grows and keeps having the same height as the watch list panel.\" root_cause: \"\" (empty, unresolved prior to this investigation)."
  implication: "Confirms the UAT gap this investigation is diagnosing, and that no root cause had been recorded yet — this debug session supplies it."

## Resolution

root_cause: "Two coupled defects sharing one upstream trigger. (1) Watchlist.tsx:92's outer panel div has no `max-h-*`/`overflow-y-auto` — its height is purely content-driven (one `<tr>` per ticker, uncapped), so it grows without bound as tickers are added, and because no ancestor (page.tsx `<main>`, body, html) constrains height either, the browser falls back to a page-level scrollbar instead of an internal one. (2) page.tsx:43's row container (`flex flex-col gap-4 lg:flex-row`) has no `items-start` override, so it uses flexbox's default `align-items: stretch`; combined with MainChart.tsx:41's `PanelChrome` root setting `h-full`, this stretches the MainChart panel's bordered box to match whichever sibling is tallest in the row — which, due to defect (1), is currently always the growing Watchlist panel. The chart's own drawn content (LineChart/ResponsiveContainer) stays fixed at `PANEL_HEIGHT = 320px` (MainChart.tsx:31,137); only the empty space in its surrounding box grows. Note: bounding the Watchlist's height alone masks symptom 2 only while the Watchlist remains the taller sibling — it does not remove the underlying stretch/h-full coupling (see and_gate); true decoupling requires touching the align-items/h-full pairing directly, independent of whatever height the Watchlist ends up with. This was an explicitly flagged, never-actioned open design decision from phase 02-01's original planning (02-01-PLAN.md:50, backstop-verification truth), not a regression from a specific later change."
fix: "(not applied — diagnosis only per task instructions)"
verification: "(not applicable — no fix applied)"
files_changed: []

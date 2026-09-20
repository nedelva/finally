---
phase: 02-persistent-watchlist
reviewed: 2026-09-19T10:20:31Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - frontend/components/Watchlist.tsx
  - frontend/__tests__/Watchlist.test.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-19T10:20:31Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the diff introduced by gap-closure plan 02-04 (commit `57a30a6`), which adds distinct `loading` / `loadError` / `empty` / populated branches to `Watchlist.tsx` and backs them with new tests in `Watchlist.test.tsx`. This closes UAT gaps G-02-1 (layout jump on load) and G-02-3 (silently discarded `useWatchlist()` error/loading fields).

The core fix is sound: `loading`, `error` (renamed `loadError` to avoid colliding with the component's own local `error` state), and `watchlist.length === 0` are now checked in the correct precedence order (`loading` → `loadError` → empty → populated), the table shell (`<thead>`) is shared via an extracted `tableHead` constant so the header never disappears/reappears during the loading phase (satisfying G-02-1's "no skeleton swap" requirement), and the add-ticker form stays mounted and independently usable across all four branches. `npx tsc --noEmit` and the full `Watchlist.test.tsx` suite (36/36) both pass with no console warnings. I did not find any BLOCKER-severity bugs in this diff.

Two WARNING-level quality/UX gaps and two INFO-level notes are below — none reopen G-02-1/G-02-3, but they weaken robustness and accessibility of the new states.

## Warnings

### WR-01: `loadError` state fully hides a stale-but-valid table with no in-UI retry

**File:** `frontend/components/Watchlist.tsx:137-143`
**Issue:** When `loadError` is truthy, the branch unconditionally renders the error message *instead of* the table — even when `watchlist` already holds previously-fetched entries (the "stale data present" test at `frontend/__tests__/Watchlist.test.tsx:472-492` exercises exactly this and asserts `document.querySelector("table")` is `null`). Because `useWatchlist()` (`frontend/lib/hooks.ts`) has no polling/auto-retry and only calls `refetch()` again in response to a successful add/remove mutation, a single transient `GET /api/watchlist` failure (e.g. right after a successful remove, or on a flaky connection) leaves the user staring at a bare error string with no visible ticker rows, no remove buttons, and no explicit "Retry" control. The only way to clear `loadError` is to complete an unrelated add-ticker submission that happens to succeed (which itself triggers `refetch()`), or reload the page — neither of which is discoverable from the error view itself.
**Fix:** Either (a) keep rendering the stale table underneath/alongside a dismissible error banner instead of replacing it outright, or (b) add an explicit "Retry" affordance in the `loadError` block that calls `refetch()` directly:
```tsx
) : loadError ? (
  <div data-testid="watchlist-load-error" className="px-4 py-6 text-center text-sm text-[var(--color-down)]">
    <p>{loadError}</p>
    <button type="button" onClick={() => refetch()} className="mt-2 underline">
      Retry
    </button>
  </div>
) : ...
```

### WR-02: No accessible live-region on the loading/error states

**File:** `frontend/components/Watchlist.tsx:122-143`
**Issue:** Neither the "Loading watchlist…" cell (line 132) nor the `watchlist-load-error` div (lines 138-143) carries `role="status"`/`aria-live="polite"` (loading) or `role="alert"` (error). Screen-reader users get no announcement when the panel silently swaps from the table shell to a loading row, or from a populated table to an error message — they'd need to actively re-scan the panel to notice. The add-ticker form's own error slot (`watchlist-add-error`, line 116) has the same gap, but that one predates this diff; the two new states introduced here inherit the omission.
**Fix:** Add `aria-live="polite"` to the loading `<td>` and `role="alert"` to the `loadError` `<div>`:
```tsx
<div data-testid="watchlist-load-error" role="alert" className="...">
```

## Info

### IN-01: `tableHead` extraction is a positive refactor but slightly obscures the branch-parity contract

**File:** `frontend/components/Watchlist.tsx:79-89`
**Issue:** Not a bug — this is a good simplification (removes the header-markup duplication the pre-fix version had between the empty and populated branches, per the file's own comment at lines 75-78). Noting only that the loading and populated branches now implicitly depend on `tableHead` staying byte-identical between them to preserve the "no header remount" guarantee G-02-1 relies on; a future edit to one `<table>` block that forgets to also use the shared `tableHead` constant (e.g. someone inlining a `<thead>` again in only one branch) would silently reintroduce the layout jump with no type-level guard against it. The test at `frontend/__tests__/Watchlist.test.tsx:438-440` (`getAllByRole("columnheader")).toHaveLength(5)` during loading) is the only guard, and it doesn't assert the header is the *same element instance/markup* across state transitions, just that a 5-column header exists on both mounts independently.
**Fix:** No action required; consider a comment note (already partially present) or a shared-fixture test that renders through `loading → populated` and asserts the header's `outerHTML` is unchanged, if this guarantee is worth locking down further.

### IN-02: New keyboard-activation regression test is unrelated to G-02-1/G-02-3 but bundled into this diff

**File:** `frontend/__tests__/Watchlist.test.tsx:271-294`
**Issue:** The "does not fire the row's onSelect when the remove button is activated via keyboard" test (regression test for WR-02 from a prior review cycle) exercises `WatchlistRow.tsx`'s existing `handleRemoveKeyDown` stop-propagation logic, which was not touched by this diff and is outside this diff's stated scope (closing G-02-1/G-02-3 in `Watchlist.tsx`). It passes and adds legitimate coverage, so this is not a defect — just a scope note for traceability: `WatchlistRow.tsx` itself is unchanged in this diff, only its test coverage grew.
**Fix:** None required; consider filing this test addition under its own changelog entry if strict scope-per-commit traceability matters to the project.

---

_Reviewed: 2026-09-19T10:20:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

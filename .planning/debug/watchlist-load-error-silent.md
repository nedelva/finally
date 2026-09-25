---
status: diagnosed
trigger: "DATA_START\nWhen the backend is unreachable and the initial GET /api/watchlist fetch fails, the watchlist panel shows no visible error message to the user — it just renders as an empty watchlist indistinguishable from \"no tickers configured.\" Confirmed during UAT for phase 02 (persistent watchlist); flagged in 02-VERIFICATION.md as a confirmed code gap, not a hypothesis. Feeds gap G-02-3 in .planning/phases/02-persistent-watchlist/02-UAT.md. Goal: find_root_cause_only, do not fix.\nDATA_END"
created: 2026-09-19T00:00:00Z
updated: 2026-09-19T00:00:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-25
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED — Watchlist.tsx never reads useWatchlist()'s error (or loading) return value, so a failed initial GET /api/watchlist is visually identical to a genuinely empty watchlist.
test: Direct code read of both files plus the existing test suite's mock helper.
expecting: n/a — confirmed by direct read, no further test needed.
next_action: none — diagnosis complete, return ROOT CAUSE FOUND to caller.

## Symptoms

expected: A failed initial `GET /api/watchlist` (e.g. backend down) surfaces some visible indication to the user that the watchlist failed to load, distinct from a legitimately empty watchlist.
actual: Backend killed, page refreshed — no error message appears anywhere. Panel renders the same "Watchlist is empty / Add a ticker above to start streaming its price." empty-state block used for a genuinely empty watchlist.
errors: none surfaced to the DOM; `useWatchlist()`'s internal `error` state does get set to `getWatchlist()`'s failure string (e.g. "Network error — unable to reach the server."), it is just never rendered.
reproduction: Stop the backend, load/refresh http://localhost:8000 (or any page mounting Watchlist.tsx) — the initial `GET /api/watchlist` request fails, and the grid shows the plain empty state with no error text.
started: Present since 02-01 introduced `useWatchlist()`/`Watchlist.tsx`'s REST-backed grid; flagged as an undesigned backstop item in 02-01's own must_haves and never resolved by 02-02/02-03.

## Eliminated

(none — single hypothesis, confirmed directly by code read, no alternative explanations needed)

## Evidence

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/lib/hooks.ts (full file, 108 lines)
  found: "useWatchlist()" is defined at lines 77-107 (line numbers match VERIFICATION.md's citation exactly, unshifted). It holds `const [error, setError] = useState<string | null>(null)`, calls `getWatchlist()` in `refetch` (lines 83-93), sets `setError(res.error)` on failure (line 90) / `setError(null)` on success (line 88), and returns `{ watchlist, loading, error, refetch }` at line 106 — `error` is a fully-formed part of the hook's public return shape.
  implication: The hook itself is correct and already does the work of capturing the failure into a renderable string. The gap is entirely on the consumer side.

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/components/Watchlist.tsx (full file, 137 lines)
  found: Line 31 destructures `const { watchlist, refetch } = useWatchlist();` — only two of the hook's four return fields are taken; `error` and `loading` are both dropped. The component declares its own, separately-scoped `const [error, setError] = useState("")` at line 35, used only by `handleSubmit` (add-ticker, line 47/54) and `handleRemove` (remove-ticker, line 65/68) to drive the `data-testid="watchlist-add-error"` `<p>` at lines 97-102. The render branch at line 103, `watchlist.length === 0 ? <div data-testid="watchlist-empty">...</div> : <table>...`, has no third branch for "fetch failed" — it only distinguishes empty-array vs. non-empty-array, which is identical in both the "no tickers" and "fetch failed" cases (both leave `watchlist` at its `useState<WatchlistEntry[]>([])` initial value).
  implication: Root cause confirmed. Two separate `error` concepts exist in this file's scope: (1) the hook's `error: string | null` for the GET-on-mount, entirely unread; (2) the component's own local `error: string` for add/remove form failures, which IS rendered. A naive fix that destructures `error` from `useWatchlist()` would shadow/collide with the existing local `error` state — the fix needs a distinct variable name (e.g. `loadError`) for the hook's value, not a raw destructure of `error`.

- timestamp: 2026-09-19T00:00:00Z
  checked: .planning/phases/02-persistent-watchlist/02-UI-SPEC.md UI Considerations table (line 126) and Copywriting Contract (line 100)
  found: UI-SPEC explicitly lists "error — watchlist grid (`GET /api/watchlist` failure)" as a 🧪 backstop item, described as "distinct from the add-ticker form's own error copy above. Held-out: reuse the existing `ApiResult` failure pattern from `lib/api.ts` if this path is ever exercised; no dedicated visual has been designed and none exists to verify against yet." The Copywriting Contract's "Error state — generic/network failure" row says to reuse `lib/api.ts`'s existing `ApiResult` failure message verbatim, with "no new error-rendering mechanism."
  implication: The UI-SPEC deliberately treats the grid-load failure as conceptually distinct from the add-ticker form's error copy (different trigger, different meaning: "watchlist failed to load" vs. "your add/remove action failed") — but it does NOT mandate a second literal DOM slot; it says reuse the existing *pattern* (render `res.error`/`ApiResult`'s message verbatim, no reformatting). It stops short of specifying a concrete implementation and defers that decision to whoever picks this up — this is an explicit, acknowledged open design gap, not an oversight in the spec.

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/__tests__/Watchlist.test.tsx (grep for "error", "useWatchlist", relevant describe blocks; read lines 1-65, 425-475)
  found: The shared `mockUseWatchlist()` test helper (lines 41-55) hardcodes `error: null` on every call — no test in the suite ever mocks `useWatchlist()` returning a non-null `error`, and no test asserts on any DOM output for that case. The two existing `watchlist-add-error` tests (lines 619-711) only cover the component's own local add/remove `error` state, never the hook's. `mockUseWatchlist` also hardcodes `loading: false` always, so there is no test coverage of the loading state either (relevant to the sibling G-02-1 gap, not this one).
  implication: Confirms there is zero regression protection for this code path today — any fix needs a new test that mocks `useWatchlist()` returning a non-null `error` and asserts a visible message renders.

- timestamp: 2026-09-19T00:00:00Z
  checked: frontend/lib/api.ts (getWatchlist, getJson, ApiResult type) and frontend/lib/types.ts (ApiResult usage)
  found: `getWatchlist()` -> `getJson<WatchlistResponse>("/api/watchlist")` returns `ApiResult<WatchlistResponse>` = `{ok:true,data}` | `{ok:false,error:string}`. On a network failure (backend unreachable), `fetch()` throws and `getJson`'s catch returns `{ok:false, error:"Network error — unable to reach the server."}` — this is exactly the string that ends up in the hook's `error` state and is currently discarded.
  implication: The error string that would need rendering is already a clean, user-appropriate message with no further formatting needed ("no new error-rendering mechanism" per Copywriting Contract) — the fix is purely about wiring existing data to JSX, not about generating better error text.

- timestamp: 2026-09-19T00:00:00Z
  checked: .planning/phases/02-persistent-watchlist/02-UI-SPEC.md Copywriting Contract, line 96, cross-referenced against Watchlist.tsx line 103's render condition
  found: The approved Copywriting Contract states "Empty state heading | 'Watchlist is empty' — shown only if the user removes every ticker." The current render condition (`watchlist.length === 0`) is not scoped to that case — it also fires (a) during the initial in-flight fetch (before the hook's `loading` flips false, since `watchlist` starts at `[]`) and (b) on a failed initial fetch. Both are conditions the contract's own wording excludes from this copy.
  implication: This is not merely an undesigned backstop gap — current behavior actively violates an already-approved contract line. "Accept silent-empty for this phase" is not a clean no-op product option; the empty-state copy is being shown in a state the contract explicitly scopes it out of ("shown only if the user removes every ticker"). A fix is needed to bring the component back into contract compliance, not just to add a nice-to-have.

- timestamp: 2026-09-19T00:00:00Z
  checked: Cross-reference against the sibling active debug session .planning/debug/watchlist-empty-on-load.md (gap G-02-1) and 02-UAT.md test 2 (gap G-02-2, "add action returns a 405 status")
  found: G-02-1's symptom ("initial page shows no tickers at all") and G-02-2's symptom (405 on POST /api/watchlist — consistent with StaticFiles intercepting /api/* ahead of the API router, which per VERIFICATION.md's own "Key Link Verification" table was last confirmed registered in the correct order on 2026-09-18, i.e. this may be a regression since then) both plausibly stem from `GET /api/watchlist` (and `POST`) failing to reach the real API handler at all. G-02-1's own debug session has not yet reached a confirmed root_cause.
  implication: G-02-3 (this session) is not purely cosmetic polish — it is the reason G-02-1 presents to the user as "no tickers" (silently indistinguishable from empty) instead of "backend/routing broken." Fixing G-02-3's error rendering would very likely have surfaced G-02-1/G-02-2's actual failure message during UAT instead of a bare empty grid. This reframes G-02-3 from "major cosmetic gap" to "diagnostic-blindness that masked at least one other confirmed blocker" — worth flagging to whoever triages all three gaps together, even though this session does not investigate G-02-1/G-02-2's actual routing root cause (out of scope here).

## Resolution

root_cause: "`Watchlist.tsx` (frontend/components/Watchlist.tsx:31) destructures only `{ watchlist, refetch }` from `useWatchlist()` and discards the hook's `error` (and `loading`) fields. `useWatchlist()` (frontend/lib/hooks.ts:77-107) correctly captures a failed initial `GET /api/watchlist` into its `error` state via `setError(res.error)` (line 90), but since the component never reads it, the render logic at line 103 (`watchlist.length === 0 ? <empty-state> : <table>`) cannot distinguish 'genuinely empty watchlist' from 'fetch failed, watchlist array still at its [] initial value' from 'still loading' — all three collapse into the identical `data-testid=\"watchlist-empty\"` branch with no error text anywhere in the DOM. This also violates the approved UI-SPEC Copywriting Contract line ('shown only if the user removes every ticker'), so it is a contract violation, not just an undesigned backstop gap."
fix: "(not implemented — diagnosis only per task scope). Fix direction for the executor: (1) destructure `error` and `loading` from `useWatchlist()` under a distinct name (e.g. `loadError`) to avoid colliding with the component's existing local `error`/`setError` state used for add/remove-form failures; (2) change the render precedence at line 103 to a 3-way branch: `loading` -> (loading treatment, currently undesigned per sibling gap G-02-1) -> `loadError` -> (visible error message, distinct from the empty state) -> `watchlist.length === 0` -> existing empty state -> else table; (3) decide on the error-display slot: either give the load-failure its own dedicated element (safer, since the existing `watchlist-add-error` `<p>` is cleared to '' by both `handleSubmit`'s and `handleRemove`'s success paths (lines ~51, ~66), which would silently blow away a still-active load error if the same state/slot were shared), or explicitly reconcile the two error sources into one string with clear precedence rules; (4) new test coverage is needed since frontend/__tests__/Watchlist.test.tsx's `mockUseWatchlist()` helper (lines 41-55) currently hardcodes `error: null` and `loading: false` on every call — no existing test exercises this path."
verification: (not applicable — no fix applied)
files_changed: []

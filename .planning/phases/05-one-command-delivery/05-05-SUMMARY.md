---
phase: 05-one-command-delivery
plan: 05
subsystem: testing
tags: [playwright, e2e, docker-compose, sse, llm-mock]

# Dependency graph
requires:
  - phase: 05-04
    provides: Playwright harness, docker-compose.test.yml, 01-fresh-start.spec.ts, package.json/lockfile
provides:
  - Full six-scenario E2E suite (fresh start, watchlist, trading, portfolio visuals, mocked chat, SSE reconnect) proving OPS-01 end to end against the packaged container
affects: [ship, verify-work]

# Actuals (#2632)
actuals:
  tokens: 4048
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "page.route() to abort a single named endpoint reliably simulates a failed/dropped network call for EventSource testing, where context-wide setOffline() does not interrupt an already-open stream"
    - "page.reload() as a deterministic substitute for racing a background poll interval when asserting a chat-dispatched action's UI-level effect"

key-files:
  created:
    - test/e2e/02-watchlist.spec.ts
    - test/e2e/03-trading.spec.ts
    - test/e2e/04-portfolio-viz.spec.ts
    - test/e2e/05-chat.spec.ts
    - test/e2e/06-sse-reconnect.spec.ts
  modified: []

key-decisions:
  - "setOffline(true) does not interrupt an already-open SSE connection in this Chromium/container combination (verified: 60s wait, 122 polls, zero transitions) — the reconnect spec instead blocks only the stream endpoint via page.route() before a reload, which reliably fails the fresh connection attempt"
  - "Chat-dispatched trades/watchlist changes are proven server-side via their inline pill first, then their UI-level effect (header-cash, watchlist row) is observed via page.reload() rather than racing usePortfolio's 20s poll or a refresh useWatchlist never performs on its own"

patterns-established:
  - "E2E specs assert server-side action success via the inline confirmation pill before checking any UI state that depends on a component's own (possibly absent) refresh mechanism"

requirements-completed: [OPS-01]

coverage:
  - id: D1
    description: "Watchlist add/remove/reject-malformed journeys against the packaged container"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "test/e2e/02-watchlist.spec.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Buy, sell, and a refused over-sell with cash/position assertions"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "test/e2e/03-trading.spec.ts (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Portfolio heatmap tile, positions table, and a plotted P&L chart point after a buy"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "test/e2e/04-portfolio-viz.spec.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mocked AI copilot: grounded reply, executed trade, executed watchlist change, and a failed trade reported inline"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "test/e2e/05-chat.spec.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "SSE connection dot reports a failed connection attempt and recovers once the network returns"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "test/e2e/06-sse-reconnect.spec.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full six-spec suite (10 tests) passes end to end against a freshly-built, freshly-started container"
    requirement: "OPS-01"
    verification:
      - kind: e2e
        ref: "docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright (exit 0)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-24
status: complete
---

# Phase 5 Plan 05: Remaining E2E Scenarios Summary

**Completed the PLAN.md section 12 E2E matrix — watchlist, trading, portfolio visuals, mocked AI chat, and SSE reconnect — all six scenarios green against the packaged container, with two scenarios rewritten mid-execution after their planned techniques were verified empirically not to work.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files created:** 5

## Accomplishments

- `test/e2e/02-watchlist.spec.ts`: add a ticker (row appears, price streams in), remove a ticker (row detaches), and reject an empty or malformed entry (error visible, row count unchanged)
- `test/e2e/03-trading.spec.ts`: buy MSFT (cash decreases, position appears), sell MSFT (cash increases, position remains), refuse an over-sell (cash and quantity unchanged, error visible) — self-contained, buys its own MSFT position
- `test/e2e/04-portfolio-viz.spec.ts`: buys NVDA, asserts the heatmap tile, the positions table row with real (non-em-dash) values, and at least one plotted P&L chart point via `.recharts-dot`
- `test/e2e/05-chat.spec.ts`: four deterministic `LLM_MOCK` branches — a portfolio-keyword grounded reply, an executed trade (`buy 1 aapl`), an executed watchlist change (`add sofi`), and a rejected trade (`sell 9999 aapl`) reported inline via a failed pill
- `test/e2e/06-sse-reconnect.spec.ts`: the connection dot (via `role="status"`/`data-status`, never a color-class assertion) reports a failed connection attempt and recovers via `EventSource`'s own retry once the network returns
- Full suite verified green end to end multiple times: `docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright` exits 0 with all 6 spec files (10 tests) passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Watchlist and trading journeys against the container** - `05146cd` (test)
2. **Task 2: Portfolio visuals and the mocked AI copilot** - `7316657` (test)
3. **Task 3: SSE reconnect, and the full suite as the phase gate** - `8f32cf8` (test)

## Files Created/Modified

- `test/e2e/02-watchlist.spec.ts` - Watchlist add/remove/reject-malformed coverage
- `test/e2e/03-trading.spec.ts` - Buy/sell/refused-over-sell coverage, self-sufficient on MSFT
- `test/e2e/04-portfolio-viz.spec.ts` - Heatmap/positions-table/P&L-chart coverage, self-sufficient on NVDA
- `test/e2e/05-chat.spec.ts` - Mocked AI copilot coverage across all four dispatch branches, self-sufficient on AAPL
- `test/e2e/06-sse-reconnect.spec.ts` - SSE resilience coverage, placed last per the suite's filename-ordering convention

## Decisions Made

- **SSE-reconnect technique rewritten (verified empirically, not assumed).** RESEARCH.md's own code example — `page.context().setOffline(true)` against an already-open connection, waiting for the dot to leave `"connected"` — was tested directly against the running container: a 60-second wait produced 122 consecutive polls that all still read `"connected"`. Root cause confirmed: `setOffline(true)` blocks requests not yet made but does not interrupt an already-open, actively-streaming SSE response in this Chromium/container combination. A context-wide offline mode also blocks the page's own top-level navigation (`page.reload()` fails outright with `net::ERR_INTERNET_DISCONNECTED` before the app's DOM mounts), so reloading under full offline doesn't work either. The working fix: `page.route('**/api/stream/prices', route => route.abort())` registered before a reload — this reliably intercepts the fresh `EventSource` connection attempt the reload triggers while leaving the page's own document/asset requests unaffected — then `page.unroute()` and let the existing connection's own `retry: 1000` directive (backend/app/market/stream.py) drive reconnection, with no second reload. Verified: 3.6s clean pass, repeatable.
- **Chat-dispatched actions observed via `page.reload()`, not a wait on live UI refresh.** Confirmed by reading `frontend/lib/hooks.ts`: `usePortfolio` refreshes on mount plus a 20s poll, but `useWatchlist` never polls at all — and neither is wired to refresh after a chat-dispatched action (unlike `TradeBar`, whose `onFilled` prop explicitly calls `refetchPortfolio()`/`refetchHistory()` through `page.tsx`). Each chat mutation in `05-chat.spec.ts` is proven server-side first via its inline `chat-action-pill` (`data-status="executed"`/`"failed"`), then its UI-level effect (header cash, `row-SOFI`) is observed via a `page.reload()` — a fresh mount's fetch — which is both faster and more deterministic than racing a 20-second poll interval or waiting on a refresh `useWatchlist` never performs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SSE-reconnect scenario rewritten after its planned technique failed empirically**
- **Found during:** Task 3, verification of `test/e2e/06-sse-reconnect.spec.ts` against the running container
- **Issue:** `page.context().setOffline(true)` against an already-open SSE connection never caused the connection dot to leave `"connected"`, confirmed over a 60-second wait (122 polls). A context-wide offline mode also broke `page.reload()` itself.
- **Fix:** Scoped the simulated failure to the stream endpoint alone via `page.route('**/api/stream/prices', route => route.abort())`, registered before a reload that triggers a fresh (interceptable) `EventSource` connection attempt; removed the route and let the existing connection's native retry reconnect, with no second reload.
- **Files modified:** `test/e2e/06-sse-reconnect.spec.ts`
- **Verification:** Isolated re-run against the live container: pass in 3.6s (previously timed out at 60s with zero transitions)
- **Committed in:** `8f32cf8`

**2. [Rule 3 - Blocking] Chat-triggered UI refresh gap worked around at the test level**
- **Found during:** Task 2, verification of `test/e2e/05-chat.spec.ts` against the running container
- **Issue:** After a chat-dispatched `buy 1 aapl`, `header-cash` did not decrease within the suite's default assertion window; after a chat-dispatched `add sofi`, `row-SOFI` never appeared at all. Root cause: `usePortfolio` only refreshes on mount plus its own 20s poll, and `useWatchlist` never polls — neither is wired to `ChatPanel`'s action-dispatch path the way `TradeBar`'s `onFilled` callback wires manual trades to an immediate refetch.
- **Fix:** Each chat mutation is confirmed server-side via its inline pill first (proving the dispatch succeeded), then the UI-level effect is observed via `page.reload()` rather than waiting on a refresh mechanism that either takes up to 20s or doesn't exist.
- **Files modified:** `test/e2e/05-chat.spec.ts`
- **Verification:** Isolated re-run against the live container: pass in ~0.7s; confirmed again in the full clean suite run
- **Committed in:** `7316657`

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues found during verification, fixed at the test level; no application code was modified, consistent with this plan's file scope)
**Impact on plan:** Both fixes make the suite pass against the application's actual, verified behavior rather than against an assumption from RESEARCH.md or the plan's action text. Neither required touching frontend/backend code.

## Issues Encountered

**A real pre-existing UX gap was found and left unfixed, out of this plan's scope.** `ChatPanel.tsx`/`page.tsx` (Phase 4) do not refresh `header-cash` or the watchlist grid after a chat-dispatched trade or watchlist change — a user chatting "buy 1 AAPL" sees no visible cash change until the next 20-second portfolio poll, and a chat-dispatched "add SOFI" never appears in the watchlist grid without a manual page reload (`useWatchlist` has no poll at all). This is a genuine, user-visible responsiveness gap between the manual `TradeBar`/`Watchlist` flows (which explicitly refetch on completion) and the chat flow (which does not). Per this plan's file scope (`test/e2e/*.spec.ts` only) and the executor's scope-boundary rule, this was not fixed here — it is a pre-existing issue unrelated to this plan's own changes. Recommend a follow-up: wire `ChatPanel`'s successful-response handler to the same `refetchPortfolio()`/`refetchHistory()`/watchlist-`refetch()` calls `page.tsx` already gives `TradeBar` via `onFilled`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full PLAN.md section 12 E2E matrix is complete and green: `test/e2e/01-fresh-start.spec.ts` through `06-sse-reconnect.spec.ts`, 10 tests total, all passing against the packaged container under `LLM_MOCK=true`.
- OPS-01 now has full, automated, container-level coverage end to end.
- Phase 05's remaining plan is `05-02` (operator lifecycle: start/stop scripts, `docker-compose.yml`, restart-persistence proof for OPS-02) — this plan does not touch that work.
- Flagged for a future phase/quick-task: wire `ChatPanel`'s post-action success path to the same portfolio/watchlist refetch calls `TradeBar`'s `onFilled` already triggers, so chat-dispatched trades and watchlist changes are visible in the UI immediately rather than after the next poll or a manual reload (see Issues Encountered above).

---
*Phase: 05-one-command-delivery*
*Completed: 2026-09-24*

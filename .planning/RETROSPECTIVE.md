# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-09-25
**Phases:** 5 | **Plans:** 22 | **Commits:** 254 (2026-09-17 → 2026-09-24, 8 days)

### What Was Built
- A dormant market-data engine (simulator + Massive REST client, PriceCache, SSE router factory) mounted into a real FastAPI app for the first time, streaming a live watchlist grid with price-flash, sparklines, and a self-recovering connection indicator
- SQLite persistence (full PLAN.md §7 schema) backing a user-controlled watchlist (add/remove, validated, normalized)
- An instant-fill market-order trading engine — positions table, P&L-colored heatmap, and a 30-second-snapshot P&L chart — all sharing one `deriveLivePosition` valuation path so the header, table, and heatmap can never disagree
- An LLM chat copilot (LiteLLM → OpenRouter/Cerebras, structured outputs) grounded in the real portfolio, auto-executing trades and watchlist changes through the exact same validation paths as manual actions, with persisted/rehydrated history
- Single-command Docker delivery: two-stage build, idempotent start/stop scripts (bash + PowerShell), and a Playwright E2E suite proving the packaged container end to end

### What Worked
- Vertical-slice phasing (tracer plan first, then hardening waves) meant every phase produced a demoable, testable increment rather than a horizontal layer
- Shared valuation/derivation helpers (`deriveLivePosition`, `total_portfolio_value`) adopted early in Phase 3 and reused through Phase 4 — no parallel math paths ever diverged
- Folding known market-data defects into the phase that touched the code (rather than a dedicated cleanup phase) kept the roadmap linear and avoided a stalled "someday" backlog item — though it meant two of the four defects never got picked up (see Key Lessons)
- RED-then-GREEN commit discipline on repository-level changes (Phase 2) made review and rollback trivial

### What Was Inefficient
- Two debug sessions (`watchlist-empty-on-load`, `watchlist-load-error-silent`) independently diagnosed the same root cause from different UAT reports — the sibling-session cross-reference happened only after both were already written
- Gap-closure waves (Phase 2 waves 4-5) were needed because two of five UAT gaps surfaced only after the tracer wave shipped; earlier UI-SPEC review might have caught the missing loading/error states and the sub-24px hit target before implementation
- `workflow.use_worktrees` had to be toggled off mid-Phase-3 and the push discipline re-learned mid-Phase-5 — the worktree-forks-from-`origin/HEAD` constraint bit twice before the pattern (push before dispatching) stuck

### Patterns Established
- One shared SSE `EventSource`/React context feeding every consumer (watchlist, sparklines, main chart) rather than per-component connections
- Trade/watchlist mutation dispatch is a single validated path reused by both the manual REST route and the AI chat action-dispatch loop — never a second, looser route for AI-initiated actions
- `LLM_MOCK=true` deterministic responses as the default test/CI mode for anything touching the chat endpoint

### Key Lessons
1. "Fix inside the phase that touches the code" needs a re-check at milestone close — two of four originally-flagged market-data defects (version-counter-on-empty-cache, tick-vs-daily % change) never had a phase touch that code path again, and silently rode to v1.0 as unaddressed residue. A milestone-close audit step for "known defects still open" would have caught this earlier than end-of-project archival review.
2. When Claude Code's worktree isolation forks from `origin/HEAD`, keep local pushed before dispatching parallel waves — this was rediscovered independently in Phase 3 (toggled worktrees off) and Phase 5 (pushed instead); the second time was faster because the first documented the mechanism in PROJECT.md's Key Decisions.
3. Debug sessions scoped to `find_root_cause_only` are cheap to run in parallel but should cross-reference sibling reports before finalizing conclusions — two sessions here reached the identical Watchlist.tsx root cause independently.

### Cost Observations
- Sessions: multiple across ~8 days of wall-clock work (2026-09-17 → 2026-09-24)
- Notable: zero-dependency simulator path kept development and CI fully offline-capable; the one optional external dependency (Massive/Polygon SDK) shipped with an unresolved integration bug (CR-01) precisely because it's off the default path and got less exercise

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 5 | Vertical-slice phasing (tracer plan + hardening waves) established as the default phase shape |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|--------------------|
| v1.0 | 224 backend + 158 frontend + 10 E2E = 392 | — | Simulator-only default path requires no external API key |

### Top Lessons (Verified Across Milestones)

1. Push local before dispatching worktree-isolated parallel waves — confirmed necessary twice within v1.0 alone (Phase 3, Phase 5)

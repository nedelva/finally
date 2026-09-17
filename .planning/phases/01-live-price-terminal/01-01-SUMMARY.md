---
phase: 01-live-price-terminal
plan: 01
subsystem: frontend
tags: [nextjs, typescript, tailwind, vitest, gitignore-repair]

requires: []
provides:
  - "Repaired .gitignore: frontend/lib/ is trackable, node_modules/.next/out/*.tsbuildinfo are excluded"
  - "Buildable, type-clean Next.js 16 static-export project at frontend/"
  - "Dark-theme colour tokens and flash-up/flash-down keyframe CSS matching usePriceFlash.ts's contract"
  - "Vitest + jsdom + Testing Library harness (frontend/vitest.config.ts, vitest.setup.ts)"
  - "Passing behavioural coverage for usePriceFlash.ts (MKT-02), 7 tests"
affects: [01-02, 01-03, all-later-frontend-plans]

actuals:
  tokens: 62117
  tasks: 3
  commits: 3

tech-stack:
  added: [next@16.3.5, react@19.2.8, react-dom@19.2.8, recharts@3.10.1, typescript@5.9.3, tailwindcss@4.3.3, "@tailwindcss/postcss@4.3.3", vitest@5.0.1, jsdom@30.1.0, "@testing-library/react@16.3.3", "@testing-library/jest-dom@7.0.1", "@vitejs/plugin-react@6.1.1"]
  patterns: ["Tailwind v4 CSS-first @theme config (no tailwind.config.js)", "Next.js static export (output: export) for single-origin FastAPI serving", "keyframe-based CSS flash effect (not transition) to match usePriceFlash's hold-then-remove timing"]

key-files:
  created:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/next.config.js
    - frontend/tsconfig.json
    - frontend/postcss.config.mjs
    - frontend/app/layout.tsx
    - frontend/app/page.tsx
    - frontend/app/globals.css
    - frontend/vitest.config.ts
    - frontend/vitest.setup.ts
    - frontend/__tests__/usePriceFlash.test.ts
  modified:
    - .gitignore

key-decisions:
  - "Anchored .gitignore's lib/ rule to the repo root (/lib/) rather than adding a negation line — narrower, single-character fix per the plan's explicit instruction"
  - "Accepted Next.js's build-time tsconfig.json auto-correction (jsx: preserve -> react-jsx, plus .next/dev/types/**/*.ts added to include) rather than fighting it — Next 16 Turbopack mandates react-jsx for the App Router's automatic runtime"
  - "Task 3's TDD cycle: since usePriceFlash.ts is pre-existing, reviewed source that must not be modified, GREEN was interpreted per the plan's explicit carve-out as 'the test suite passes against the existing correct implementation' rather than manufacturing an artificial RED failure"

patterns-established:
  - "CSS flash effect: keyframe animation (not transition) applied via a class the hook toggles for exactly 550ms, so removal doesn't snap instantly"
  - "Vitest resolve.alias mirrors tsconfig's @/* paths mapping exactly, so imports resolve identically in tests and components"

requirements-completed: [MKT-02]

coverage:
  - id: D1
    description: ".gitignore repaired so frontend/lib/ is trackable and node_modules/out/.next are excluded"
    verification:
      - kind: other
        ref: "git check-ignore -q frontend/lib/hooks.ts (exit 1); git check-ignore -q frontend/node_modules && frontend/out/index.html (exit 0); git ls-files --error-unmatch on all 6 lib/*.ts + next-env.d.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Next.js static-export scaffold builds and type-checks cleanly"
    verification:
      - kind: other
        ref: "npm --prefix frontend run typecheck (exit 0, no diagnostics)"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run build && grep -q FinAlly frontend/out/index.html"
        status: pass
    human_judgment: false
  - id: D3
    description: "usePriceFlash hook has passing behavioural test coverage (MKT-02) via Vitest+jsdom"
    verification:
      - kind: unit
        ref: "frontend/__tests__/usePriceFlash.test.ts — 7 tests, npm --prefix frontend run test -- usePriceFlash"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dark-theme visual design (colour tokens, flash animation look/feel) matches PLAN.md §2 intent"
    verification: []
    human_judgment: true
    rationale: "Visual/aesthetic fidelity (exact colours, animation feel) is not mechanically verifiable from a build/test pass — a human should eyeball the rendered page once components exist in 01-02/01-03"

duration: ~20min
completed: 2026-09-17
status: complete
---

# Phase 1 Plan 1: Frontend Scaffold Repair Summary

**Repaired the `.gitignore` bug that silently excluded `frontend/lib/` from git, then authored the entire missing Next.js 16 + Tailwind v4 + Vitest scaffold from scratch, closing with 7 passing behavioural tests for the pre-existing `usePriceFlash` hook (MKT-02).**

## Performance
- **Duration:** ~20min
- **Started:** 2026-09-17T22:04:00+02:00 (approx, per session start)
- **Completed:** 2026-09-17T22:17:33+02:00
- **Tasks:** 3 completed
- **Files modified:** 19 (1 modified, 18 created — 3 commits, excluding node_modules/.next/out which stayed gitignored throughout)

## Accomplishments
- Fixed the root-cause repo bug (`.gitignore:17`'s bare `lib/` pattern) that made every file under `frontend/lib/` permanently uncommittable — six hand-authored modules are now tracked
- Reconstructed the entire deleted Next.js project scaffold (`package.json`, `next.config.js`, `tsconfig.json`, `postcss.config.mjs`) with dependency versions pinned exactly to what was already resolved in `node_modules` — zero version drift on `npm install`
- Authored the dark-theme design tokens and the `flash-up`/`flash-down` keyframe CSS that `usePriceFlash.ts` already emits, closing the loop between the pre-existing hook and its visual contract
- Stood up the Vitest + jsdom + Testing Library harness (previously installed but unconfigured) and wrote the first frontend test in the project's history: 7 behavioural assertions on `usePriceFlash`

## Task Commits
1. **Task 1: Repair .gitignore so frontend source is trackable** - `1eed9c5` (fix)
2. **Task 2: Author the Next.js project scaffold and prove it builds** - `29dc069` (feat)
3. **Task 3: Stand up the Vitest harness and cover the price-flash hook (MKT-02)** - `e7c4caa` (test)
**Plan metadata:** pending (docs: complete plan) — committed after this SUMMARY
_Note: Task 3 carries `tdd="true"` but produced a single commit — see Deviations for why the standard RED/GREEN split didn't apply._

## Files Created/Modified
- `.gitignore` - Anchored the Python `lib/` build-dir rule to the repo root (`/lib/`); added a Node/Next.js exclusion block (`node_modules/`, `/frontend/out/`, `.next/`, `*.tsbuildinfo`)
- `frontend/lib/{api,format,hooks,positionMath,types,usePriceFlash}.ts` - Newly tracked (content unchanged, pre-existing)
- `frontend/next-env.d.ts` - Newly tracked (content unchanged, pre-existing)
- `frontend/package.json` / `package-lock.json` - Dependency manifest, exact pins matching resolved `node_modules`; scripts for dev/build/lint/test/test:watch/typecheck
- `frontend/next.config.js` - `output: "export"`, `trailingSlash: true`
- `frontend/tsconfig.json` - Strict TS config with `@/*` alias; `jsx` auto-corrected to `react-jsx` by Next's build (see Deviations)
- `frontend/postcss.config.mjs` - Tailwind v4 CSS-first PostCSS plugin wiring
- `frontend/app/globals.css` - Tailwind import, dark-theme `@theme` tokens, `flash-up`/`flash-down` keyframe animations
- `frontend/app/layout.tsx` - Root server component, imports `globals.css`, exports `metadata`
- `frontend/app/page.tsx` - Minimal terminal shell rendering "FinAlly" + "Simulated market data" subtitle
- `frontend/vitest.config.ts` - jsdom environment, React plugin, `@` alias mirroring tsconfig
- `frontend/vitest.setup.ts` - Registers `@testing-library/jest-dom` matchers
- `frontend/__tests__/usePriceFlash.test.ts` - 7 tests covering all behaviours in the plan's `<behavior>` block

## Decisions Made
See `key-decisions` in frontmatter above.

## Deviations from Plan

**1. [Rule 1 - Bug/tooling] Next.js build auto-corrected `tsconfig.json`'s `jsx` and `include`**
- **Found during:** Task 2, first `npm run build`
- **Issue:** The plan specified `jsx: "preserve"` verbatim (per RESEARCH.md's proposed config). Next.js 16's Turbopack build detected this and printed "mandatory changes: jsx was set to react-jsx (next.js uses the React automatic runtime)", rewriting the file on disk. It also appended `.next/dev/types/**/*.ts` to `include`.
- **Fix:** Accepted the framework's auto-correction rather than reverting it — `jsx: preserve` is incompatible with the App Router's automatic JSX runtime as enforced by the installed Next 16.3.5, so fighting it would break the build. Re-ran `typecheck` and `build` afterward to confirm both still pass cleanly.
- **Files modified:** `frontend/tsconfig.json` (already captured in the Task 2 commit since the build ran before that commit)
- **Verification:** `npm run typecheck` clean; `npm run build` succeeds; `frontend/out/index.html` contains "FinAlly"
- **Committed in:** `29dc069`

**2. [Note, not a rule-triggered deviation] Task 3's TDD cycle collapsed to a single "test" commit**
- **Found during:** Task 3
- **Issue:** The task carries `tdd="true"`, and the generic RED-GREEN-REFACTOR cycle expects an intentionally-failing test first. `usePriceFlash.ts` is pre-existing, reviewed, correct source that the plan explicitly forbids modifying. Writing a correct test against already-correct behavior cannot produce a legitimate RED (per the plan's own embedded guidance: "GREEN here means the test itself passes against the existing implementation, not new implementation code").
- **Resolution:** Authored `vitest.config.ts`, `vitest.setup.ts`, and the test file together, ran the suite once, and confirmed all 7 tests passed immediately — exactly the outcome the plan's TDD carve-out anticipates. No artificial failing test was manufactured (that would have been a worse practice: INVALID_RED masquerading as compliance). Single commit typed `test` since only test-infrastructure/test-only files were added — no production code changed.
- **Verification:** `npm run test -- usePriceFlash` → 7 passed; `git diff --quiet -- frontend/lib/usePriceFlash.ts` → hook byte-identical to before the task
- **Committed in:** `e7c4caa`

**3. [Non-blocking observation, not fixed] Vitest config-loader warning**
- **Found during:** Task 3, every `npm run test` invocation
- **Issue:** Vitest 5's native config loader warns that `vitest.config.ts`'s ESM `export default` syntax is "loaded as CommonJS" because `frontend/package.json` has no `"type": "module"`, and that this will become a hard requirement in a future Vitest major.
- **Why not fixed:** Adding `"type": "module"` to `package.json` would force Node to treat `frontend/next.config.js` (authored with `module.exports`, per RESEARCH.md's verbatim CommonJS example) as ESM too, breaking Next's config loading unless that file is also renamed to `.cjs` — a larger, out-of-scope change for a warning that does not currently fail any command. Logged here rather than to `WINDOWS.md` since it is a tooling-version warning, not a stub/skipped-test/deviation from a requirement.
- **Impact:** None today — all commands (`test`, `typecheck`, `build`) pass. Revisit if/when Vitest makes this a hard error.

---
**Total deviations:** 1 auto-fixed (Rule 1 — tooling-mandated config correction), 1 documented TDD-flow note (plan-anticipated, not a rule violation), 1 non-blocking observation left unfixed (scope boundary).
**Impact on plan:** None — all acceptance criteria and the plan's overall `<verification>` block pass without exception.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `frontend/` is now a buildable, type-clean, testable Next.js 16 static-export project — plan 01-02 (SSE wiring, `usePriceStream`, `PriceStreamContext`, watchlist/chart components) can build directly on this scaffold.
- `frontend/lib/*.ts` is fully trackable; new files added there in later plans (`usePriceStream.ts`, `PriceStreamContext.tsx` per RESEARCH.md's recommended structure) will commit normally.
- Backend baseline (`uv run --directory backend --extra dev pytest -q`) still reports 73 passed — this plan touched no backend files and did not disturb it.
- No blockers for 01-02.

---
*Phase: 01-live-price-terminal*
*Completed: 2026-09-17*

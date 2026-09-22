---
phase: quick-260922-ljr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/components/chat/ChatPanel.tsx
  - frontend/__tests__/ChatPanel.test.tsx
  - frontend/app/page.tsx
autonomous: true
requirements: [CHAT-01, CHAT-06]

estimate:
  tokens: 45000
  raw_tokens: 30000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "After the user collapses and re-expands the chat panel, the restored conversation is scrolled to the newest message, not to the top."
    - "The chat sidebar's message input and Send button are reachable on every viewport, including short (~620px tall) laptop viewports at >=1024px width."
    - "Every text element in ChatPanel carries the line-height its 04-UI-SPEC typography role declares: Body 1.5, Label 1.4, Heading 1.3."
  artifacts:
    - frontend/components/chat/ChatPanel.tsx
    - frontend/__tests__/ChatPanel.test.tsx
    - frontend/app/page.tsx
  key_links:
    - "ChatPanel scroll effect deps <-> the `!collapsed &&` conditional mount: the container unmounts on collapse, so a fresh div with scrollTop 0 mounts on expand and only a re-run of the effect re-pins it to the bottom."
    - "page.tsx sidebar `lg:max-h-[calc(100vh-4rem)]` <-> `lg:overflow-y-auto`: the height cap and the scroll affordance must be declared at the same breakpoint or capped content has no scroll path."
    - "04-UI-SPEC Typography table (1.5 / 1.4 / 1.3) <-> the `leading-[...]` class adjacent to each `text-sm` / `text-xs` / `text-base` class in ChatPanel.tsx."
---

<objective>
Close the three BLOCKER findings in `.planning/phases/04-ai-copilot/04-UI-REVIEW.md` so Phase 04's chat panel complies with its approved design contract.

Purpose: The review scored Phase 04 at 15/24 and marked it "cannot ship". Two of the three blockers are functional (a restored conversation renders scrolled to the top; the Send button can fall outside a capped sidebar with no scroll path), and one is a contract violation (declared line-heights never applied).
Output: Three scoped fixes across `ChatPanel.tsx`, `page.tsx`, and `ChatPanel.test.tsx`, each with an automated gate.

Scope is strictly the three BLOCKERs. The WARNING-level findings in the same review — the non-scale spacing values (`px-3`, `mt-3`, arbitrary `max-h`) and the missing `aria-expanded` / `role="alert"` / `aria-live` attributes — are explicitly OUT of scope for this task and must not be touched.
</objective>

<execution_context>
@/Users/valeriu/AICourses/finally/.claude/gsd-core/workflows/execute-plan.md
@/Users/valeriu/AICourses/finally/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/04-ai-copilot/04-UI-REVIEW.md
@.planning/phases/04-ai-copilot/04-UI-SPEC.md
@frontend/components/chat/ChatPanel.tsx
@frontend/app/page.tsx
@frontend/__tests__/ChatPanel.test.tsx
</context>

<environment_facts>
Verified by the planner against the working tree — do not re-derive these:

- Test runner: vitest 5.0.1 + jsdom 30.1.0, `environment: "jsdom"`, `globals: true`. Run from the repo root as `npm --prefix frontend test`; extra args pass through to `vitest run`.
- `frontend/__tests__/ChatPanel.test.tsx` currently holds **19 passing tests**. The file-level `beforeEach` already mocks `getChatHistory` to resolve `{ ok: true, data: { messages: [] } }`, and `@/lib/api` is `vi.mock`'d at module scope.
- **jsdom scroll semantics (measured, not assumed):** `element.scrollTop` is a real read/write property that stores what you assign. `element.scrollHeight` is hard-coded to `0` and jsdom defines it on `Element.prototype` — **not** on `HTMLElement.prototype`. Shadowing it on `HTMLElement.prototype` therefore overrides it, and `delete`ing that shadow falls back through to jsdom's own accessor (verified: returns `0` again).
- `frontend/components/chat/ChatPanel.tsx` uses only `//` line comments (no `/* */` blocks), so the typography gate below filters comment lines with `grep -v '^[[:space:]]*//'`.
- Current class counts in the non-comment body of `ChatPanel.tsx`: `text-sm` x9, `text-xs` x2, `text-base` x1, `leading-` x0.
- `ChatPanel.tsx` is the only file in `frontend/components/chat/`.
- The project does **not** use `prettier-plugin-tailwindcss` — nothing will reorder class names after they are written.
</environment_facts>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Re-pin the message list to the newest message on expand</name>
  <files>frontend/components/chat/ChatPanel.tsx, frontend/__tests__/ChatPanel.test.tsx</files>
  <behavior>
    - Test: with history resolved and the panel rendered, clicking the toggle to collapse and then clicking it again to expand leaves the `chat-messages` container scrolled to the bottom (its `scrollTop` equals its `scrollHeight`).
    - Test: the 19 pre-existing tests in the file still pass, unchanged.
  </behavior>
  <action>
    Write the failing test first, then make it pass.

    TEST (`frontend/__tests__/ChatPanel.test.tsx`): add a new `describe` block, "scroll-to-bottom on expand", at the end of the outer `ChatPanel` describe. Give it its own scoped `beforeEach`/`afterEach` — the scrollHeight stub must NOT be hoisted to the file-level `beforeEach`, because the 19 existing tests share that scope and a non-zero scrollHeight could change what they observe.

    Use `beforeEach`/`afterEach`, not `beforeAll`/`afterAll`: a per-file hook that installs the stub once will leak it to the remaining tests if any test in the block throws before teardown.

    In the scoped `beforeEach`, stub scrollHeight with `Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 1000 })`. This stub is mandatory, not incidental: jsdom reports `scrollHeight` as `0`, so without it the component assigns `scrollTop = 0` and the assertion passes vacuously against both the broken and the fixed component. In the scoped `afterEach`, restore with `delete (HTMLElement.prototype as unknown as Record&lt;string, unknown&gt;).scrollHeight` — jsdom's real accessor lives on `Element.prototype`, so deleting the `HTMLElement.prototype` shadow falls through to it. Do not stub `scrollTop`; jsdom stores assignments to it natively.

    The test body: `render(&lt;ChatPanel /&gt;)`, await the `chat-messages` testid, click `chat-toggle` (collapses), click `chat-toggle` again (expands), then assert `screen.getByTestId("chat-messages").scrollTop` is `1000`. Use `userEvent.setup()` and `await user.click(...)`, matching the existing collapse/expand test's style. The planner confirmed this test fails against the current component with "expected +0 to be 1000".

    FIX (`frontend/components/chat/ChatPanel.tsx`): the scroll effect near line 175 has the dependency array `[messages.length, sending]`. Add `collapsed` to it, giving `[messages.length, sending, collapsed]`. Reason, worth recording in the effect's existing comment: the expanded body is conditionally mounted behind `!collapsed && (...)`, so collapsing unmounts the scroll container entirely and expanding mounts a brand-new div whose `scrollTop` starts at 0; only a re-run of the effect re-pins it. The effect's existing `if (!container) return;` guard already makes the collapse-direction run a harmless no-op, so no other change is needed. Do not restructure the effect, do not add a second effect, and do not convert the conditional mount into a CSS-hidden node.
  </action>
  <verify>
    <automated>npm --prefix frontend test -- __tests__/ChatPanel.test.tsx</automated>
  </verify>
  <done>`__tests__/ChatPanel.test.tsx` reports 20 passing tests (19 pre-existing plus the new expand-scroll case), and the new case fails if `collapsed` is removed from the dependency array again.</done>
</task>

<task type="auto">
  <name>Task 2: Give the capped chat sidebar a scroll path so the form is always reachable</name>
  <files>frontend/app/page.tsx</files>
  <action>
    In `frontend/app/page.tsx`, the sidebar wrapper div that contains `&lt;ChatPanel /&gt;` (near line 121) currently reads `w-full lg:w-96 lg:shrink-0 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-4rem)]`. Add `lg:overflow-y-auto` to that same className.

    Why this and not a flex restructure: ChatPanel's own interior is ~572px tall at minimum (header + message list + form), growing past 620px once the history-error banner and the send-error slot both render. The cap only binds at the `lg:` breakpoint and above, where a 1366x768 or 1280x720 window leaves roughly 620-656px — so capped content overflows with no scroll path and the Send button becomes unreachable. Below `lg:` the sidebar is an ordinary block in the vertical page flow with no cap, so nothing is clipped there; pairing the scroll affordance with the cap at the same breakpoint keeps the two facts adjacent and true together. The reviewed alternative (restructure ChatPanel into a flex column and let the message list flex) was rejected deliberately: `flex-1` resolves to `flex-basis: 0%`, and inside a container whose height is content-determined under a `max-height`, that collapses the message list to zero height — and jsdom has no layout engine, so such a change could not be verified automatically here.

    Change only the sidebar div's className. Do not touch ChatPanel.tsx in this task, do not alter the `max-h-[440px]` on the message list, and do not change the `lg:max-h-[calc(100vh-4rem)]` value itself.
  </action>
  <verify>
    <automated>P=/Users/valeriu/AICourses/finally/frontend/app/page.tsx; W=$(grep -A 2 'lg:w-96' "$P"); printf '%s\n' "$W" | grep -q 'lg:max-h-\[calc(100vh-4rem)\]' && printf '%s\n' "$W" | grep -q 'lg:overflow-y-auto' && npm --prefix frontend run typecheck && echo "SIDEBAR GATE PASS"</automated>
    <human-check>In a browser at >=1024px wide and roughly 620px tall, confirm the chat input and Send button are reachable (visible, or reachable by scrolling the sidebar) with the history-error banner showing. jsdom performs no layout, so no automated check can assert this.</human-check>
  </verify>
  <done>The sidebar wrapper div declares both `lg:max-h-[calc(100vh-4rem)]` and `lg:overflow-y-auto`, and `npm --prefix frontend run typecheck` passes. (This is the structural fact the gate proves; viewport reachability is confirmed by the human-check above.)</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Apply the UI-SPEC line-height values to every ChatPanel text element</name>
  <files>frontend/components/chat/ChatPanel.tsx, frontend/__tests__/ChatPanel.test.tsx</files>
  <behavior>
    - Test: the "AI Copilot" heading carries the Heading line-height class.
    - Test: an action pill carries the Label line-height class.
    - Test: the seed-greeting bubble carries the Body line-height class.
  </behavior>
  <action>
    Apply one line-height class per typography role, exactly as the 04-UI-SPEC Typography table declares them — Body 14px/1.5, Label 12px/1.4, Heading 16px/1.3:

    - every `text-sm` occurrence gets `leading-[1.5]`
    - every `text-xs` occurrence gets `leading-[1.4]`
    - every `text-base` occurrence gets `leading-[1.3]`

    Place the line-height class **immediately after** its size class in the className string, separated by a single space. This adjacency is a hard requirement, not a style preference: the gate below counts adjacent pairs, and no formatter in this project reorders Tailwind classes.

    Use these unitless arbitrary values, not Tailwind's named `leading-*` scale. `04-UI-REVIEW.md` suggests `leading-6`, `leading-snug` and similar, but those do not compute to the ratios the UI-SPEC declares: `leading-6` on 14px text is 24/14 = 1.71 (not 1.5) and `leading-snug` is 1.375 (not 1.3). The UI-SPEC table governs; the review's suggested class names are arithmetically wrong against it, and the divergence is intentional.

    The 12 sites in `ChatPanel.tsx`: the `PILL_BASE_CLASS` constant and the collapse-toggle button are the two `text-xs` sites; the `AI Copilot` `&lt;h2&gt;` is the single `text-base` site; the remaining nine are `text-sm` — the history-error paragraph, the history-loading bubble, the seed-greeting bubble, the user bubble, the assistant bubble, the thinking bubble, the input, the Send button, and the send-error paragraph.

    For the pills specifically, add the class **inside the `PILL_BASE_CLASS` constant**, adjacent to the `text-xs` already there — not at either `ActionPills` template-interpolation site. A class added at the interpolation site still reaches the rendered element (so the test would pass) but leaves no adjacent pair in the constant, so the gate would fail while the test says green.

    Do not write any of these class-name literals into a code comment. The gate counts occurrences across the whole non-comment body of the file, and a class name mentioned in prose inflates the size-class count without a matching adjacent pair, failing the gate. Change only className strings; add no new elements and remove no existing classes.

    TEST (`frontend/__tests__/ChatPanel.test.tsx`): add one test asserting the three roles. Assert on the rendered elements rather than on source text — e.g. `expect(screen.getByText("AI Copilot")).toHaveClass("leading-[1.3]")`, the seed-greeting paragraph has `leading-[1.5]`, and a `chat-action-pill` (render a response carrying one action, mirroring the existing pill tests' setup) has `leading-[1.4]`.
  </action>
  <verify>
    <automated>F=/Users/valeriu/AICourses/finally/frontend/components/chat/ChatPanel.tsx; C=$(grep -v '^[[:space:]]*//' "$F"); sm=$(printf '%s\n' "$C" | grep -o 'text-sm' | wc -l | tr -d ' '); smL=$(printf '%s\n' "$C" | grep -o 'text-sm leading-\[1\.5\]' | wc -l | tr -d ' '); xs=$(printf '%s\n' "$C" | grep -o 'text-xs' | wc -l | tr -d ' '); xsL=$(printf '%s\n' "$C" | grep -o 'text-xs leading-\[1\.4\]' | wc -l | tr -d ' '); b=$(printf '%s\n' "$C" | grep -o 'text-base' | wc -l | tr -d ' '); bL=$(printf '%s\n' "$C" | grep -o 'text-base leading-\[1\.3\]' | wc -l | tr -d ' '); [ "$sm" -ge 9 ] && [ "$smL" -eq "$sm" ] && [ "$xs" -ge 2 ] && [ "$xsL" -eq "$xs" ] && [ "$b" -ge 1 ] && [ "$bL" -eq "$b" ] && npm --prefix frontend test -- __tests__/ChatPanel.test.tsx && echo "TYPOGRAPHY GATE PASS"</automated>
  </verify>
  <done>Every `text-sm` / `text-xs` / `text-base` occurrence in ChatPanel.tsx's non-comment body is immediately followed by `leading-[1.5]` / `leading-[1.4]` / `leading-[1.3]` respectively (counts at or above the 9 / 2 / 1 floor and equal to their paired counts), and `__tests__/ChatPanel.test.tsx` passes with the new typography assertions.</done>
</task>

</tasks>

<verification>
Run from the repo root after all three tasks:

1. `npm --prefix frontend test` — the whole frontend suite is green. ChatPanel gains one test in Task 1 and one in Task 3, so that file reports 20 after Task 1 and **21 once all three tasks are done**.
2. `npm --prefix frontend run typecheck` — clean.
3. Both structural gates (Task 2 sidebar, Task 3 typography) print their PASS line.
4. Human check: at >=1024px wide and ~620px tall, the chat input and Send button are reachable, and a collapsed-then-expanded panel shows the newest message rather than the top of the conversation.
</verification>

<success_criteria>
- `04-UI-REVIEW.md` blocker 1 closed: `collapsed` is in the scroll effect's dependency array, covered by a test that fails without it.
- `04-UI-REVIEW.md` blocker 2 closed: the capped sidebar declares `lg:overflow-y-auto`, so the message input and Send button are reachable at every viewport.
- `04-UI-REVIEW.md` blocker 3 closed: all 12 ChatPanel text sites carry the UI-SPEC line-height for their role (Body 1.5 / Label 1.4 / Heading 1.3).
- No WARNING-level finding from the review was touched — spacing values and aria attributes are unchanged.
- Full frontend test suite and typecheck pass.
</success_criteria>

<output>
Create `.planning/quick/260922-ljr-fix-the-3-ui-blockers-from-planning-phas/260922-ljr-SUMMARY.md` when done.
</output>

---
status: testing
phase: 04-ai-copilot
source: [04-VERIFICATION.md]
started: 2026-09-21T17:35:00Z
updated: 2026-09-21T17:35:00Z
---

## Current Test

number: 1
name: Live conversational reply grounded in real portfolio
expected: |
  With the backend running, LLM_MOCK unset, and a real OPENROUTER_API_KEY in .env, asking
  "how is my portfolio doing?" returns a reply that quotes the same cash figure the header
  shows and reads in the terse, numbers-first voice D-04 specifies (not a canned/mocked line).
awaiting: user response

## Tests

### 1. Live conversational reply grounded in real portfolio
expected: The reply quotes the same cash figure the header shows and reads in the terse, numbers-first voice D-04 specifies (not a canned/mocked line). Requires a live OpenRouter/Cerebras network call — LLM_MOCK=true (used by every automated check) never exercises the real completion() path.
result: [pending]

### 2. Live-model trade and watchlist dispatch, including held-position refusal
expected: Telling the assistant to buy shares of a watchlisted ticker drops the header cash figure and shows a green pill. Asking it to remove that ticker from the watchlist shows a red pill explaining the open position. The manual remove control's refusal reads the same way. Live-model dispatch and the held-position refusal behave identically to what LLM_MOCK=true already proves at the route level.
result: [pending]

### 3. Chat history survives a real browser reload
expected: Holding a short conversation including at least one executed trade, then reloading the browser, restores every bubble and action pill in original order (including pill re-render for a restored turn). A fresh database still shows only the greeting.
result: [pending]

### 4. Long message scrolls horizontally in the chat input
expected: Typing a very long single message into the chat input scrolls horizontally inside the single-line `<input>` rather than wrapping to a second line or breaking layout. Unobservable to jsdom (the frontend test environment); source confirms a single-line `<input type="text">` with no `<textarea>`, but the actual scroll behavior needs a real browser.
result: [pending]

### 5. MVP mode / user-story goal-format discrepancy
expected: A decision on whether ROADMAP.md's Phase 4 goal text should be reformatted into strict "As a [role], I want to [capability], so that [outcome]." form (e.g. via `/gsd mvp-phase 04`), or whether `mode: mvp` should be removed from this phase's ROADMAP.md entry. `gsd_run query user-story.validate` returned `valid: false` for the current goal text even though `mode: mvp` is set — every plan's own `<objective>` block is correctly formatted, only the ROADMAP.md phase-level goal text is not. This is a process/governance discrepancy, not evidence the phase goal was missed.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

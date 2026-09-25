# Phase 04: User Setup Required

**Generated:** 2026-09-21
**Phase:** 04-ai-copilot
**Status:** Incomplete

Complete these items for real (non-mock) LLM chat replies to function. Every automated check in
this phase runs under `LLM_MOCK=true` and needs no key — this setup only gates the live
conversational path against Cerebras via OpenRouter.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `OPENROUTER_API_KEY` | openrouter.ai → Keys → Create Key | `.env` (repo root — gitignored, does not exist yet) |
| [ ] | `LLM_MOCK` | Set to `true` to force deterministic mock replies with no network call; leave unset or `false` for live Cerebras inference | `.env` (repo root) |

## Account Setup

- [ ] **Create an OpenRouter account** (if needed)
  - URL: https://openrouter.ai
  - Skip if: Already have an account with API key access

## Verification

After completing setup, from the repo root with the backend running (`uv run --directory backend uvicorn app.main:app`):

```bash
# With LLM_MOCK unset/false and OPENROUTER_API_KEY set in .env, ask the
# assistant a portfolio question and confirm the reply quotes the same
# cash figure the terminal's header shows, in a terse, numbers-first voice.
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "how is my portfolio doing?"}'
```

Expected results:
- HTTP 200 with a `message` that reads as a real, terse desk-analyst reply (not the
  generic fallback text "Sorry, I had trouble putting together a response just now.")
- The quoted cash/position figures match `GET /api/portfolio`

---

**Once all items complete:** Mark status as "Complete" at top of file.

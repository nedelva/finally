# Agent Ownership — FinAlly build team

Each agent writes only within its listed paths. If you need something outside your paths,
message the owning agent by name via SendMessage instead of editing it yourself.

| Agent | Owns (writes) | Notes |
|---|---|---|
| database-engineer | `backend/app/db/**`, `backend/tests/db/**` | Schema, lazy init, seed data. Exposes a small query/session API other backend code imports. |
| backend-api-engineer | `backend/app/api/**`, `backend/app/main.py`, `backend/tests/api/**` | All REST routes except SSE (already done) and the LLM module internals. Wires DB + market data + LLM module together. |
| llm-engineer | `backend/app/llm/**`, `backend/tests/llm/**` | Chat prompt construction, structured-output schema, the `completion()` call via the `cerebras` skill, `LLM_MOCK` mode. No DB or market-data access — pure function in, structured object out. |
| frontend-engineer | `frontend/**` | Full Next.js app. Builds against `planning/API_CONTRACT.md`, not against backend source. |
| devops-engineer | `Dockerfile`, `docker-compose.yml`, `scripts/**`, `.env.example`, `db/.gitkeep`, top-level `README.md` updates if needed | Multi-stage build, start/stop scripts, `test/docker-compose.test.yml` scaffold (coordinate with integration-tester on the latter). |
| integration-tester | `test/**` only | Never edits other agents' code. Builds the container, runs Playwright E2E, reports bugs back to the owning agent by name and to `main`. |

Read-only for everyone: `backend/app/market/**` (done, tested, documented in `backend/CLAUDE.md`).

Shared read reference: `planning/PLAN.md` (spec), `planning/API_CONTRACT.md` (binding API shapes),
`backend/CLAUDE.md` (market data usage).

## Cross-cutting reminders

- `POST /api/watchlist` / `DELETE /api/watchlist/{ticker}` must call
  `market_data_source.add_ticker()` / `remove_ticker()`, not just touch the DB.
- `portfolio_snapshots`: written every 30s by a background task AND immediately after every trade.
- DB path: `db/finally.db` at the project root (Docker volume mount target `/app/db`); lazy-init
  on first use, no separate migration step.
- `.env.example` must exist (README already tells users to `cp .env.example .env`).
- Static frontend serving path and mount order: see bottom of `planning/API_CONTRACT.md`.
- No `.env` exists in this repo yet — `OPENROUTER_API_KEY` is unset. Build and test with
  `LLM_MOCK=true` first; do not block on a real key.

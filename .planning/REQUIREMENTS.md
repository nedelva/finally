# Requirements: FinAlly — AI Trading Workstation

**Defined:** 2026-09-17
**Core Value:** The user can watch live prices stream, place simulated trades, and have an AI assistant that can see the portfolio and act on it in natural language — all in one dependency-free `docker run`.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases. Derived directly from `planning/PLAN.md` (confirmed authoritative during project init).

### Market Data

- [x] **MKT-01**: User sees a watchlist of 10 default tickers with live-updating prices in a grid, streamed via SSE
- [x] **MKT-02**: Prices flash green (uptick) or red (downtick) with a fading CSS animation on change
- [x] **MKT-03**: User sees a sparkline mini-chart beside each watchlist ticker, accumulated from the SSE stream since page load
- [x] **MKT-04**: User can click a ticker in the watchlist to see a larger detailed price chart in the main chart area
- [x] **MKT-05**: Header shows a colored connection-status dot (green/yellow/red) reflecting SSE connection state, with automatic reconnection on disconnect

### Portfolio

- [ ] **PORT-01**: User starts with $10,000 in virtual cash, shown in the header and updating live as portfolio value changes
- [ ] **PORT-02**: User can buy shares of a watched ticker at the current market price with an instant fill (no fees, no confirmation dialog)
- [ ] **PORT-03**: User can sell shares they own at the current market price with an instant fill (no fees, no confirmation dialog)
- [ ] **PORT-04**: User sees a positions table with ticker, quantity, avg cost, current price, unrealized P&L, and % change per holding
- [ ] **PORT-05**: User sees a portfolio heatmap (treemap) with positions sized by weight and colored by P&L (green=profit, red=loss)
- [ ] **PORT-06**: User sees a P&L chart tracking total portfolio value over time, sourced from periodic portfolio snapshots

### Watchlist

- [ ] **WTCH-01**: User can add a ticker to the watchlist manually
- [ ] **WTCH-02**: User can remove a ticker from the watchlist manually

### AI Chat

- [ ] **CHAT-01**: User can send a chat message to the AI assistant and receive a conversational response
- [ ] **CHAT-02**: AI assistant's response is grounded in the user's current portfolio (cash, positions with P&L), watchlist with live prices, and recent conversation history
- [ ] **CHAT-03**: AI assistant can execute trades on the user's behalf when asked or agreed to, shown inline in chat as confirmations, with no manual approval step
- [ ] **CHAT-04**: AI assistant can add/remove watchlist tickers on the user's behalf, shown inline in chat as confirmations
- [ ] **CHAT-05**: If an AI-initiated trade fails validation (e.g. insufficient cash or shares), the assistant reports the failure conversationally
- [ ] **CHAT-06**: Chat conversation history persists and reloads on return visits

### Ops

- [ ] **OPS-01**: Operator can start the full application with a single Docker command (or provided start/stop script) and reach it at `http://localhost:8000`
- [ ] **OPS-02**: Operator's portfolio, watchlist, and trade history persist across container restarts via a volume-mounted SQLite database

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Deployment

- **DEPL-01**: One-command cloud deployment (Terraform for AWS App Runner or equivalent) — explicit stretch goal per PLAN.md §11, not core build

## Out of Scope

Explicitly excluded. Documented to prevent scope creep. (See also PROJECT.md § Out of Scope.)

| Feature | Reason |
|---------|--------|
| User accounts / login / multi-user auth | Single hardcoded `user_id="default"` by design — PLAN.md §7 |
| Limit orders, order book, partial fills | Market orders only, instant fill — PLAN.md §2/§6 |
| Postgres or any external DB server | SQLite only, self-contained — PLAN.md §3 |
| Trade confirmation dialogs, transaction fees | Deliberate zero-friction design for AI-driven demo — PLAN.md §9 |
| docker-compose orchestration for production | Single container is the deployment target — PLAN.md §3 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MKT-01 | Phase 1 | Complete |
| MKT-02 | Phase 1 | Complete |
| MKT-03 | Phase 1 | Complete |
| MKT-04 | Phase 1 | Complete |
| MKT-05 | Phase 1 | Complete |
| PORT-01 | Phase 3 | Pending |
| PORT-02 | Phase 3 | Pending |
| PORT-03 | Phase 3 | Pending |
| PORT-04 | Phase 3 | Pending |
| PORT-05 | Phase 3 | Pending |
| PORT-06 | Phase 3 | Pending |
| WTCH-01 | Phase 2 | Pending |
| WTCH-02 | Phase 2 | Pending |
| CHAT-01 | Phase 4 | Pending |
| CHAT-02 | Phase 4 | Pending |
| CHAT-03 | Phase 4 | Pending |
| CHAT-04 | Phase 4 | Pending |
| CHAT-05 | Phase 4 | Pending |
| CHAT-06 | Phase 4 | Pending |
| OPS-01 | Phase 5 | Pending |
| OPS-02 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0

**By phase:**

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1. Live Price Terminal | MKT-01, MKT-02, MKT-03, MKT-04, MKT-05 | 5 |
| 2. Persistent Watchlist | WTCH-01, WTCH-02 | 2 |
| 3. Trading & Portfolio | PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06 | 6 |
| 4. AI Copilot | CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06 | 6 |
| 5. One-Command Delivery | OPS-01, OPS-02 | 2 |

---
*Requirements defined: 2026-09-17*
*Last updated: 2026-09-17 after roadmap creation (traceability mapped)*

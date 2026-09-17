# API Contract — FinAlly

Binding contract for all agents. Do not deviate from field names, types, or paths without
updating this file first and notifying affected owners. See `planning/OWNERSHIP.md` for who
writes what.

All JSON. All money/price values are `number` (float). All timestamps are ISO-8601 strings
(`datetime.now(UTC).isoformat()`) unless noted otherwise (SSE uses Unix-seconds floats — see below).

---

## SSE: `GET /api/stream/prices`

Implemented already in `backend/app/market/stream.py` — **do not modify**; this section documents
its actual output for frontend/integration consumers.

`text/event-stream`. Each event is `data: <json>\n\n` where `<json>` is an object keyed by ticker:

```json
{
  "AAPL": {
    "ticker": "AAPL",
    "price": 190.50,
    "previous_price": 189.80,
    "timestamp": 1737310000.123,
    "change": 0.70,
    "change_percent": 0.37,
    "direction": "up"
  },
  "GOOGL": { "...": "..." }
}
```

- `timestamp` is Unix seconds (float), NOT ISO — this is the one exception in the contract.
- `direction` is `"up" | "down" | "flat"`.
- Sent every ~500ms only when the cache version changed; only tracked tickers appear.
- First line of stream is `retry: 1000` (EventSource reconnect directive) — not a data event.

---

## Portfolio

### `GET /api/portfolio`

Response `200`:
```json
{
  "cash_balance": 8450.32,
  "positions": [
    {
      "ticker": "AAPL",
      "quantity": 10.0,
      "avg_cost": 185.20,
      "current_price": 190.50,
      "market_value": 1905.00,
      "unrealized_pnl": 53.00,
      "unrealized_pnl_percent": 2.86
    }
  ],
  "total_value": 10355.32,
  "total_unrealized_pnl": 53.00
}
```
- `total_value` = `cash_balance` + sum of `market_value` over positions.
- If a position's ticker has no live price yet (cache miss), use `avg_cost` as `current_price` and
  `unrealized_pnl` = 0 for that position — never 500 on a missing price.

### `POST /api/portfolio/trade`

Request:
```json
{ "ticker": "AAPL", "side": "buy", "quantity": 10 }
```
- `side` is `"buy" | "sell"`. `quantity` is a positive float (fractional allowed).

Response `200` (trade executed):
```json
{
  "success": true,
  "trade": {
    "id": "uuid",
    "ticker": "AAPL",
    "side": "buy",
    "quantity": 10.0,
    "price": 190.50,
    "executed_at": "2026-09-17T20:15:00.000Z"
  },
  "portfolio": { "...": "same shape as GET /api/portfolio" }
}
```

Response `400` (validation failure — insufficient cash, insufficient shares, unknown ticker, price
unavailable, non-positive quantity):
```json
{ "success": false, "error": "Insufficient cash: need $1905.00, have $500.00" }
```
- Fill price is the current cache price at execution time. If no price is available for the
  ticker, reject with `400` and `"error": "No live price available for TICKER"`.
- On success: upsert `positions` (weighted-average cost on buy; reduce quantity on sell, delete
  row if quantity hits 0), append to `trades`, adjust `cash_balance`, and write a
  `portfolio_snapshots` row immediately (see below).

### `GET /api/portfolio/history`

Response `200`:
```json
{
  "snapshots": [
    { "total_value": 10000.0, "recorded_at": "2026-09-17T20:00:00.000Z" },
    { "total_value": 10355.32, "recorded_at": "2026-09-17T20:00:30.000Z" }
  ]
}
```
- Ordered ascending by `recorded_at`.

---

## Watchlist

### `GET /api/watchlist`

Response `200`:
```json
{
  "watchlist": [
    {
      "ticker": "AAPL",
      "added_at": "2026-09-17T19:00:00.000Z",
      "price": 190.50,
      "previous_price": 189.80,
      "change": 0.70,
      "change_percent": 0.37,
      "direction": "up"
    }
  ]
}
```
- Price fields come from `PriceCache.get(ticker)`; if not yet cached (source just started), set
  `price`, `previous_price`, `change`, `change_percent` to `null` and `direction` to `"flat"`.

### `POST /api/watchlist`

Request: `{ "ticker": "PYPL" }` — backend uppercases it.

Response `201`:
```json
{ "ticker": "PYPL", "added_at": "2026-09-17T19:00:00.000Z" }
```
Response `409` if already on the watchlist: `{ "error": "PYPL is already on the watchlist" }`.

- **Must call `market_data_source.add_ticker(ticker)`** in addition to the DB insert, so the
  simulator/Massive poller starts producing prices for it immediately. This is easy to forget —
  without it, a newly added ticker shows in the watchlist with a null price forever.

### `DELETE /api/watchlist/{ticker}`

Response `204` (no body) on success. `404` if not present: `{ "error": "TICKER not in watchlist" }`.
- **Must call `market_data_source.remove_ticker(ticker)`** in addition to the DB delete — **except**
  when the user still holds a position in that ticker. In that case the watchlist row is still
  deleted, but `remove_ticker()` is skipped so the ticker stays in the live `PriceCache`; otherwise
  the position's price would freeze at stale `avg_cost` and a subsequent sell would be rejected with
  "no live price available" for a ticker the user still owns. Symmetrically, on startup the market
  data source is seeded with `watchlist ∪ held-position tickers`, not the watchlist alone, so a
  position surviving a container restart still gets priced even if it was removed from the
  watchlist in a prior session. (Implemented by `backend-api-engineer`; see `app/api/watchlist.py`
  and `app/main.py`.)

---

## Chat

### `POST /api/chat`

Request:
```json
{ "message": "What's my biggest position?" }
```

Response `200`:
```json
{
  "message": "Your biggest position is AAPL at $1,905 (18% of portfolio)...",
  "trades": [
    {
      "ticker": "AAPL",
      "side": "buy",
      "quantity": 10,
      "status": "executed",
      "price": 190.50,
      "error": null
    }
  ],
  "watchlist_changes": [
    { "ticker": "PYPL", "action": "add", "status": "executed", "error": null }
  ]
}
```
- `trades` and `watchlist_changes` are always arrays (empty if the LLM proposed none) — never
  omitted, so the frontend can render "no actions taken" deterministically.
  `status` is `"executed" | "failed"`; when `"failed"`, `error` holds the reason
  (e.g. insufficient cash) and the same failure info is folded into `message` context sent back
  to the LLM's next turn or just left for the assistant text to explain in `message` — the
  frontend does not need to re-derive it.
- This whole object is also serialized into `chat_messages.actions` (JSON) for the assistant row.
- `backend-api-engineer` owns this route end-to-end: load context, call the LLM module, execute
  actions via the exact same trade/watchlist code paths as the manual endpoints, persist,
  respond. `llm-engineer` owns everything inside the LLM module (prompt, schema, the
  `completion()` call, parsing) — it takes a plain context dict and conversation history in, and
  returns a parsed `{message, trades, watchlist_changes}` object out. It never touches the DB or
  the market data source.

#### LLM module interface (llm-engineer implements, backend-api-engineer calls)

```python
def get_chat_response(
    user_message: str,
    portfolio_context: dict,   # cash_balance, positions, watchlist, total_value — plain dict, e.g. GET /api/portfolio + GET /api/watchlist shapes merged
    history: list[dict],       # [{"role": "user"|"assistant", "content": str}, ...] most recent last
) -> ChatResponse:              # pydantic model: message: str, trades: list[TradeAction], watchlist_changes: list[WatchlistAction]
    ...
```
- Respects `LLM_MOCK=true`: returns a deterministic canned response (e.g. echoes the message,
  proposes no trades) without calling OpenRouter, so `backend-api-engineer` and
  `integration-tester` can develop/test without a real key.
- Uses the `cerebras` skill for the real call (LiteLLM → OpenRouter, `openrouter/openai/gpt-oss-120b`
  via Cerebras, structured output with a pydantic `response_format`).

---

## System

### `GET /api/health`

Response `200`: `{ "status": "ok" }`

---

## Error shape (general)

Any 4xx/5xx not specified above: `{ "error": "human readable message" }`. Never leak stack traces.

---

## Static frontend serving (DevOps + backend-api-engineer)

- Next.js builds with `output: 'export'` into `frontend/out/`.
- Dockerfile copies `frontend/out/` to `backend/static/` (final image path: `/app/static`).
- FastAPI mounts `/app/static` at `/` as a catch-all AFTER all `/api/*` routes are registered, with
  `html=True` so `/` serves `index.html` and client-side routes fall back to it.
- In local dev (no Docker), `backend/static/` may not exist — mounting must not crash the app;
  guard with an existence check and log a warning instead.

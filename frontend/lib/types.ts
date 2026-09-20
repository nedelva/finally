// Types mirroring planning/API_CONTRACT.md exactly. Do not drift from that
// file without updating it first — see OWNERSHIP.md.

export type Direction = "up" | "down" | "flat";

/** One ticker's entry inside an SSE `data:` event, keyed by ticker symbol. */
export interface PriceTick {
  ticker: string;
  price: number;
  previous_price: number;
  /** Unix seconds (float) — the one non-ISO timestamp in the contract. */
  timestamp: number;
  change: number;
  change_percent: number;
  direction: Direction;
}

/** The full shape of one SSE `data:` event — keyed by ticker. */
export type PriceStreamEvent = Record<string, PriceTick>;

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  positions: Position[];
  total_value: number;
  total_unrealized_pnl: number;
}

export type TradeSide = "buy" | "sell";

export interface TradeRequest {
  ticker: string;
  side: TradeSide;
  quantity: number;
}

export interface Trade {
  id: string;
  ticker: string;
  side: TradeSide;
  quantity: number;
  price: number;
  executed_at: string;
}

export interface TradeSuccessResponse {
  success: true;
  trade: Trade;
  portfolio: Portfolio;
}

export interface TradeErrorResponse {
  success: false;
  error: string;
}

export type TradeResponse = TradeSuccessResponse | TradeErrorResponse;

export interface PortfolioSnapshot {
  total_value: number;
  recorded_at: string;
}

export interface PortfolioHistoryResponse {
  snapshots: PortfolioSnapshot[];
}

export interface WatchlistEntry {
  ticker: string;
  added_at: string;
  price: number | null;
  previous_price: number | null;
  change: number | null;
  change_percent: number | null;
  direction: Direction;
}

export interface WatchlistResponse {
  watchlist: WatchlistEntry[];
}

export interface AddWatchlistResponse {
  ticker: string;
  added_at: string;
}

export type ActionStatus = "executed" | "failed";

export interface ChatTradeAction {
  ticker: string;
  side: TradeSide;
  quantity: number;
  status: ActionStatus;
  price: number | null;
  error: string | null;
}

export type WatchlistActionKind = "add" | "remove";

export interface ChatWatchlistAction {
  ticker: string;
  action: WatchlistActionKind;
  status: ActionStatus;
  error: string | null;
}

export interface ChatResponse {
  message: string;
  trades: ChatTradeAction[];
  watchlist_changes: ChatWatchlistAction[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatResponse | null;
  createdAt: number;
}

export interface ApiErrorBody {
  error: string;
}

/** Connection status for the SSE stream, driving the header status dot. */
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

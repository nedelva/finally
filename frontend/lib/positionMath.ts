import type { Position } from "./types";

export interface LivePosition {
  price: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

/**
 * Recomputes a position's price-derived fields (market value, unrealized
 * P&L, P&L%) against a live SSE price, so the positions table and heatmap
 * never show a live price next to a stale P&L computed from the last
 * `GET /api/portfolio` poll. Falls back to the REST snapshot's own fields
 * when no live tick exists for the ticker yet (position holds a ticker not
 * on the watchlist, or the SSE stream hasn't ticked it since page load).
 */
export function deriveLivePosition(position: Position, livePrice: number | undefined): LivePosition {
  if (livePrice === undefined) {
    return {
      price: position.current_price,
      marketValue: position.market_value,
      pnl: position.unrealized_pnl,
      pnlPercent: position.unrealized_pnl_percent,
    };
  }
  const marketValue = position.quantity * livePrice;
  const pnl = (livePrice - position.avg_cost) * position.quantity;
  const pnlPercent = position.avg_cost > 0 ? (livePrice / position.avg_cost - 1) * 100 : 0;
  return { price: livePrice, marketValue, pnl, pnlPercent };
}

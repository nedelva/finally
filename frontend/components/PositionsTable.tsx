"use client";

// Live positions table (PORT-04). Reuses Watchlist.tsx's panel chrome and
// scroll-container shape verbatim, and WatchlistRow's cell classes, border
// rule, and up/down/flat colour logic. Every price-derived cell comes from
// deriveLivePosition() — never a second, locally-recomputed number — so this
// table's figures can never drift from the header's live total
// (useLiveTotalValue) or the heatmap, which derive the exact same way.

import type { KeyboardEvent, MouseEvent } from "react";
import { deriveLivePosition } from "@/lib/positionMath";
import { formatMoney, formatPercent, formatQuantity } from "@/lib/format";
import type { Position, PriceStreamEvent } from "@/lib/types";

export interface PositionsTableProps {
  positions: Position[];
  ticks: PriceStreamEvent;
  loading: boolean;
  error: string | null;
  /** Currently selected ticker, driving the main chart (D-10). */
  selectedTicker?: string;
  /** Called with a row's ticker on click or keyboard activation. */
  onSelect?: (ticker: string) => void;
}

/**
 * Mirrors WatchlistRow's changeColorClass exactly: up above zero, down below
 * zero, and the neutral flat class at exactly zero. That flat branch is
 * load-bearing — a position on the D-03 avg_cost fallback always has a P&L
 * of exactly zero, so it lands here automatically rather than being coloured
 * as a gain or a loss.
 */
function changeColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-gray-500";
  }
  if (value > 0) return "text-[var(--color-up)]";
  if (value < 0) return "text-[var(--color-down)]";
  return "text-gray-400";
}

const tableHead = (
  <thead>
    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-gray-500">
      <th className="py-2 pl-3 pr-4 font-medium">Symbol</th>
      <th className="py-2 pr-4 font-medium">Qty</th>
      <th className="py-2 pr-4 font-medium">Avg Cost</th>
      <th className="py-2 pr-4 font-medium">Price</th>
      <th className="py-2 pr-4 font-medium">P&L</th>
      <th className="py-2 pr-3 font-medium">Chg %</th>
    </tr>
  </thead>
);

export function PositionsTable({
  positions,
  ticks,
  loading,
  error,
  selectedTicker,
  onSelect,
}: PositionsTableProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <h2 className="px-4 pb-2 pt-4 text-base font-semibold text-gray-200">Positions</h2>
      <div data-testid="positions-scroll-container" className="lg:max-h-[440px] overflow-y-auto">
        {loading ? (
          <table className="w-full border-collapse text-sm">
            {tableHead}
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  data-testid="positions-loading"
                  className="py-6 text-center text-sm text-gray-500"
                >
                  Loading portfolio...
                </td>
              </tr>
            </tbody>
          </table>
        ) : error ? (
          <div
            data-testid="positions-load-error"
            className="px-4 py-6 text-center text-sm text-[var(--color-down)]"
          >
            {error}
          </div>
        ) : positions.length === 0 ? (
          <div data-testid="positions-empty" className="px-4 py-6 text-center text-sm text-gray-500">
            <h3 className="mb-1 font-medium text-gray-300">No positions yet</h3>
            <p>Buy a ticker to see it here.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            {tableHead}
            <tbody>
              {positions.map((position) => {
                const live = deriveLivePosition(position, ticks[position.ticker]?.price);
                const select = () => onSelect?.(position.ticker);
                const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select();
                  }
                };
                const selected = position.ticker === selectedTicker;
                return (
                  <tr
                    key={position.ticker}
                    data-testid={`position-row-${position.ticker}`}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={(_event: MouseEvent<HTMLTableRowElement>) => select()}
                    onKeyDown={handleKeyDown}
                    className={`cursor-pointer border-b border-[var(--color-border)]/60 last:border-b-0 focus:outline-none ${
                      selected ? "bg-[var(--color-border)]/40" : ""
                    }`}
                  >
                    <td className="py-1.5 pl-3 pr-4 font-medium text-gray-200">{position.ticker}</td>
                    <td className="py-1.5 pr-4 tabular-nums text-gray-100">
                      {formatQuantity(position.quantity)}
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums text-gray-100">
                      {formatMoney(position.avg_cost)}
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums text-gray-100">{formatMoney(live.price)}</td>
                    <td className={`py-1.5 pr-4 tabular-nums ${changeColorClass(live.pnl)}`}>
                      {formatMoney(live.pnl, { sign: true })}
                    </td>
                    <td className={`py-1.5 pr-3 tabular-nums ${changeColorClass(live.pnlPercent)}`}>
                      {formatPercent(live.pnlPercent, { sign: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

"use client";

import { usePriceStream } from "@/context/PriceStreamContext";
import { formatMoney, formatPercent, formatQuantity, formatPrice } from "@/lib/format";
import { deriveLivePosition } from "@/lib/positionMath";
import type { Position } from "@/lib/types";

export function PositionsTable({ positions, loading }: { positions: Position[]; loading: boolean }) {
  const { latest } = usePriceStream();

  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-panel" aria-label="Positions">
      <h2 className="border-b border-hairline px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Positions
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2 font-medium">Ticker</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Avg cost</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">P&amp;L</th>
              <th className="px-4 py-2 font-medium">% change</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-ink-muted">
                  {loading ? "Loading positions…" : "No open positions — buy something below."}
                </td>
              </tr>
            )}
            {positions.map((p) => {
              // Positions can hold tickers not on the watchlist; overlay the
              // live SSE price when we have one and recompute P&L from it —
              // showing a live price beside a stale REST-polled P&L would be
              // visibly inconsistent. Falls back entirely to the REST
              // snapshot (which itself falls back to avg_cost on cache miss
              // per API_CONTRACT.md) when there's no live tick yet.
              const live = deriveLivePosition(p, latest[p.ticker]?.price);
              const pnlPositive = live.pnl >= 0;
              return (
                <tr key={p.ticker} className="border-b border-hairline last:border-0" data-testid={`position-row-${p.ticker}`}>
                  <td className="px-4 py-2 font-mono font-semibold text-ink-primary">{p.ticker}</td>
                  <td className="tabular px-4 py-2 text-ink-secondary">{formatQuantity(p.quantity)}</td>
                  <td className="tabular px-4 py-2 text-ink-secondary">{formatPrice(p.avg_cost)}</td>
                  <td className="tabular px-4 py-2 text-ink-primary">{formatPrice(live.price)}</td>
                  <td className={`tabular px-4 py-2 ${pnlPositive ? "text-positive" : "text-negative"}`}>
                    {formatMoney(live.pnl, { sign: true })}
                  </td>
                  <td className={`tabular px-4 py-2 ${pnlPositive ? "text-positive" : "text-negative"}`}>
                    {formatPercent(live.pnlPercent, { sign: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

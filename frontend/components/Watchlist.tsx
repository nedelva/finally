"use client";

// The watchlist grid container. Reads the single shared stream context
// exactly once (per PLAN.md's "one EventSource for the whole app"
// constraint) and distributes each ticker's tick/history down to a pure
// WatchlistRow — no row ever opens its own connection.

import { usePriceStreamContext } from "@/lib/PriceStreamContext";
import { WatchlistRow } from "./WatchlistRow";

export function Watchlist() {
  const { ticks, history, tickers } = usePriceStreamContext();

  return (
    <table className="w-full border-collapse rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="py-2 pl-3 pr-4 font-medium">Symbol</th>
          <th className="py-2 pr-4 font-medium">Price</th>
          <th className="py-2 pr-4 font-medium">Chg %</th>
          <th className="py-2 pr-4 font-medium">Chart</th>
        </tr>
      </thead>
      <tbody>
        {tickers.map((ticker) => (
          <WatchlistRow key={ticker} ticker={ticker} tick={ticks[ticker]} history={history[ticker]} />
        ))}
      </tbody>
    </table>
  );
}

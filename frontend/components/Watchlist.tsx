"use client";

// The watchlist grid container. Reads the single shared stream context
// exactly once (per PLAN.md's "one EventSource for the whole app"
// constraint) and distributes each ticker's tick/history down to a pure
// WatchlistRow — no row ever opens its own connection. Row *membership*
// comes from the REST-backed useWatchlist() hook, not from the stream's
// ever-growing ticker set (which has no removal branch and is structurally
// incapable of shrinking).

import { usePriceStreamContext } from "@/lib/PriceStreamContext";
import { useWatchlist } from "@/lib/hooks";
import { WatchlistRow } from "./WatchlistRow";

export interface WatchlistProps {
  /** Currently selected ticker, driving the main chart (MKT-04). Owned by page.tsx. */
  selectedTicker?: string;
  /** Called with a row's ticker on click or keyboard activation. */
  onSelect?: (ticker: string) => void;
}

export function Watchlist({ selectedTicker, onSelect }: WatchlistProps) {
  const { ticks, history } = usePriceStreamContext();
  const { watchlist } = useWatchlist();

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
        {watchlist.map((entry) => (
          <WatchlistRow
            key={entry.ticker}
            ticker={entry.ticker}
            tick={ticks[entry.ticker]}
            history={history[entry.ticker]}
            selected={entry.ticker === selectedTicker}
            onSelect={onSelect}
          />
        ))}
      </tbody>
    </table>
  );
}

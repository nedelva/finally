"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MainChart } from "@/components/MainChart";
import { Watchlist } from "@/components/Watchlist";
import { useWatchlist } from "@/lib/hooks";
import { PriceStreamProvider, usePriceStreamContext } from "@/lib/PriceStreamContext";

function Terminal() {
  const { status, ticks, history, tickers } = usePriceStreamContext();
  const { watchlist } = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string | undefined>(undefined);

  // Auto-select the first available ticker once the stream reports at least
  // one, so the chart area is never empty after prices arrive. An explicit
  // click (setSelectedTicker below, via Watchlist's onSelect) always wins
  // afterward — this effect only fires while nothing is selected yet.
  useEffect(() => {
    if (!selectedTicker && tickers.length > 0) {
      setSelectedTicker(tickers[0]);
    }
  }, [selectedTicker, tickers]);

  // Clear a stale selection when the charted ticker leaves the watchlist.
  // The grid's membership comes from useWatchlist() (REST), which can
  // shrink on removal — unlike the SSE-derived `tickers` set above, which
  // only ever grows. Without this, removing the currently-charted ticker
  // would leave MainChart frozen on stale data with no live updates and no
  // explanation. Deliberately a separate effect from the one above: their
  // guards (`!selectedTicker` vs. `selectedTicker && not in the watchlist`)
  // are mutually exclusive by design, so merging them would obscure that
  // only one of the two can ever apply on a given render.
  const watchlistTickers = watchlist.map((entry) => entry.ticker);
  useEffect(() => {
    if (selectedTicker && !watchlistTickers.includes(selectedTicker)) {
      setSelectedTicker(watchlistTickers[0]);
    }
  }, [selectedTicker, watchlistTickers]);

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <Header status={status} />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-1/2">
          <Watchlist selectedTicker={selectedTicker} onSelect={setSelectedTicker} />
        </div>
        <div className="lg:w-1/2">
          <MainChart
            selectedTicker={selectedTicker}
            history={selectedTicker ? (history[selectedTicker] ?? []) : []}
            tick={selectedTicker ? ticks[selectedTicker] : undefined}
          />
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <PriceStreamProvider>
      <Terminal />
    </PriceStreamProvider>
  );
}

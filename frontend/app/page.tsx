"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { MainChart } from "@/components/MainChart";
import { Watchlist } from "@/components/Watchlist";
import { PriceStreamProvider, usePriceStreamContext } from "@/lib/PriceStreamContext";

function Terminal() {
  const { status, ticks, history, tickers } = usePriceStreamContext();
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

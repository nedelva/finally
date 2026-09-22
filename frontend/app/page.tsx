"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Header } from "@/components/Header";
import { Heatmap } from "@/components/Heatmap";
import { MainChart } from "@/components/MainChart";
import { PnLChart } from "@/components/PnLChart";
import { PositionsTable } from "@/components/PositionsTable";
import { TradeBar } from "@/components/TradeBar";
import { Watchlist } from "@/components/Watchlist";
import { useLiveTotalValue, usePortfolio, usePortfolioHistory, useWatchlist } from "@/lib/hooks";
import { PriceStreamProvider, usePriceStreamContext } from "@/lib/PriceStreamContext";

function Terminal() {
  const { status, ticks, history, tickers } = usePriceStreamContext();
  const { watchlist } = useWatchlist();
  const {
    portfolio,
    loading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = usePortfolio();
  const {
    snapshots,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = usePortfolioHistory();
  const liveTotalValue = useLiveTotalValue(portfolio, ticks);
  const [selectedTicker, setSelectedTicker] = useState<string | undefined>(undefined);

  // Keeps the chart selection valid across two independent, differently
  // shaped ticker sources: `tickers` (SSE-derived, monotonically grows —
  // never shrinks even when a ticker is removed from the watchlist) and
  // `watchlistTickers` (REST-derived, the source of truth for membership,
  // which *can* shrink to empty on removal). A single effect derives the
  // target from both with matching precedence, rather than two separate
  // effects — a prior two-effect version could enter a permanent ping-pong
  // loop: removing the last ticker cleared the selection (via the
  // watchlist-membership guard), which the "auto-select first available"
  // guard then immediately re-populated from the never-shrinking `tickers`
  // set, which the membership guard then cleared again, forever. The single
  // guard here checks watchlist membership directly, so "no valid
  // selection" can never re-trigger a selection of a ticker outside the
  // current watchlist.
  useEffect(() => {
    const watchlistTickers = watchlist.map((entry) => entry.ticker);
    const validSelection = selectedTicker && watchlistTickers.includes(selectedTicker);
    if (validSelection) return;
    const fallback = watchlistTickers.find((t) => tickers.includes(t)) ?? watchlistTickers[0];
    if (fallback !== selectedTicker) {
      setSelectedTicker(fallback);
    }
  }, [selectedTicker, watchlist, tickers]);

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <Header
        status={status}
        cashBalance={portfolio?.cash_balance ?? null}
        totalValue={liveTotalValue}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 min-w-0 flex-col gap-4">
          <div
            data-testid="terminal-layout-row"
            className="flex flex-col gap-4 lg:flex-row lg:items-start"
          >
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

          <TradeBar
            watchlist={watchlist}
            onFilled={() => {
              void refetchPortfolio();
              void refetchHistory();
            }}
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="lg:w-1/2">
              <PositionsTable
                positions={portfolio?.positions ?? []}
                ticks={ticks}
                loading={portfolioLoading}
                error={portfolioError}
                selectedTicker={selectedTicker}
                onSelect={setSelectedTicker}
              />
            </div>
            <div className="lg:w-1/2">
              <Heatmap
                positions={portfolio?.positions ?? []}
                ticks={ticks}
                loading={portfolioLoading}
                error={portfolioError}
                onSelect={setSelectedTicker}
              />
            </div>
          </div>

          <PnLChart
            snapshots={snapshots}
            currentTotalValue={portfolio?.total_value ?? null}
            loading={historyLoading}
            error={historyError}
          />
        </div>

        <div className="w-full lg:w-96 lg:shrink-0 lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <ChatPanel />
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

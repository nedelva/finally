"use client";

import { useState } from "react";
import { PriceStreamProvider } from "@/context/PriceStreamContext";
import { Header } from "@/components/layout/Header";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { MainChart } from "@/components/chart/MainChart";
import { Heatmap } from "@/components/portfolio/Heatmap";
import { PnlChart } from "@/components/portfolio/PnlChart";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { TradeBar } from "@/components/trade/TradeBar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { usePortfolio, usePortfolioHistory, useWatchlist } from "@/lib/hooks";

function Workstation() {
  const { watchlist, loading: watchlistLoading, error: watchlistError, refetch: refetchWatchlist } =
    useWatchlist();
  const { portfolio, loading: portfolioLoading, refetch: refetchPortfolio } = usePortfolio();
  const { snapshots, loading: historyLoading, refetch: refetchHistory } = usePortfolioHistory();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const effectiveTicker = selectedTicker ?? watchlist[0]?.ticker ?? null;

  function handleTraded() {
    refetchPortfolio();
    refetchHistory();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header portfolio={portfolio} />

      <main className="flex flex-1 gap-3 overflow-hidden p-3">
        <div className="grid flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-2">
          <WatchlistPanel
            watchlist={watchlist}
            loading={watchlistLoading}
            error={watchlistError}
            selectedTicker={effectiveTicker}
            onSelect={setSelectedTicker}
            refetch={refetchWatchlist}
          />
          <MainChart ticker={effectiveTicker} />
          <Heatmap positions={portfolio?.positions ?? []} />
          <PnlChart snapshots={snapshots} loading={historyLoading} />
          <div className="lg:col-span-2">
            <PositionsTable positions={portfolio?.positions ?? []} loading={portfolioLoading} />
          </div>
          <div className="lg:col-span-2">
            <TradeBar defaultTicker={effectiveTicker} onTraded={handleTraded} />
          </div>
        </div>

        <div className={chatCollapsed ? "w-10 shrink-0" : "w-full max-w-sm shrink-0"}>
          <ChatPanel
            collapsed={chatCollapsed}
            onToggleCollapsed={() => setChatCollapsed((c) => !c)}
            onActionsExecuted={() => {
              handleTraded();
              refetchWatchlist();
            }}
          />
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <PriceStreamProvider>
      <Workstation />
    </PriceStreamProvider>
  );
}

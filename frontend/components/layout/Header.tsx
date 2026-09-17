"use client";

import { useMemo } from "react";
import { usePriceStream } from "@/context/PriceStreamContext";
import { formatMoney } from "@/lib/format";
import type { ConnectionStatus, Portfolio } from "@/lib/types";

const STATUS_META: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: "bg-positive", label: "Connected" },
  connecting: { color: "bg-accent-yellow", label: "Connecting" },
  reconnecting: { color: "bg-accent-yellow", label: "Reconnecting" },
  disconnected: { color: "bg-negative", label: "Disconnected" },
};

export function useLiveTotalValue(portfolio: Portfolio | null): number | null {
  const { latest } = usePriceStream();
  return useMemo(() => {
    if (!portfolio) return null;
    const positionsValue = portfolio.positions.reduce((sum, p) => {
      const livePrice = latest[p.ticker]?.price ?? p.current_price;
      return sum + p.quantity * livePrice;
    }, 0);
    return portfolio.cash_balance + positionsValue;
  }, [portfolio, latest]);
}

export function Header({ portfolio }: { portfolio: Portfolio | null }) {
  const { status } = usePriceStream();
  const liveTotal = useLiveTotalValue(portfolio);
  const meta = STATUS_META[status];

  return (
    <header className="flex items-center justify-between gap-6 border-b border-hairline bg-panel px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold tracking-tight text-accent-yellow">FinAlly</span>
        <span className="hidden text-xs text-ink-muted sm:inline">AI Trading Workstation</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Total value</span>
          <span className="tabular text-base font-semibold text-ink-primary">
            {formatMoney(liveTotal)}
          </span>
        </div>
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-[11px] uppercase tracking-wide text-ink-muted">Cash</span>
          <span className="tabular text-base text-ink-secondary">
            {formatMoney(portfolio?.cash_balance ?? null)}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-void px-3 py-1.5">
          <span
            className={`h-2 w-2 rounded-full ${meta.color}`}
            aria-hidden
            data-testid="connection-dot"
          />
          <span className="text-xs text-ink-secondary">{meta.label}</span>
        </div>
      </div>
    </header>
  );
}

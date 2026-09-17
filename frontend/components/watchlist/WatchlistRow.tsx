"use client";

import { useTickerStream } from "@/context/PriceStreamContext";
import { formatPercent, formatPrice } from "@/lib/format";
import { usePriceFlash } from "@/lib/usePriceFlash";
import type { WatchlistEntry } from "@/lib/types";
import { Sparkline } from "./Sparkline";

export function WatchlistRow({
  entry,
  selected,
  onSelect,
  onRemove,
}: {
  entry: WatchlistEntry;
  selected: boolean;
  onSelect: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}) {
  const { tick, history } = useTickerStream(entry.ticker);

  const price = tick?.price ?? entry.price;
  const changePercent = tick?.change_percent ?? entry.change_percent;
  const direction = tick?.direction ?? entry.direction;
  const flashClass = usePriceFlash(price);

  const deltaColor =
    direction === "up" ? "text-positive" : direction === "down" ? "text-negative" : "text-ink-muted";
  const deltaGlyph = direction === "up" ? "▲" : direction === "down" ? "▼" : "–";

  const sparklineValues = history.length >= 2 ? history.map((h) => h.price) : [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry.ticker)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(entry.ticker);
      }}
      data-testid={`watchlist-row-${entry.ticker}`}
      className={`group flex cursor-pointer items-center gap-3 border-b border-hairline px-3 py-2 transition-colors hover:bg-panel-raised/40 ${
        selected ? "bg-panel-raised/70" : ""
      }`}
    >
      <div className="w-16 shrink-0">
        <span className="font-mono text-sm font-semibold text-ink-primary">{entry.ticker}</span>
      </div>

      <div className={`w-20 shrink-0 rounded px-1.5 py-0.5 tabular text-sm ${flashClass}`}>
        {formatPrice(price)}
      </div>

      <div className={`flex w-20 shrink-0 items-center gap-1 tabular text-xs ${deltaColor}`}>
        <span aria-hidden>{deltaGlyph}</span>
        <span>{formatPercent(changePercent, { sign: true })}</span>
      </div>

      <div className="flex-1">
        <Sparkline values={sparklineValues} />
      </div>

      <button
        type="button"
        aria-label={`Remove ${entry.ticker} from watchlist`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.ticker);
        }}
        className="shrink-0 rounded px-1.5 py-1 text-ink-muted opacity-0 transition-opacity hover:text-negative group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

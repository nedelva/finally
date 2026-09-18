"use client";

// One ticker row in the watchlist grid. Pure function of its props — the
// container (Watchlist.tsx) reads the shared stream context once and passes
// each ticker's tick/history down, so this component never opens a stream
// connection of its own and stays directly testable without a provider.

import type { KeyboardEvent } from "react";
import type { PriceTick } from "@/lib/types";
import type { PricePoint } from "@/lib/usePriceStream";
import { usePriceFlash } from "@/lib/usePriceFlash";
import { formatPercent, formatPrice } from "@/lib/format";
import { Sparkline } from "./Sparkline";

export interface WatchlistRowProps {
  ticker: string;
  tick?: PriceTick;
  /** Sparkline data source — the hook already caps this at PRICE_HISTORY_LIMIT; no second cap here. */
  history?: PricePoint[];
  /** Called with this row's ticker on click or Enter/Space keyboard activation (MKT-04). */
  onSelect?: (ticker: string) => void;
  /** Whether this row is the currently selected ticker in the main chart. */
  selected?: boolean;
}

/**
 * Resolves the session-change percentage cell's colour token. Independent of
 * the price flash: the flash reflects the last tick's direction, this
 * reflects the session-to-date sign (plan 01-03 re-anchored those two
 * baselines on purpose — a row can flash red while showing a green percent).
 */
function changeColorClass(changePercent: number | null | undefined): string {
  if (changePercent === null || changePercent === undefined || Number.isNaN(changePercent)) {
    return "text-gray-500";
  }
  if (changePercent > 0) return "text-[var(--color-up)]";
  if (changePercent < 0) return "text-[var(--color-down)]";
  return "text-gray-400";
}

export function WatchlistRow({
  ticker,
  tick,
  history = [],
  onSelect,
  selected = false,
}: WatchlistRowProps) {
  const flashClass = usePriceFlash(tick?.price);

  const select = () => onSelect?.(ticker);

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select();
    }
  };

  return (
    <tr
      data-testid={`row-${ticker}`}
      tabIndex={0}
      aria-selected={selected}
      onClick={select}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer border-b border-[var(--color-border)]/60 last:border-b-0 focus:outline-none ${
        selected ? "bg-[var(--color-border)]/40" : ""
      }`}
    >
      <td className="py-1.5 pl-3 pr-4 font-medium text-gray-200">{ticker}</td>
      <td
        data-testid={`price-${ticker}`}
        className={`py-1.5 pr-4 tabular-nums text-gray-100 ${flashClass}`}
      >
        {formatPrice(tick?.price)}
      </td>
      <td
        data-testid={`change-${ticker}`}
        className={`py-1.5 pr-4 tabular-nums ${changeColorClass(tick?.change_percent)}`}
      >
        {formatPercent(tick?.change_percent, { sign: true })}
      </td>
      <td data-testid={`sparkline-${ticker}`} className="py-1.5 pr-3">
        <Sparkline data={history} width={80} height={24} />
      </td>
    </tr>
  );
}

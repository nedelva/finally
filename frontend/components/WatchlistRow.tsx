"use client";

// One ticker row in the watchlist grid. Pure function of its props — the
// container (Watchlist.tsx) reads the shared stream context once and passes
// each ticker's tick/history down, so this component never opens a stream
// connection of its own and stays directly testable without a provider.

import type { PriceTick } from "@/lib/types";
import type { PricePoint } from "@/lib/usePriceStream";
import { usePriceFlash } from "@/lib/usePriceFlash";
import { formatPercent, formatPrice } from "@/lib/format";

export interface WatchlistRowProps {
  ticker: string;
  tick?: PriceTick;
  /** Sparkline data source — accepted here, rendered by the Sparkline cell added in plan 01-04 Task 2. */
  history?: PricePoint[];
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

export function WatchlistRow({ ticker, tick }: WatchlistRowProps) {
  const flashClass = usePriceFlash(tick?.price);

  return (
    <tr className="border-b border-[var(--color-border)]/60 last:border-b-0">
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
    </tr>
  );
}

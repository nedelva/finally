"use client";

// Minimal RED-phase stub — deliberately incomplete so the test suite loads
// and fails on real behavioural assertions instead of a module-resolution
// error (INVALID_RED per this project's TDD convention). GREEN replaces the
// body with the real flash + formatter wiring described in the plan.

import type { PriceTick } from "@/lib/types";
import type { PricePoint } from "@/lib/usePriceStream";

export interface WatchlistRowProps {
  ticker: string;
  tick?: PriceTick;
  history?: PricePoint[];
}

export function WatchlistRow({ ticker }: WatchlistRowProps) {
  return (
    <tr>
      <td>{ticker}</td>
    </tr>
  );
}

"use client";

// Minimal RED-phase stub — intentionally does not yet implement the
// selection/no-selection/empty-history states or the axes/tooltip. Task 2
// GREEN fills this in.

import type { PriceTick } from "@/lib/types";
import type { PricePoint } from "@/lib/usePriceStream";

export interface MainChartProps {
  selectedTicker?: string;
  history: PricePoint[];
  tick?: PriceTick;
  width?: number;
  height?: number;
}

export function MainChart({ selectedTicker }: MainChartProps) {
  return <div>{selectedTicker ?? "none"}</div>;
}

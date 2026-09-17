"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus, PriceStreamEvent } from "./types";

/**
 * Number of history points retained per ticker. At the simulator's ~500ms
 * cadence this is roughly a minute of history — enough to fill a sparkline
 * and the main chart without unbounded growth over a long session.
 */
export const PRICE_HISTORY_LIMIT = 120;

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface PriceStreamState {
  ticks: PriceStreamEvent;
  history: Record<string, PricePoint[]>;
  tickers: string[];
  status: ConnectionStatus;
}

// STUB — RED phase only. Deliberately does not construct an EventSource or
// process any messages yet; exists so the test file can import a
// correctly-shaped module and fail on real assertions in the next cycle.
export function usePriceStream(url: string = "/api/stream/prices"): PriceStreamState {
  void url;
  const [state] = useState<PriceStreamState>({
    ticks: {},
    history: {},
    tickers: [],
    status: "connecting",
  });

  useEffect(() => {
    // Intentionally does nothing yet.
  }, [url]);

  return state;
}

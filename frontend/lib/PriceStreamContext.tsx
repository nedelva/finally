"use client";

// A single EventSource carries every ticker in one SSE payload
// (stream.py:81), so the whole app must share exactly one connection.
// This context calls usePriceStream() exactly once and distributes the
// result to every subscriber below it — no component may construct its own
// stream connection. Ten row-level connections would deliver ten duplicate
// copies of the same event and burn same-origin connection budget.

import { createContext, useContext, type ReactNode } from "react";
import { usePriceStream, type PriceStreamState } from "./usePriceStream";

const PriceStreamContext = createContext<PriceStreamState | null>(null);

export function PriceStreamProvider({ children }: { children: ReactNode }) {
  const stream = usePriceStream();
  return <PriceStreamContext.Provider value={stream}>{children}</PriceStreamContext.Provider>;
}

export function usePriceStreamContext(): PriceStreamState {
  const value = useContext(PriceStreamContext);
  if (value === null) {
    throw new Error("usePriceStreamContext must be used within a PriceStreamProvider");
  }
  return value;
}

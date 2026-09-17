"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ConnectionStatus, PriceStreamEvent, PriceTick } from "@/lib/types";

const HISTORY_CAP = 100;

export interface PriceStreamState {
  /** Connection status for the header dot: green/yellow/red. */
  status: ConnectionStatus;
  /** Latest tick per ticker (undefined until the first event mentioning it). */
  latest: Record<string, PriceTick>;
  /** Ring buffer of recent ticks per ticker, oldest first, capped at 100 —
   * this IS the sparkline/chart data source; there is no historical-intraday
   * endpoint, so charts only ever show what has streamed since page load. */
  history: Record<string, PriceTick[]>;
}

const EMPTY_STATE: PriceStreamState = { status: "connecting", latest: {}, history: {} };

const PriceStreamContext = createContext<PriceStreamState>(EMPTY_STATE);

export function usePriceStream(): PriceStreamState {
  return useContext(PriceStreamContext);
}

/** Convenience selector for a single ticker's tick + history. */
export function useTickerStream(ticker: string | null | undefined) {
  const { latest, history, status } = usePriceStream();
  return useMemo(
    () => ({
      tick: ticker ? latest[ticker] : undefined,
      history: ticker ? history[ticker] ?? [] : [],
      status,
    }),
    [ticker, latest, history, status],
  );
}

export function PriceStreamProvider({
  children,
  value,
  url = "/api/stream/prices",
}: {
  children: React.ReactNode;
  /** Injected state for tests/storybook — when provided, no EventSource is
   * created and this value is rendered as-is (static). */
  value?: PriceStreamState;
  url?: string;
}) {
  const [liveState, setState] = useState<PriceStreamState>(EMPTY_STATE);
  const historyRef = useRef<Record<string, PriceTick[]>>({});

  // When `value` is supplied (tests/storybook), it wins outright and is
  // read directly on every render — no internal state indirection — so a
  // parent re-rendering with a new `value` is reflected immediately instead
  // of lagging behind a stale useState initializer.
  const state = value ?? liveState;

  useEffect(() => {
    if (value) return; // test/mock mode — skip real connection entirely
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return;

    const source = new EventSource(url);

    source.onopen = () => {
      setState((prev) => ({ ...prev, status: "connected" }));
    };

    source.onmessage = (event: MessageEvent<string>) => {
      let parsed: PriceStreamEvent;
      try {
        parsed = JSON.parse(event.data) as PriceStreamEvent;
      } catch {
        return;
      }

      const nextHistory = historyRef.current;
      for (const [ticker, tick] of Object.entries(parsed)) {
        const existing = nextHistory[ticker] ?? [];
        const appended = [...existing, tick];
        nextHistory[ticker] =
          appended.length > HISTORY_CAP ? appended.slice(appended.length - HISTORY_CAP) : appended;
      }
      historyRef.current = { ...nextHistory };

      setState((prev) => ({
        status: "connected",
        latest: { ...prev.latest, ...parsed },
        history: historyRef.current,
      }));
    };

    source.onerror = () => {
      // EventSource retries natively (server sends `retry: 1000`). Its
      // readyState tells us whether it's mid-reconnect or has given up.
      setState((prev) => ({
        ...prev,
        status: source.readyState === EventSource.CONNECTING ? "reconnecting" : "disconnected",
      }));
    };

    return () => {
      source.close();
    };
  }, [url, value]);

  return <PriceStreamContext.Provider value={state}>{children}</PriceStreamContext.Provider>;
}

"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * Owns the single, shared EventSource for the whole app. One SSE event
 * carries every ticker in one payload (stream.py:81), so this hook holds
 * exactly one connection — no component may construct its own.
 *
 * Mirrors usePortfolio's mount/cleanup/mountedRef shape (hooks.ts), swapping
 * setInterval+fetch for an EventSource whose onopen/onerror/onmessage drive
 * connection status and the latest-tick/history state. Native EventSource
 * already retries on its own using the server's `retry: 1000` directive
 * (stream.py:62) — this hook only tracks readyState/onopen/onerror, it never
 * hand-rolls a backoff loop.
 */
export function usePriceStream(url: string = "/api/stream/prices"): PriceStreamState {
  const [ticks, setTicks] = useState<PriceStreamEvent>({});
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({});
  const [tickers, setTickers] = useState<string[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setStatus("connecting");

    const source = new EventSource(url);

    source.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");
    };

    source.onerror = () => {
      if (!mountedRef.current) return;
      setStatus(source.readyState === EventSource.CONNECTING ? "reconnecting" : "disconnected");
    };

    source.onmessage = (event: MessageEvent<string>) => {
      if (!mountedRef.current) return;

      let parsed: PriceStreamEvent;
      try {
        parsed = JSON.parse(event.data) as PriceStreamEvent;
      } catch {
        // Malformed payload — leave existing state intact rather than throw.
        return;
      }

      setTicks((prev) => ({ ...prev, ...parsed }));

      setHistory((prev) => {
        const next = { ...prev };
        for (const [ticker, priceTick] of Object.entries(parsed)) {
          const existing = next[ticker] ?? [];
          // Append unconditionally — an unchanged price is real information
          // for a chart, and low-volatility tickers legitimately repeat.
          const appended = [
            ...existing,
            { timestamp: priceTick.timestamp, price: priceTick.price },
          ];
          next[ticker] =
            appended.length > PRICE_HISTORY_LIMIT
              ? appended.slice(appended.length - PRICE_HISTORY_LIMIT)
              : appended;
        }
        return next;
      });

      setTickers((prev) => {
        const merged = new Set(prev);
        for (const ticker of Object.keys(parsed)) merged.add(ticker);
        return Array.from(merged).sort();
      });
    };

    return () => {
      mountedRef.current = false;
      source.close();
    };
  }, [url]);

  return { ticks, history, tickers, status };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getChatHistory, getPortfolio, getPortfolioHistory, getWatchlist } from "./api";
import { deriveLivePosition } from "./positionMath";
import type {
  ChatHistoryEntry,
  Portfolio,
  PortfolioSnapshot,
  PriceStreamEvent,
  WatchlistEntry,
} from "./types";

/**
 * Fetches `GET /api/portfolio` on mount, after every trade (via `refetch`),
 * and on a slow reconcile interval — the header/positions table otherwise
 * derive their *live* value from the SSE stream client-side (see
 * `useLiveTotalValue`), this hook just keeps the authoritative base in sync.
 */
export function usePortfolio(pollMs = 20000) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getPortfolio();
    if (!mountedRef.current) return;
    if (res.ok) {
      setPortfolio(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Fetch-on-mount + poll: refetch's setState calls run after its
    // `await`, i.e. in a later microtask, not synchronously during this
    // effect — the standard "subscribe to an external resource" shape the
    // rule intends to allow, not the synchronous case it flags.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    const interval = setInterval(() => void refetch(), pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refetch, pollMs]);

  return { portfolio, loading, error, refetch };
}

/**
 * Pure derivation over props, not a fetching hook — holds no state and runs
 * no effect. Routes every position through `deriveLivePosition` (rather than
 * recomputing `quantity * price` inline) so this total always agrees with the
 * positions table, and so a position with no live tick falls back to the
 * server's own `market_value` (D-03) instead of to zero.
 */
export function useLiveTotalValue(
  portfolio: Portfolio | null,
  ticks: PriceStreamEvent,
): number | null {
  if (!portfolio) return null;
  let total = portfolio.cash_balance;
  for (const position of portfolio.positions) {
    const livePrice = ticks[position.ticker]?.price;
    total += deriveLivePosition(position, livePrice).marketValue;
  }
  return total;
}

export function usePortfolioHistory(pollMs = 30000) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getPortfolioHistory();
    if (!mountedRef.current) return;
    if (res.ok) {
      setSnapshots(res.data.snapshots);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // See usePortfolio above: setState happens after refetch's `await`, not
    // synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    const interval = setInterval(() => void refetch(), pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refetch, pollMs]);

  return { snapshots, loading, error, refetch };
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getWatchlist();
    if (!mountedRef.current) return;
    if (res.ok) {
      setWatchlist(res.data.watchlist);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // See usePortfolio above: setState happens after refetch's `await`, not
    // synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { watchlist, loading, error, refetch };
}

/**
 * Fetches `GET /api/chat/history` once on mount, with no poll interval —
 * unlike `usePortfolio`/`usePortfolioHistory`, chat history is read once and
 * then grows only through `POST /api/chat` responses handled locally by
 * `ChatPanel`, matching `useWatchlist`'s fetch-on-mount shape exactly.
 */
export function useChatHistory() {
  const [entries, setEntries] = useState<ChatHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getChatHistory();
    if (!mountedRef.current) return;
    if (res.ok) {
      setEntries(res.data.messages);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // See usePortfolio above: setState happens after refetch's `await`, not
    // synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { entries, loading, error, refetch };
}

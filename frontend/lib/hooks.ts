"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPortfolio, getPortfolioHistory, getWatchlist } from "./api";
import type { Portfolio, PortfolioSnapshot, WatchlistEntry } from "./types";

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

export function usePortfolioHistory(pollMs = 30000) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const res = await getPortfolioHistory();
    if (!mountedRef.current) return;
    if (res.ok) setSnapshots(res.data.snapshots);
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

  return { snapshots, loading, refetch };
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

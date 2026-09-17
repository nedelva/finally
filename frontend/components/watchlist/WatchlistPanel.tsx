"use client";

import { useState } from "react";
import { addWatchlistTicker, removeWatchlistTicker } from "@/lib/api";
import type { WatchlistEntry } from "@/lib/types";
import { WatchlistRow } from "./WatchlistRow";

export function WatchlistPanel({
  watchlist,
  loading,
  error,
  selectedTicker,
  onSelect,
  refetch,
}: {
  watchlist: WatchlistEntry[];
  loading: boolean;
  error: string | null;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
  refetch: () => void;
}) {
  const [newTicker, setNewTicker] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    setPending(true);
    setFormError(null);
    const res = await addWatchlistTicker(ticker);
    setPending(false);
    if (res.ok) {
      setNewTicker("");
      refetch();
    } else {
      setFormError(res.error);
    }
  }

  async function handleRemove(ticker: string) {
    const res = await removeWatchlistTicker(ticker);
    if (res.ok) {
      refetch();
    } else {
      setFormError(res.error);
    }
  }

  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-panel" aria-label="Watchlist">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Watchlist</h2>
        <form onSubmit={handleAdd} className="flex items-center gap-1.5">
          <input
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            placeholder="Add ticker"
            aria-label="Add ticker to watchlist"
            className="w-24 rounded border border-hairline bg-void px-2 py-1 text-xs uppercase text-ink-primary placeholder:text-ink-muted focus:border-accent-blue focus:outline-none"
            maxLength={10}
          />
          <button
            type="submit"
            disabled={pending || !newTicker.trim()}
            className="rounded bg-accent-blue px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            +
          </button>
        </form>
      </div>

      {formError && (
        <div role="alert" className="border-b border-hairline bg-negative-dim px-3 py-1.5 text-xs text-negative">
          {formError}
        </div>
      )}

      {loading && watchlist.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-ink-muted">Loading watchlist…</div>
      )}
      {error && watchlist.length === 0 && !loading && (
        <div className="px-3 py-6 text-center text-xs text-negative">{error}</div>
      )}
      {!loading && !error && watchlist.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-ink-muted">No tickers yet — add one above.</div>
      )}

      <div className="max-h-[420px] overflow-y-auto">
        {watchlist.map((entry) => (
          <WatchlistRow
            key={entry.ticker}
            entry={entry}
            selected={entry.ticker === selectedTicker}
            onSelect={onSelect}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </section>
  );
}

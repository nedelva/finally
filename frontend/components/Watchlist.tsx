"use client";

// The watchlist grid container. Reads the single shared stream context
// exactly once (per PLAN.md's "one EventSource for the whole app"
// constraint) and distributes each ticker's tick/history down to a pure
// WatchlistRow — no row ever opens its own connection. Row *membership*
// comes from the REST-backed useWatchlist() hook, not from the stream's
// ever-growing ticker set (which has no removal branch and is structurally
// incapable of shrinking).
//
// The panel border/background classes live on this file's wrapper <div>
// (introduced in 02-02) rather than directly on <table>, because a <form>
// is not valid HTML as a child of <table> before <thead> — the add-ticker
// form row and the table are now siblings inside the same bordered panel.

import { type FormEvent, useState } from "react";
import { addWatchlistTicker, removeWatchlistTicker } from "@/lib/api";
import { usePriceStreamContext } from "@/lib/PriceStreamContext";
import { useWatchlist } from "@/lib/hooks";
import { WatchlistRow } from "./WatchlistRow";

export interface WatchlistProps {
  /** Currently selected ticker, driving the main chart (MKT-04). Owned by page.tsx. */
  selectedTicker?: string;
  /** Called with a row's ticker on click or keyboard activation. */
  onSelect?: (ticker: string) => void;
}

export function Watchlist({ selectedTicker, onSelect }: WatchlistProps) {
  const { ticks, history } = usePriceStreamContext();
  // `error` is renamed to `loadError` so it cannot collide with this
  // component's own local `error`/`setError` state below, which drives the
  // independent add/remove-form error slot (watchlist-add-error).
  const { watchlist, loading, error: loadError, refetch } = useWatchlist();

  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = inputValue.trim();
    if (trimmed === "") {
      setError("Enter a ticker symbol to add it.");
      return;
    }

    setSubmitting(true);
    setError("");
    const result = await addWatchlistTicker(inputValue);
    if (result.ok) {
      setInputValue("");
      setError("");
      refetch();
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  }

  // The UI-SPEC leaves the failed-DELETE treatment undesigned (backstop
  // item). Reusing the existing add-ticker error slot rather than inventing
  // a second error-rendering mechanism keeps this minimal and consistent.
  async function handleRemove(ticker: string) {
    const result = await removeWatchlistTicker(ticker);
    if (result.ok) {
      setError("");
      refetch();
    } else {
      setError(result.error);
    }
  }

  // Extracted so the loading and populated branches render the identical
  // header markup — keeping the table shell (border, header, panel width)
  // on screen from first paint is what prevents the layout jump G-02-1's
  // truth explicitly forbids.
  const tableHead = (
    <thead>
      <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-gray-500">
        <th className="py-2 pl-3 pr-4 font-medium">Symbol</th>
        <th className="py-2 pr-4 font-medium">Price</th>
        <th className="py-2 pr-4 font-medium">Chg %</th>
        <th className="py-2 pr-4 font-medium">Chart</th>
        <th className="py-2 pr-3 font-medium"></th>
      </tr>
    </thead>
  );

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]">
      <form
        data-testid="watchlist-add-form"
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-b border-[var(--color-border)] p-4"
      >
        <input
          data-testid="watchlist-add-input"
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={submitting}
          placeholder="Add ticker (e.g. PYPL)"
          className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-blue)] disabled:opacity-50"
        />
        <button
          type="submit"
          data-testid="watchlist-add-submit"
          disabled={submitting}
          className="rounded bg-[var(--color-secondary-purple)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add Ticker"}
        </button>
      </form>
      <p
        data-testid="watchlist-add-error"
        className="px-4 text-sm text-[var(--color-down)] empty:hidden"
      >
        {error}
      </p>
      <div data-testid="watchlist-scroll-container" className="lg:max-h-[440px] overflow-y-auto">
        {loading ? (
          <table className="w-full border-collapse text-sm">
            {tableHead}
            <tbody>
              <tr>
                <td
                  colSpan={5}
                  data-testid="watchlist-loading"
                  className="py-6 text-center text-sm text-gray-500"
                >
                  Loading watchlist…
                </td>
              </tr>
            </tbody>
          </table>
        ) : loadError ? (
          <div
            data-testid="watchlist-load-error"
            className="px-4 py-6 text-center text-sm text-[var(--color-down)]"
          >
            {loadError}
          </div>
        ) : watchlist.length === 0 ? (
          <div data-testid="watchlist-empty" className="px-4 py-6 text-center text-sm text-gray-500">
            <h2 className="mb-1 font-medium text-gray-300">Watchlist is empty</h2>
            <p>Add a ticker above to start streaming its price.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            {tableHead}
            <tbody>
              {watchlist.map((entry) => (
                <WatchlistRow
                  key={entry.ticker}
                  ticker={entry.ticker}
                  tick={ticks[entry.ticker]}
                  history={history[entry.ticker]}
                  selected={entry.ticker === selectedTicker}
                  onSelect={onSelect}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

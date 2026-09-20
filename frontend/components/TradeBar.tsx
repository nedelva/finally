"use client";

// The trade bar: a ticker dropdown (D-02 — never free text, so an
// unwatchable ticker is unreachable from the UI), a fractional-quantity
// input (D-05), and instant Buy/Sell submit — no modal, no confirmation
// step anywhere in this flow (PLAN.md §2). Mirrors Watchlist.tsx's
// add-ticker form state shape (submitting/error) with two additions this
// form needs: a per-side submitting flag (so only the pressed button
// relabels) and a transient fading confirmation message (D-07).

import { useEffect, useState } from "react";
import { postTrade } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { TradeSide, WatchlistEntry } from "@/lib/types";

export interface TradeBarProps {
  watchlist: WatchlistEntry[];
  disabled?: boolean;
  onFilled: () => void;
}

const CONFIRMATION_FADE_MS = 2500;

export function TradeBar({ watchlist, disabled = false, onFilled }: TradeBarProps) {
  const [ticker, setTicker] = useState(watchlist[0]?.ticker ?? "");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState<TradeSide | "">("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  // Keep the selection valid as the watchlist prop changes (ticker removed,
  // or a fresh empty->populated transition) — same "always point at a real
  // entry" contract Terminal's own selection-guard effect follows.
  useEffect(() => {
    const stillValid = watchlist.some((entry) => entry.ticker === ticker);
    if (!stillValid) {
      setTicker(watchlist[0]?.ticker ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // Timer is cleared on unmount so a fill that outlives the component never
  // sets state on a dead instance, mirroring usePriceFlash's cleanup idiom.
  useEffect(() => {
    if (confirmation === "") return;
    const timer = setTimeout(() => setConfirmation(""), CONFIRMATION_FADE_MS);
    return () => clearTimeout(timer);
  }, [confirmation]);

  const parsedQuantity = Number.parseFloat(quantity);
  const quantityIsPositive = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
  const watchlistEmpty = watchlist.length === 0;
  const controlsDisabled = disabled || watchlistEmpty;
  const buttonsDisabled = controlsDisabled || submitting !== "" || !quantityIsPositive;

  async function submit(side: TradeSide) {
    if (!quantityIsPositive) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    setSubmitting(side);
    setError("");
    setConfirmation("");

    const result = await postTrade({ ticker, side, quantity: parsedQuantity });

    if (result.ok && result.data.success) {
      const filledQuantity = parsedQuantity;
      const filledTicker = ticker;
      const filledPrice = result.data.trade.price;
      setQuantity("");
      setTicker(watchlist[0]?.ticker ?? "");
      setConfirmation(
        `${side === "buy" ? "Bought" : "Sold"} ${filledQuantity} ${filledTicker} @ ` +
          `${formatMoney(filledPrice)}`,
      );
      onFilled();
    } else if (result.ok && !result.data.success) {
      setError(result.data.error);
    } else if (!result.ok) {
      setError(result.error);
    }

    setSubmitting("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <select
        data-testid="trade-bar-ticker"
        value={ticker}
        onChange={(event) => setTicker(event.target.value)}
        disabled={controlsDisabled}
        className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-blue)] disabled:opacity-50"
      >
        {watchlist.map((entry) => (
          <option key={entry.ticker} value={entry.ticker}>
            {entry.ticker}
          </option>
        ))}
      </select>
      <input
        data-testid="trade-bar-quantity"
        type="number"
        step="any"
        min="0"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        disabled={controlsDisabled}
        placeholder="Quantity"
        className="w-28 rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-blue)] disabled:opacity-50"
      />
      <button
        type="button"
        data-testid="trade-bar-buy"
        onClick={() => submit("buy")}
        disabled={buttonsDisabled}
        className="rounded bg-[var(--color-up)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting === "buy" ? "Buying..." : "Buy"}
      </button>
      <button
        type="button"
        data-testid="trade-bar-sell"
        onClick={() => submit("sell")}
        disabled={buttonsDisabled}
        className="rounded bg-[var(--color-down)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting === "sell" ? "Selling..." : "Sell"}
      </button>
      {watchlistEmpty ? (
        <p data-testid="trade-bar-hint" className="text-sm text-gray-500">
          Add a ticker to your watchlist to start trading.
        </p>
      ) : (
        <p
          data-testid="trade-bar-error"
          className="text-sm text-[var(--color-down)] empty:hidden"
        >
          {error}
        </p>
      )}
      <p
        data-testid="trade-bar-confirmation"
        className="text-sm text-[var(--color-up)] transition-opacity duration-500 empty:hidden"
      >
        {confirmation}
      </p>
    </div>
  );
}

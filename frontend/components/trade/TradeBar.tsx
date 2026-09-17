"use client";

import { useEffect, useRef, useState } from "react";
import { postTrade } from "@/lib/api";
import { formatMoney, formatQuantity } from "@/lib/format";
import type { TradeSide } from "@/lib/types";

export function TradeBar({
  defaultTicker,
  onTraded,
}: {
  defaultTicker: string | null;
  onTraded: () => void;
}) {
  const [ticker, setTicker] = useState(defaultTicker ?? "");
  const [quantity, setQuantity] = useState("1");
  const [pending, setPending] = useState<TradeSide | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seed the ticker field when the selected watchlist ticker changes,
  // without fighting the user's own edits: adjusted during render (React's
  // documented pattern for "resetting state when a prop changes") rather
  // than in an effect, so it happens in the same commit as the prop change.
  const [trackedDefault, setTrackedDefault] = useState(defaultTicker);
  if (defaultTicker !== trackedDefault) {
    setTrackedDefault(defaultTicker);
    if (defaultTicker) setTicker(defaultTicker);
  }

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function showFeedback(kind: "success" | "error", text: string) {
    setFeedback({ kind, text });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFeedback(null), 4000);
  }

  async function handleTrade(side: TradeSide) {
    const qty = Number(quantity);
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      showFeedback("error", "Enter a ticker.");
      return;
    }
    if (!(qty > 0)) {
      showFeedback("error", "Quantity must be a positive number.");
      return;
    }

    setPending(side);
    const res = await postTrade({ ticker: normalizedTicker, side, quantity: qty });
    setPending(null);

    if (!res.ok) {
      showFeedback("error", res.error);
      return;
    }
    if (!res.data.success) {
      showFeedback("error", res.data.error);
      return;
    }

    const { trade } = res.data;
    showFeedback(
      "success",
      `${trade.side === "buy" ? "Bought" : "Sold"} ${formatQuantity(trade.quantity)} ${trade.ticker} @ ${formatMoney(trade.price)}`,
    );
    onTraded();
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-hairline bg-panel p-4" aria-label="Trade">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Trade</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Ticker"
          aria-label="Trade ticker"
          className="w-24 rounded border border-hairline bg-void px-2 py-1.5 text-sm uppercase text-ink-primary placeholder:text-ink-muted focus:border-accent-blue focus:outline-none"
          maxLength={10}
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
          aria-label="Trade quantity"
          type="number"
          min="0"
          step="any"
          className="tabular w-24 rounded border border-hairline bg-void px-2 py-1.5 text-sm text-ink-primary placeholder:text-ink-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          type="button"
          onClick={() => handleTrade("buy")}
          disabled={pending !== null}
          className="rounded bg-accent-blue px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending === "buy" ? "Buying…" : "Buy"}
        </button>
        <button
          type="button"
          onClick={() => handleTrade("sell")}
          disabled={pending !== null}
          className="rounded border border-negative px-4 py-1.5 text-sm font-semibold text-negative transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending === "sell" ? "Selling…" : "Sell"}
        </button>
      </div>
      {feedback && (
        <div
          role="status"
          className={`rounded px-2 py-1.5 text-xs ${
            feedback.kind === "success" ? "bg-positive-dim text-positive" : "bg-negative-dim text-negative"
          }`}
        >
          {feedback.text}
        </div>
      )}
    </section>
  );
}

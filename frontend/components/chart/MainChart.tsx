"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTickerStream } from "@/context/PriceStreamContext";
import { formatClock, formatPrice } from "@/lib/format";

export function MainChart({ ticker }: { ticker: string | null }) {
  const { tick, history } = useTickerStream(ticker);

  const data = useMemo(
    () => history.map((h) => ({ t: h.timestamp, price: h.price })),
    [history],
  );

  const changePositive = (tick?.change ?? 0) >= 0;

  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-panel p-4" aria-label="Price chart">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="font-mono text-lg font-semibold text-ink-primary">{ticker ?? "—"}</h2>
          {tick && (
            <div className="flex items-baseline gap-2">
              <span className="tabular text-2xl font-semibold text-ink-primary">
                {formatPrice(tick.price)}
              </span>
              <span className={`tabular text-sm ${changePositive ? "text-positive" : "text-negative"}`}>
                {changePositive ? "+" : ""}
                {formatPrice(tick.change)} ({changePositive ? "+" : ""}
                {tick.change_percent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <span className="text-[11px] text-ink-muted">Live since page load</span>
      </div>

      <div className="h-64 w-full">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            {ticker ? "Waiting for price data…" : "Select a ticker from the watchlist"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(v: number) => formatClock(v)}
                stroke="var(--color-ink-muted)"
                tick={{ fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                dataKey="price"
                domain={["auto", "auto"]}
                stroke="var(--color-ink-muted)"
                tick={{ fontSize: 11 }}
                width={64}
                tickFormatter={(v: number) => formatPrice(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-panel-raised)",
                  border: "1px solid var(--color-hairline-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatClock(Number(v))}
                formatter={(value) => [formatPrice(Number(value)), "Price"] as [string, string]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--color-accent-blue)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

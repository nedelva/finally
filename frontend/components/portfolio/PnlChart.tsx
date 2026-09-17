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
import { formatClock, formatMoney } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/types";

export function PnlChart({ snapshots, loading }: { snapshots: PortfolioSnapshot[]; loading: boolean }) {
  const data = useMemo(
    () =>
      snapshots.map((s) => ({
        t: new Date(s.recorded_at).getTime(),
        value: s.total_value,
      })),
    [snapshots],
  );

  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-panel p-4" aria-label="Portfolio value over time">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Portfolio value
      </h2>
      <div className="h-48 w-full">
        {data.length < 2 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            {loading ? "Loading history…" : "Not enough history yet"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(v: number) => formatClock(v / 1000)}
                stroke="var(--color-ink-muted)"
                tick={{ fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                dataKey="value"
                domain={["auto", "auto"]}
                stroke="var(--color-ink-muted)"
                tick={{ fontSize: 11 }}
                width={72}
                tickFormatter={(v: number) => formatMoney(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-panel-raised)",
                  border: "1px solid var(--color-hairline-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatClock(Number(v) / 1000)}
                formatter={(value) => [formatMoney(Number(value)), "Total value"] as [string, string]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-accent-yellow)"
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

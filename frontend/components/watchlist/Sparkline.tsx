"use client";

import { useMemo } from "react";

/**
 * Minimal inline SVG sparkline. Deliberately not a recharts component: this
 * renders once per watchlist row on every SSE tick, so a hand-rolled path
 * keeps the row grid cheap. Colored by net trend over the visible window
 * (positive/negative/neutral), consistent with the price-flash convention.
 */
export function Sparkline({
  values,
  width = 72,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { path, trend } = useMemo(() => {
    if (values.length < 2) return { path: "", trend: "neutral" as const };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const first = values[0];
    const last = values[values.length - 1];
    const trend = last > first ? "positive" : last < first ? "negative" : "neutral";
    return { path: `M${points.join(" L")}`, trend: trend as "positive" | "negative" | "neutral" };
  }, [values, width, height]);

  if (!path) {
    return (
      <svg width={width} height={height} aria-hidden className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth={1} />
      </svg>
    );
  }

  const stroke =
    trend === "positive" ? "var(--color-positive)" : trend === "negative" ? "var(--color-negative)" : "var(--color-neutral)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden role="presentation">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

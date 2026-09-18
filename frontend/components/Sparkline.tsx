"use client";

// Axis-free Recharts line chart sized for an inline table cell. Recharts
// (already resolved at 3.10.1 — RESEARCH.md's "Don't Hand-Roll" table)
// handles scaling/resizing; a hand-rolled canvas/SVG polyline would
// duplicate that for no benefit at ten tickers.

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { PricePoint } from "@/lib/usePriceStream";

export interface SparklineProps {
  data: PricePoint[];
  width?: number;
  height?: number;
}

/** Default inline-cell footprint when no explicit width/height is supplied. */
const CELL_WIDTH = 80;
const CELL_HEIGHT = 24;

function priceLine() {
  return (
    <Line
      type="monotone"
      dataKey="price"
      stroke="#209dd7"
      strokeWidth={1.5}
      dot={false}
      isAnimationActive={false}
    />
  );
}

// Without an explicit YAxis, Recharts defaults the domain to [0, dataMax] —
// for a ~$150-250 stock with cent-level ticks, that pins nearly the entire
// chart height below the visible line, making it look flat. `hide` keeps the
// axis invisible (no ticks/labels — this stays an axis-free glance chart)
// while `domain={['dataMin', 'dataMax']}` makes the scale follow the actual
// price range, matching the non-zero-anchored domain MainChart.tsx already
// uses for the same reason.
function priceYAxis() {
  return <YAxis hide domain={["dataMin", "dataMax"]} />;
}

export function Sparkline({ data, width, height }: SparklineProps) {
  // Zero points is real and frequent — every row starts here on page load —
  // so this is guarded explicitly rather than asking Recharts to draw a
  // line from nothing. Returning an empty-but-present, correctly sized box
  // keeps the table's column widths stable.
  if (data.length === 0) {
    return (
      <div
        data-testid="sparkline-empty"
        style={{ width: width ?? CELL_WIDTH, height: height ?? CELL_HEIGHT }}
      />
    );
  }

  // Explicit dimensions render the chart directly rather than depending on
  // a measured container — jsdom reports a zero-sized container, so a
  // responsive-only render would emit nothing and the test coverage would
  // be vacuous.
  if (width !== undefined && height !== undefined) {
    return (
      <LineChart width={width} height={height} data={data}>
        {priceYAxis()}
        {priceLine()}
      </LineChart>
    );
  }

  return (
    <div style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          {priceYAxis()}
          {priceLine()}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

// Larger Recharts line chart for the currently selected ticker (MKT-04).
// Deliberately richer than the row Sparkline: labelled time/price axes and
// a tooltip. Reuses Sparkline's explicit-dimension render path so this
// stays testable under jsdom, where a measured ResponsiveContainer reports
// zero size.

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceTick } from "@/lib/types";
import type { PricePoint } from "@/lib/usePriceStream";
import { formatClock, formatPercent, formatPrice } from "@/lib/format";

export interface MainChartProps {
  selectedTicker?: string;
  history: PricePoint[];
  tick?: PriceTick;
  width?: number;
  height?: number;
}

const PANEL_HEIGHT = 320;

function PanelChrome({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      {heading}
      {children}
    </div>
  );
}

function chartLine() {
  return (
    <Line
      type="monotone"
      dataKey="price"
      stroke="#209dd7"
      strokeWidth={2}
      dot={false}
      isAnimationActive={false}
    />
  );
}

function chartAxesAndGrid() {
  return (
    <>
      <CartesianGrid stroke="#30363d" strokeDasharray="3 3" />
      <XAxis
        dataKey="timestamp"
        type="number"
        domain={["dataMin", "dataMax"]}
        tickFormatter={(value: number) => formatClock(value)}
        stroke="#8b949e"
        fontSize={11}
      />
      <YAxis
        domain={["auto", "auto"]}
        tickFormatter={(value: number) => formatPrice(value)}
        stroke="#8b949e"
        fontSize={11}
        width={64}
      />
      <Tooltip
        labelFormatter={(label: unknown) => formatClock(Number(label))}
        formatter={(value: unknown) => [formatPrice(Number(value)), "Price"] as [string, string]}
        contentStyle={{ background: "#161b22", border: "1px solid #30363d" }}
      />
    </>
  );
}

export function MainChart({ selectedTicker, history, tick, width, height }: MainChartProps) {
  if (!selectedTicker) {
    return (
      <PanelChrome heading={<h2 className="text-sm font-medium text-gray-400">Chart</h2>}>
        <div
          className="flex flex-1 items-center justify-center text-sm text-gray-500"
          style={{ minHeight: height ?? PANEL_HEIGHT }}
        >
          Pick a ticker from the watchlist to view its chart.
        </div>
      </PanelChrome>
    );
  }

  const heading = (
    <h2 className="flex items-baseline gap-3 text-sm font-medium text-gray-200">
      <span className="text-base font-semibold">{selectedTicker}</span>
      <span className="tabular-nums text-gray-300">{formatPrice(tick?.price)}</span>
      <span className="tabular-nums text-xs">{formatPercent(tick?.change_percent, { sign: true })}</span>
    </h2>
  );

  if (history.length === 0) {
    return (
      <PanelChrome heading={heading}>
        <div
          className="flex flex-1 items-center justify-center text-sm text-gray-500"
          style={{ minHeight: height ?? PANEL_HEIGHT }}
        >
          Waiting for data…
        </div>
      </PanelChrome>
    );
  }

  if (width !== undefined && height !== undefined) {
    return (
      <PanelChrome heading={heading}>
        <LineChart width={width} height={height} data={history}>
          {chartAxesAndGrid()}
          {chartLine()}
        </LineChart>
      </PanelChrome>
    );
  }

  return (
    <PanelChrome heading={heading}>
      <div style={{ height: PANEL_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            {chartAxesAndGrid()}
            {chartLine()}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </PanelChrome>
  );
}

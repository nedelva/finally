"use client";

// Full-history portfolio value line chart (PORT-06). Structurally a close
// copy of MainChart.tsx — same PanelChrome, grid, axis, and tooltip styling
// — with two substitutions: the series is keyed on PortfolioSnapshot's
// recorded_at/total_value rather than PricePoint's timestamp/price, and the
// Y axis/tooltip format through formatMoney rather than formatPrice. Per
// D-12 there is no time-range control of any kind, and no windowing or
// decimation is applied — every snapshot the server returns is plotted.

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
import type { PortfolioSnapshot } from "@/lib/types";
import { formatClock, formatMoney } from "@/lib/format";

export interface PnLChartProps {
  snapshots: PortfolioSnapshot[];
  currentTotalValue: number | null;
  loading: boolean;
  error: string | null;
  width?: number;
  height?: number;
}

interface ChartPoint {
  timestamp: number;
  total_value: number;
}

const PANEL_HEIGHT = 320;
const HEADING = <h2 className="text-base font-semibold text-gray-200">P&amp;L</h2>;

function PanelChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      {HEADING}
      {children}
    </div>
  );
}

function PlaceholderMessage({ height, tone, text }: { height?: number; tone: "muted" | "error"; text: string }) {
  return (
    <div
      className={
        tone === "error"
          ? "flex flex-1 items-center justify-center text-sm text-[var(--color-down)]"
          : "flex flex-1 items-center justify-center text-sm text-gray-500"
      }
      style={{ minHeight: height ?? PANEL_HEIGHT }}
    >
      {text}
    </div>
  );
}

function chartLine() {
  return (
    <Line
      type="monotone"
      dataKey="total_value"
      stroke="var(--color-primary-blue)"
      strokeWidth={2}
      dot={{ r: 2 }}
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
        tickFormatter={(value: number) => formatMoney(value)}
        stroke="#8b949e"
        fontSize={11}
        width={72}
      />
      <Tooltip
        labelFormatter={(label: unknown) => formatClock(Number(label))}
        formatter={(value: unknown) => [formatMoney(Number(value)), "Value"] as [string, string]}
        contentStyle={{ background: "#161b22", border: "1px solid #30363d" }}
      />
    </>
  );
}

/**
 * Builds the plotted series. Every snapshot the server returns is plotted
 * exactly as supplied, in order — no windowing, thinning, or decimation
 * (D-12); a dense cluster of points right after a trade is a true record of
 * what happened. When there are no snapshots yet, a single point is
 * synthesized from the current portfolio total (D-13) so a fresh start
 * shows real data immediately instead of an empty chart for the first
 * thirty seconds. Returns `null` when there is nothing at all to plot.
 */
function buildData(
  snapshots: PortfolioSnapshot[],
  currentTotalValue: number | null,
): ChartPoint[] | null {
  if (snapshots.length > 0) {
    return snapshots.map((snapshot) => ({
      // formatClock (like MainChart's PriceTick.timestamp) treats a numeric
      // input as Unix seconds, not milliseconds — divide down here so axis
      // ticks and the tooltip render the real snapshot time (WR-02).
      timestamp: Date.parse(snapshot.recorded_at) / 1000,
      total_value: snapshot.total_value,
    }));
  }
  if (currentTotalValue !== null) {
    return [{ timestamp: Date.now() / 1000, total_value: currentTotalValue }];
  }
  return null;
}

export function PnLChart({
  snapshots,
  currentTotalValue,
  loading,
  error,
  width,
  height,
}: PnLChartProps) {
  if (loading) {
    return (
      <PanelChrome>
        <PlaceholderMessage height={height} tone="muted" text="Waiting for data…" />
      </PanelChrome>
    );
  }

  if (error) {
    return (
      <PanelChrome>
        <PlaceholderMessage height={height} tone="error" text={error} />
      </PanelChrome>
    );
  }

  const data = buildData(snapshots, currentTotalValue);

  if (data === null) {
    return (
      <PanelChrome>
        <PlaceholderMessage height={height} tone="muted" text="Waiting for data…" />
      </PanelChrome>
    );
  }

  if (width !== undefined && height !== undefined) {
    return (
      <PanelChrome>
        <LineChart width={width} height={height} data={data}>
          {chartAxesAndGrid()}
          {chartLine()}
        </LineChart>
      </PanelChrome>
    );
  }

  return (
    <PanelChrome>
      <div style={{ height: PANEL_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            {chartAxesAndGrid()}
            {chartLine()}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </PanelChrome>
  );
}

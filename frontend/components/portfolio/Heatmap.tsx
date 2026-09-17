"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { usePriceStream } from "@/context/PriceStreamContext";
import { formatMoney, formatPercent } from "@/lib/format";
import { deriveLivePosition } from "@/lib/positionMath";
import type { Position } from "@/lib/types";

// Diverging green/red mixed toward the panel surface by |P&L%| magnitude,
// capped at 15% for full saturation. Hue alone fails the CVD check for a
// green/red pair (see dataviz skill), so every tile ALSO carries the ticker
// and signed P&L% as visible text — that text is the accessible channel,
// the color is a supporting glance cue.
const SURFACE_RGB: [number, number, number] = [19, 24, 32];
const POSITIVE_RGB: [number, number, number] = [63, 185, 80];
const NEGATIVE_RGB: [number, number, number] = [248, 81, 73];
const CAP_PERCENT = 15;

function heatColor(pnlPercent: number): string {
  if (!Number.isFinite(pnlPercent) || pnlPercent === 0) return "rgb(46, 53, 66)";
  const clamped = Math.max(-CAP_PERCENT, Math.min(CAP_PERCENT, pnlPercent));
  const intensity = Math.abs(clamped) / CAP_PERCENT;
  const base = clamped > 0 ? POSITIVE_RGB : NEGATIVE_RGB;
  const mixed = base.map((c, i) => Math.round(SURFACE_RGB[i] + (c - SURFACE_RGB[i]) * (0.25 + intensity * 0.75)));
  return `rgb(${mixed.join(",")})`;
}

interface HeatmapNode {
  name: string;
  size: number;
  pnlPercent: number;
  pnl: number;
  [key: string]: unknown;
}

function TreemapCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pnlPercent?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, pnlPercent = 0 } = props;
  const showText = width > 44 && height > 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={heatColor(pnlPercent)}
        stroke="var(--color-void)"
        strokeWidth={2}
        rx={3}
      />
      {showText && (
        <>
          <text x={x + 8} y={y + 18} fontSize={12} fontWeight={600} fill="#e6edf3" fontFamily="var(--font-mono)">
            {name}
          </text>
          <text x={x + 8} y={y + 34} fontSize={11} fill={pnlPercent >= 0 ? "#3fb950" : "#f85149"}>
            {formatPercent(pnlPercent, { sign: true })}
          </text>
        </>
      )}
    </g>
  );
}

export function Heatmap({ positions }: { positions: Position[] }) {
  const { latest } = usePriceStream();

  // Recompute weight and P&L% from the live SSE price so heatmap tiles
  // never lag the positions table (see PositionsTable for the same
  // rationale) — sized by market value, colored by live P&L%.
  const data = useMemo<HeatmapNode[]>(
    () =>
      positions
        .map((p) => {
          const live = deriveLivePosition(p, latest[p.ticker]?.price);
          return { name: p.ticker, size: live.marketValue, pnlPercent: live.pnlPercent, pnl: live.pnl };
        })
        .filter((node) => node.size > 0),
    [positions, latest],
  );

  return (
    <section className="flex flex-col rounded-lg border border-hairline bg-panel p-4" aria-label="Portfolio heatmap">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Positions heatmap
      </h2>
      <div className="h-56 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No open positions yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="var(--color-void)"
              isAnimationActive={false}
              content={<TreemapCell />}
            >
              <Tooltip
                contentStyle={{
                  background: "var(--color-panel-raised)",
                  border: "1px solid var(--color-hairline-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(_value, _name, item) => {
                  const payload = item?.payload as HeatmapNode | undefined;
                  if (!payload) return ["", ""] as [string, string];
                  return [
                    `${formatMoney(payload.size)} · ${formatPercent(payload.pnlPercent, { sign: true })}`,
                    payload.name,
                  ] as [string, string];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

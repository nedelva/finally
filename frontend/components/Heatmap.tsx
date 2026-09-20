"use client";

// Portfolio heatmap (PORT-05). Reuses MainChart's PanelChrome and jsdom-safe
// explicit-dimension escape hatch verbatim. recharts' own Treemap already
// implements the squarified layout (D-09) — this file only supplies the
// data mapping (sized by market value) and a custom tile renderer (coloured
// by live P&L percent). Clicking a tile invokes the same onSelect callback a
// watchlist row click uses (D-10) — no second selection mechanism.

import { ResponsiveContainer, Treemap } from "recharts";
import type { TreemapNode } from "recharts";
import { deriveLivePosition } from "@/lib/positionMath";
import type { Position, PriceStreamEvent } from "@/lib/types";
import type { ReactNode } from "react";

export interface HeatmapProps {
  positions: Position[];
  ticks: PriceStreamEvent;
  loading: boolean;
  error: string | null;
  /** Called with a tile's ticker on click (D-10). */
  onSelect?: (ticker: string) => void;
  width?: number;
  height?: number;
}

const PANEL_HEIGHT = 320;
const NEUTRAL_FILL = "#8b949e";

function PanelChrome({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      {heading}
      {children}
    </div>
  );
}

interface TileDatum {
  name: string;
  size: number;
  pnlPercent: number;
  [key: string]: unknown;
}

/**
 * Fill above zero is the up token, below zero the down token, and exactly
 * zero the neutral gray — that last branch is where a D-03 avg_cost-fallback
 * position lands, and rendering it neutral is what stops a frozen price
 * being displayed as a gain or a loss.
 */
function tileFill(pnlPercent: number): string {
  if (pnlPercent > 0) return "var(--color-up)";
  if (pnlPercent < 0) return "var(--color-down)";
  return NEUTRAL_FILL;
}

function HeatmapTile({
  x,
  y,
  width,
  height,
  name,
  pnlPercent,
  onSelect,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  pnlPercent: number;
  onSelect?: (ticker: string) => void;
}) {
  return (
    <g
      data-testid={`heatmap-tile-${name}`}
      onClick={() => onSelect?.(name)}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: tileFill(pnlPercent), stroke: "var(--color-bg)", strokeWidth: 2 }}
      />
      {width > 40 && height > 20 && (
        <text x={x + 6} y={y + 16} fill="#0d1117" fontSize={12} fontWeight={600}>
          {name}
        </text>
      )}
    </g>
  );
}

export function Heatmap({ positions, ticks, loading, error, onSelect, width, height }: HeatmapProps) {
  const heading = <h2 className="text-base font-semibold text-gray-200">Portfolio Heatmap</h2>;

  if (loading) {
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

  if (error) {
    return (
      <PanelChrome heading={heading}>
        <div
          className="flex flex-1 items-center justify-center text-sm text-[var(--color-down)]"
          style={{ minHeight: height ?? PANEL_HEIGHT }}
        >
          {error}
        </div>
      </PanelChrome>
    );
  }

  if (positions.length === 0) {
    return (
      <PanelChrome heading={heading}>
        <div
          className="flex flex-1 items-center justify-center text-sm text-gray-500"
          style={{ minHeight: height ?? PANEL_HEIGHT }}
        >
          No positions yet - buy a ticker to see it here
        </div>
      </PanelChrome>
    );
  }

  const data: TileDatum[] = positions.map((position) => {
    const live = deriveLivePosition(position, ticks[position.ticker]?.price);
    return { name: position.ticker, size: live.marketValue, pnlPercent: live.pnlPercent };
  });

  const renderTile = (props: TreemapNode) => (
    <HeatmapTile
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      name={props.name}
      pnlPercent={Number(props.pnlPercent)}
      onSelect={onSelect}
    />
  );

  if (width !== undefined && height !== undefined) {
    return (
      <PanelChrome heading={heading}>
        <Treemap
          width={width}
          height={height}
          data={data}
          dataKey="size"
          isAnimationActive={false}
          content={renderTile}
        />
      </PanelChrome>
    );
  }

  return (
    <PanelChrome heading={heading}>
      <div style={{ height: PANEL_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" isAnimationActive={false} content={renderTile} />
        </ResponsiveContainer>
      </div>
    </PanelChrome>
  );
}

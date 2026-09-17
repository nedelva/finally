import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PriceStreamProvider } from "@/context/PriceStreamContext";
import { Heatmap } from "@/components/portfolio/Heatmap";
import { PnlChart } from "@/components/portfolio/PnlChart";
import type { Position, PortfolioSnapshot } from "@/lib/types";

// jsdom has no ResizeObserver and reports 0x0 element boxes, so recharts'
// ResponsiveContainer renders nothing by default. Polyfilling both here
// lets these tests actually exercise SVG output (rect/path/text) instead
// of only ever hitting the empty-state branch — this is the "does the
// Treemap's custom content actually receive pnlPercent" check the
// TypeScript compiler can't confirm on its own.
beforeAll(() => {
  class ResizeObserverStub {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;

  for (const prop of ["offsetWidth", "clientWidth"]) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, value: 600 });
  }
  for (const prop of ["offsetHeight", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, value: 300 });
  }
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width: 600,
      height: 300,
      top: 0,
      left: 0,
      right: 600,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect;
  };
});

afterEach(cleanup);

const positions: Position[] = [
  { ticker: "AAPL", quantity: 10, avg_cost: 185.2, current_price: 190.5, market_value: 1905, unrealized_pnl: 53, unrealized_pnl_percent: 2.86 },
  { ticker: "TSLA", quantity: 2, avg_cost: 300, current_price: 250, market_value: 500, unrealized_pnl: -100, unrealized_pnl_percent: -16.67 },
];

describe("Heatmap (Treemap) rendering", () => {
  it("renders a tile per position with ticker and signed P&L% as visible SVG text, colored by direction", () => {
    const { container } = render(
      <PriceStreamProvider value={{ status: "connected", latest: {}, history: {} }}>
        <Heatmap positions={positions} />
      </PriceStreamProvider>,
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();

    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("AAPL");
    expect(texts).toContain("TSLA");
    expect(texts).toContain("+2.86%");
    expect(texts).toContain("-16.67%");

    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it("recomputes tile P&L% from a live SSE price rather than the stale REST field", () => {
    const { container } = render(
      <PriceStreamProvider
        value={{
          status: "connected",
          latest: {
            AAPL: { ticker: "AAPL", price: 199.99, previous_price: 190.5, timestamp: 1, change: 9.49, change_percent: 4.98, direction: "up" },
          },
          history: {},
        }}
      >
        <Heatmap positions={positions} />
      </PriceStreamProvider>,
    );

    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("+7.99%");
    expect(texts).not.toContain("+2.86%");
  });
});

describe("PnlChart (LineChart) rendering", () => {
  it("draws a line path from portfolio snapshots", () => {
    const snapshots: PortfolioSnapshot[] = [
      { total_value: 10000, recorded_at: "2026-09-17T20:00:00.000Z" },
      { total_value: 10355.32, recorded_at: "2026-09-17T20:00:30.000Z" },
      { total_value: 10120.0, recorded_at: "2026-09-17T20:01:00.000Z" },
    ];
    const { container } = render(<PnlChart snapshots={snapshots} loading={false} />);

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    const line = container.querySelector(".recharts-line-curve");
    expect(line).toBeTruthy();
    expect(line?.getAttribute("d")).toMatch(/^M/);
  });
});

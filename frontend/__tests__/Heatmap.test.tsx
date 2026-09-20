import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Heatmap } from "@/components/Heatmap";
import type { Position } from "@/lib/types";

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    ticker: "AAPL",
    quantity: 2,
    avg_cost: 100,
    current_price: 100,
    market_value: 200,
    unrealized_pnl: 0,
    unrealized_pnl_percent: 0,
    ...overrides,
  };
}

describe("Heatmap", () => {
  it("renders an svg with a rect per position", () => {
    const positions = [
      makePosition({ ticker: "AAPL" }),
      makePosition({ ticker: "GOOGL", market_value: 100 }),
    ];
    const { container } = render(
      <Heatmap positions={positions} ticks={{}} loading={false} error={null} width={400} height={240} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(2);
  });

  it("fills a positive-P&L tile with the up colour token", () => {
    const position = makePosition({
      current_price: 120,
      unrealized_pnl: 40,
      unrealized_pnl_percent: 20,
    });
    const { container } = render(
      <Heatmap
        positions={[position]}
        ticks={{}}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );
    const rect = container.querySelector('[data-testid="heatmap-tile-AAPL"] rect');
    expect(rect?.getAttribute("style")).toContain("var(--color-up)");
  });

  it("fills a negative-P&L tile with the down colour token", () => {
    const position = makePosition({
      current_price: 80,
      unrealized_pnl: -40,
      unrealized_pnl_percent: -20,
    });
    const { container } = render(
      <Heatmap
        positions={[position]}
        ticks={{}}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );
    const rect = container.querySelector('[data-testid="heatmap-tile-AAPL"] rect');
    expect(rect?.getAttribute("style")).toContain("var(--color-down)");
  });

  it("fills a zero-P&L tile (the D-03 fallback state) with the neutral gray, not up or down", () => {
    const position = makePosition(); // current_price === avg_cost, pnl 0
    const { container } = render(
      <Heatmap
        positions={[position]}
        ticks={{}}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );
    const rect = container.querySelector('[data-testid="heatmap-tile-AAPL"] rect');
    expect(rect?.getAttribute("style")).toContain("#8b949e");
  });

  it("calls onSelect exactly once with the tile's ticker on click", () => {
    const onSelect = vi.fn();
    const position = makePosition({ ticker: "AAPL" });
    const { container } = render(
      <Heatmap
        positions={[position]}
        ticks={{}}
        loading={false}
        error={null}
        onSelect={onSelect}
        width={400}
        height={240}
      />,
    );
    const tile = container.querySelector('[data-testid="heatmap-tile-AAPL"]');
    expect(tile).toBeInTheDocument();
    fireEvent.click(tile as Element);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });

  it("shows the D-11 empty state and no svg with zero positions", () => {
    const { container } = render(
      <Heatmap positions={[]} ticks={{}} loading={false} error={null} width={400} height={240} />,
    );
    expect(
      screen.getByText("No positions yet - buy a ticker to see it here"),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("shows a waiting placeholder while loading", () => {
    render(
      <Heatmap positions={[]} ticks={{}} loading={true} error={null} width={400} height={240} />,
    );
    expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
  });

  it("shows the error message on a failed fetch", () => {
    render(
      <Heatmap
        positions={[]}
        ticks={{}}
        loading={false}
        error="Could not load portfolio."
        width={400}
        height={240}
      />,
    );
    expect(screen.getByText("Could not load portfolio.")).toBeInTheDocument();
  });

  it("sizes the larger holding's tile with a greater area than the smaller holding's", () => {
    const positions = [
      makePosition({
        ticker: "BIG",
        quantity: 1,
        avg_cost: 300,
        current_price: 300,
        market_value: 300,
        unrealized_pnl: 0,
        unrealized_pnl_percent: 0,
      }),
      makePosition({
        ticker: "SMALL",
        quantity: 1,
        avg_cost: 100,
        current_price: 100,
        market_value: 100,
        unrealized_pnl: 0,
        unrealized_pnl_percent: 0,
      }),
    ];
    const { container } = render(
      <Heatmap
        positions={positions}
        ticks={{}}
        loading={false}
        error={null}
        width={400}
        height={240}
      />,
    );
    const area = (el: Element | null) => {
      const w = Number(el?.getAttribute("width") ?? 0);
      const h = Number(el?.getAttribute("height") ?? 0);
      return w * h;
    };
    const bigRect = container.querySelector('[data-testid="heatmap-tile-BIG"] rect');
    const smallRect = container.querySelector('[data-testid="heatmap-tile-SMALL"] rect');
    expect(area(bigRect)).toBeGreaterThan(area(smallRect));
  });
});

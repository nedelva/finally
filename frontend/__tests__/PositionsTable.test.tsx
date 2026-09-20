import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PositionsTable } from "@/components/PositionsTable";
import type { Position, PriceStreamEvent } from "@/lib/types";

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

function makeTicks(ticker: string, price: number): PriceStreamEvent {
  return {
    [ticker]: {
      ticker,
      price,
      previous_price: price,
      timestamp: Date.now() / 1000,
      change: 0,
      change_percent: 0,
      direction: "flat",
    },
  };
}

describe("PositionsTable", () => {
  it("renders the six column headers", () => {
    render(
      <PositionsTable positions={[makePosition()]} ticks={{}} loading={false} error={null} />,
    );
    for (const label of ["Symbol", "Qty", "Avg Cost", "Price", "P&L", "Chg %"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("recomputes price and P&L from the live tick, not the stale REST snapshot", () => {
    const position = makePosition();
    render(
      <PositionsTable
        positions={[position]}
        ticks={makeTicks("AAPL", 150)}
        loading={false}
        error={null}
      />,
    );
    const row = screen.getByTestId("position-row-AAPL");
    expect(row.textContent).toContain("150.00");
    expect(row.textContent).toContain("100.00");
  });

  it("falls back to the REST snapshot's own fields when no tick matches the ticker", () => {
    const position = makePosition({
      current_price: 120,
      unrealized_pnl: 40,
      unrealized_pnl_percent: 20,
    });
    render(<PositionsTable positions={[position]} ticks={{}} loading={false} error={null} />);
    const row = screen.getByTestId("position-row-AAPL");
    expect(row.textContent).toContain("120.00");
    expect(row.textContent).toContain("40.00");
  });

  it("colours a zero P&L (the D-03 fallback state) with the neutral flat class, never up or down", () => {
    const position = makePosition(); // current_price === avg_cost, unrealized_pnl 0
    render(<PositionsTable positions={[position]} ticks={{}} loading={false} error={null} />);
    const pnlCell = screen.getByTestId("position-row-AAPL").querySelectorAll("td")[4];
    expect(pnlCell.className).toContain("text-gray-400");
    expect(pnlCell.className).not.toContain("color-up");
    expect(pnlCell.className).not.toContain("color-down");
  });

  it("renders 0.00% with no Infinity or NaN when avg_cost is zero", () => {
    const position = makePosition({
      avg_cost: 0,
      quantity: 5,
      current_price: 0,
      unrealized_pnl: 0,
      unrealized_pnl_percent: 0,
    });
    render(
      <PositionsTable
        positions={[position]}
        ticks={makeTicks("AAPL", 20)}
        loading={false}
        error={null}
      />,
    );
    const row = screen.getByTestId("position-row-AAPL");
    expect(row.textContent).toContain("0.00%");
    expect(row.textContent).not.toMatch(/Infinity|NaN/);
  });

  it("shows the empty state and no rows when there are no positions", () => {
    render(<PositionsTable positions={[]} ticks={{}} loading={false} error={null} />);
    expect(screen.getByText("No positions yet")).toBeInTheDocument();
    expect(screen.getByText("Buy a ticker to see it here.")).toBeInTheDocument();
    expect(screen.queryByTestId(/^position-row-/)).not.toBeInTheDocument();
  });

  it("shows a loading row and keeps the table shell visible while the fetch is in flight", () => {
    render(<PositionsTable positions={[]} ticks={{}} loading={true} error={null} />);
    expect(screen.getByText("Loading portfolio...")).toBeInTheDocument();
    expect(screen.getByText("Symbol")).toBeInTheDocument();
  });

  it("shows the error message and not the empty state when the fetch fails", () => {
    render(
      <PositionsTable
        positions={[]}
        ticks={{}}
        loading={false}
        error="Could not load portfolio."
      />,
    );
    expect(screen.getByText("Could not load portfolio.")).toBeInTheDocument();
    expect(screen.queryByText("No positions yet")).not.toBeInTheDocument();
  });

  it("shows a holding even when its ticker is no longer on the watchlist", () => {
    const position = makePosition({ ticker: "DELISTED" });
    render(<PositionsTable positions={[position]} ticks={{}} loading={false} error={null} />);
    expect(screen.getByTestId("position-row-DELISTED")).toBeInTheDocument();
  });

  it("calls onSelect with the ticker when a row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const position = makePosition();
    render(
      <PositionsTable
        positions={[position]}
        ticks={{}}
        loading={false}
        error={null}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByTestId("position-row-AAPL"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });
});

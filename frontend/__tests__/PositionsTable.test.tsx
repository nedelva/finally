import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PriceStreamProvider } from "@/context/PriceStreamContext";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import type { Position } from "@/lib/types";

afterEach(cleanup);

const positions: Position[] = [
  {
    ticker: "AAPL",
    quantity: 10,
    avg_cost: 185.2,
    current_price: 190.5,
    market_value: 1905.0,
    unrealized_pnl: 53.0,
    unrealized_pnl_percent: 2.86,
  },
  {
    ticker: "TSLA",
    quantity: 2,
    avg_cost: 300,
    current_price: 250,
    market_value: 500,
    unrealized_pnl: -100,
    unrealized_pnl_percent: -16.67,
  },
];

describe("PositionsTable", () => {
  it("renders quantity, avg cost, current price, and signed P&L from portfolio data", () => {
    render(
      <PriceStreamProvider value={{ status: "connected", latest: {}, history: {} }}>
        <PositionsTable positions={positions} loading={false} />
      </PriceStreamProvider>,
    );

    const aaplRow = screen.getByTestId("position-row-AAPL");
    expect(aaplRow).toHaveTextContent("AAPL");
    expect(aaplRow).toHaveTextContent("10");
    expect(aaplRow).toHaveTextContent("185.20");
    expect(aaplRow).toHaveTextContent("190.50");
    expect(aaplRow).toHaveTextContent("+$53.00");
    expect(aaplRow).toHaveTextContent("+2.86%");

    const tslaRow = screen.getByTestId("position-row-TSLA");
    expect(tslaRow).toHaveTextContent("-$100.00");
    expect(tslaRow).toHaveTextContent("-16.67%");
  });

  it("overlays the live SSE price AND recomputes P&L from it (never a live price beside stale P&L)", () => {
    render(
      <PriceStreamProvider
        value={{
          status: "connected",
          latest: {
            AAPL: {
              ticker: "AAPL",
              price: 199.99,
              previous_price: 190.5,
              timestamp: 1737310000,
              change: 9.49,
              change_percent: 4.98,
              direction: "up",
            },
          },
          history: {},
        }}
      >
        <PositionsTable positions={positions} loading={false} />
      </PriceStreamProvider>,
    );

    const row = screen.getByTestId("position-row-AAPL");
    expect(row).toHaveTextContent("199.99");
    // avg_cost 185.20, qty 10 -> pnl = (199.99 - 185.20) * 10 = 147.90,
    // pnl% = (199.99 / 185.20 - 1) * 100 ≈ 7.99% — NOT the stale REST
    // snapshot's +$53.00 / +2.86% for the old 190.50 price.
    expect(row).toHaveTextContent("+$147.90");
    expect(row).toHaveTextContent("+7.99%");
    expect(row).not.toHaveTextContent("+$53.00");
  });

  it("shows an empty state when there are no positions", () => {
    render(
      <PriceStreamProvider value={{ status: "connected", latest: {}, history: {} }}>
        <PositionsTable positions={[]} loading={false} />
      </PriceStreamProvider>,
    );
    expect(screen.getByText(/No open positions/)).toBeInTheDocument();
  });
});

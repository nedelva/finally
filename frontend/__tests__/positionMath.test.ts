import { describe, expect, it } from "vitest";
import { deriveLivePosition } from "@/lib/positionMath";
import { useLiveTotalValue } from "@/lib/hooks";
import type { Portfolio, Position } from "@/lib/types";

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    ticker: "AAPL",
    quantity: 2,
    avg_cost: 150,
    current_price: 150,
    market_value: 300,
    unrealized_pnl: 0,
    unrealized_pnl_percent: 0,
    ...overrides,
  };
}

describe("deriveLivePosition", () => {
  it("echoes the position's own snapshot fields unchanged when livePrice is undefined (D-03 fallback)", () => {
    const position = makePosition({
      current_price: 145,
      market_value: 290,
      unrealized_pnl: -10,
      unrealized_pnl_percent: -3.33,
    });

    const result = deriveLivePosition(position, undefined);

    expect(result.price).toBe(position.current_price);
    expect(result.marketValue).toBe(position.market_value);
    expect(result.pnl).toBe(position.unrealized_pnl);
    expect(result.pnlPercent).toBe(position.unrealized_pnl_percent);
  });

  it("derives marketValue and positive pnl when the live price is above avg_cost", () => {
    const position = makePosition({ quantity: 2, avg_cost: 150 });

    const result = deriveLivePosition(position, 200);

    expect(result.marketValue).toBe(400);
    expect(result.pnl).toBe(100);
    expect(result.pnlPercent).toBeGreaterThan(0);
  });

  it("derives negative pnl and pnlPercent when the live price is below avg_cost", () => {
    const position = makePosition({ quantity: 2, avg_cost: 150 });

    const result = deriveLivePosition(position, 100);

    expect(result.pnl).toBeLessThan(0);
    expect(result.pnlPercent).toBeLessThan(0);
  });

  it("returns pnlPercent of 0 rather than Infinity or NaN when avg_cost is 0", () => {
    const position = makePosition({ quantity: 2, avg_cost: 0 });

    const result = deriveLivePosition(position, 50);

    expect(result.pnlPercent).toBe(0);
    expect(Number.isFinite(result.pnlPercent)).toBe(true);
  });
});

function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    cash_balance: 10000,
    positions: [],
    total_value: 10000,
    total_unrealized_pnl: 0,
    ...overrides,
  };
}

describe("useLiveTotalValue", () => {
  it("returns null when the portfolio is null", () => {
    expect(useLiveTotalValue(null, {})).toBeNull();
  });

  it("returns exactly cash_balance for a portfolio with zero positions", () => {
    const portfolio = makePortfolio({ cash_balance: 10000, positions: [] });

    expect(useLiveTotalValue(portfolio, {})).toBe(10000);
  });

  it("returns cash plus both live market values for two positions with live ticks", () => {
    const positionA = makePosition({ ticker: "AAPL", quantity: 2, avg_cost: 150 });
    const positionB = makePosition({ ticker: "GOOGL", quantity: 1, avg_cost: 100 });
    const portfolio = makePortfolio({
      cash_balance: 1000,
      positions: [positionA, positionB],
    });
    const ticks = {
      AAPL: {
        ticker: "AAPL",
        price: 200,
        previous_price: 190,
        timestamp: 0,
        change: 10,
        change_percent: 5,
        direction: "up" as const,
      },
      GOOGL: {
        ticker: "GOOGL",
        price: 120,
        previous_price: 118,
        timestamp: 0,
        change: 2,
        change_percent: 1.7,
        direction: "up" as const,
      },
    };

    // cash 1000 + (2 * 200) + (1 * 120) = 1520
    expect(useLiveTotalValue(portfolio, ticks)).toBe(1520);
  });

  it("falls back to the REST-snapshot market_value for a position with no matching tick", () => {
    const position = makePosition({
      ticker: "AAPL",
      quantity: 2,
      market_value: 300,
    });
    const portfolio = makePortfolio({ cash_balance: 1000, positions: [position] });

    expect(useLiveTotalValue(portfolio, {})).toBe(1300);
  });

  it("uses the live tick's market value once a matching tick exists for that position", () => {
    const position = makePosition({
      ticker: "AAPL",
      quantity: 2,
      market_value: 300,
    });
    const portfolio = makePortfolio({ cash_balance: 1000, positions: [position] });
    const ticks = {
      AAPL: {
        ticker: "AAPL",
        price: 200,
        previous_price: 190,
        timestamp: 0,
        change: 10,
        change_percent: 5,
        direction: "up" as const,
      },
    };

    // cash 1000 + 2*200 = 1400
    expect(useLiveTotalValue(portfolio, ticks)).toBe(1400);
  });
});

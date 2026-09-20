import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MainChart } from "@/components/MainChart";
import { WatchlistRow } from "@/components/WatchlistRow";
import type { PriceTick } from "@/lib/types";
import type { PricePoint } from "@/lib/usePriceStream";

function makeTick(ticker: string, price: number, changePercent = 0): PriceTick {
  return {
    ticker,
    price,
    previous_price: price,
    timestamp: Date.now() / 1000,
    change: 0,
    change_percent: changePercent,
    direction: "flat",
  };
}

function points(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({ timestamp: 1700000000 + i * 60, price }));
}

function renderRow(props: {
  ticker: string;
  tick?: PriceTick;
  selected?: boolean;
  onSelect?: (ticker: string) => void;
}) {
  return render(
    <table>
      <tbody>
        <WatchlistRow {...props} />
      </tbody>
    </table>,
  );
}

describe("WatchlistRow selection", () => {
  it("invokes the selection callback exactly once with the row's ticker on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRow({ ticker: "AAPL", onSelect });

    await user.click(screen.getByTestId("row-AAPL"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });

  it("activates the selection callback on Enter key press", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRow({ ticker: "AAPL", onSelect });

    const row = screen.getByTestId("row-AAPL");
    row.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });

  it("keeps native row semantics and carries a tab index for keyboard activation", () => {
    renderRow({ ticker: "AAPL" });
    const row = screen.getByTestId("row-AAPL");

    expect(row).not.toHaveAttribute("role");
    expect(row.tagName).toBe("TR");
    expect(row).toHaveAttribute("tabindex", "0");
  });

  it("marks the selected row aria-selected=true and other rows aria-selected=false", () => {
    render(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" selected={true} />
          <WatchlistRow ticker="GOOGL" selected={false} />
        </tbody>
      </table>,
    );

    expect(screen.getByTestId("row-AAPL")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("row-GOOGL")).toHaveAttribute("aria-selected", "false");
  });
});

describe("MainChart", () => {
  it("renders an instruction to pick a ticker and does not throw when nothing is selected", () => {
    expect(() => render(<MainChart history={[]} width={400} height={240} />)).not.toThrow();
    expect(screen.getByText(/pick a ticker/i)).toBeInTheDocument();
  });

  it("renders the symbol and a waiting message and does not throw when the selected ticker has no history yet", () => {
    expect(() =>
      render(<MainChart selectedTicker="AAPL" history={[]} width={400} height={240} />),
    ).not.toThrow();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
  });

  it("renders an SVG path element and the ticker symbol for a selection with three or more points", () => {
    const { container } = render(
      <MainChart
        selectedTicker="AAPL"
        history={points([190, 191, 189.5])}
        tick={makeTick("AAPL", 189.5, 1.2)}
        width={400}
        height={240}
      />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("renders axis ticks through the shared clock formatter rather than raw unix timestamps", () => {
    const { container } = render(
      <MainChart
        selectedTicker="AAPL"
        history={points([190, 191, 189.5, 192])}
        tick={makeTick("AAPL", 192, 1.05)}
        width={400}
        height={240}
      />,
    );

    const text = container.textContent ?? "";
    // formatClock renders e.g. "02:05 AM" — never a ten-digit unix-second string.
    expect(text).not.toMatch(/17000000\d\d/);
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "@/components/Sparkline";
import { WatchlistRow } from "@/components/WatchlistRow";
import type { PricePoint } from "@/lib/usePriceStream";

function points(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({ timestamp: i, price }));
}

describe("Sparkline", () => {
  it("renders without throwing for an empty data array and draws no line", () => {
    const { container } = render(<Sparkline data={[]} width={80} height={24} />);

    expect(container.querySelector("path")).toBeNull();
  });

  it("renders without throwing for a single point", () => {
    expect(() =>
      render(<Sparkline data={points([190])} width={80} height={24} />),
    ).not.toThrow();
  });

  it("renders an SVG path element for three or more points", () => {
    const { container } = render(
      <Sparkline data={points([190, 191, 189.5])} width={80} height={24} />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("renders at the explicit pixel dimensions supplied, rather than depending on a measured container", () => {
    const { container } = render(
      <Sparkline data={points([190, 191, 189.5])} width={80} height={24} />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "80");
    expect(svg).toHaveAttribute("height", "24");
  });
});

describe("WatchlistRow sparkline integration", () => {
  it("renders a sparkline cell for the row's ticker history", () => {
    const { container } = render(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" history={points([190, 191, 192])} />
        </tbody>
      </table>,
    );

    expect(container.querySelector('[data-testid="sparkline-AAPL"]')).toBeInTheDocument();
  });

  it("renders its sparkline cell without throwing when history is absent or empty", () => {
    expect(() =>
      render(
        <table>
          <tbody>
            <WatchlistRow ticker="AAPL" />
          </tbody>
        </table>,
      ),
    ).not.toThrow();

    expect(() =>
      render(
        <table>
          <tbody>
            <WatchlistRow ticker="GOOGL" history={[]} />
          </tbody>
        </table>,
      ),
    ).not.toThrow();
  });
});

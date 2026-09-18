import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Watchlist } from "@/components/Watchlist";
import { WatchlistRow } from "@/components/WatchlistRow";
import { PriceStreamProvider } from "@/lib/PriceStreamContext";
import type { PriceTick } from "@/lib/types";

/**
 * Minimal fake EventSource for the one Watchlist-container test that needs a
 * real provider. A second, independent copy of the fake established in
 * usePriceStream.test.tsx (01-02) — not yet worth extracting into a shared
 * helper per this plan's own read_first guidance ("a local copy is fine"
 * unless this would be the third copy).
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  fireMessage(data: unknown) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
}

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

function renderRow(props: { ticker: string; tick?: PriceTick }) {
  return render(
    <table>
      <tbody>
        <WatchlistRow ticker={props.ticker} tick={props.tick} />
      </tbody>
    </table>,
  );
}

describe("WatchlistRow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the ticker symbol and an em dash in both the price and percentage cells when no tick has arrived", () => {
    renderRow({ ticker: "AAPL" });

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("price-AAPL")).toHaveTextContent("—");
    expect(screen.getByTestId("change-AAPL")).toHaveTextContent("—");
  });

  it("renders the price and a signed percentage through the shared formatters once a tick arrives", () => {
    renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 191.5, 2.34) });

    expect(screen.getByTestId("price-AAPL")).toHaveTextContent("191.50");
    expect(screen.getByTestId("change-AAPL")).toHaveTextContent("+2.34%");
  });

  it("applies the flash-up class to the price cell when the price rises on rerender", () => {
    const { rerender } = renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 190.0) });

    rerender(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" tick={makeTick("AAPL", 191.0)} />
        </tbody>
      </table>,
    );

    expect(screen.getByTestId("price-AAPL").classList.contains("flash-up")).toBe(true);
  });

  it("applies the flash-down class to the price cell when the price falls on rerender", () => {
    const { rerender } = renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 190.0) });

    rerender(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" tick={makeTick("AAPL", 189.0)} />
        </tbody>
      </table>,
    );

    expect(screen.getByTestId("price-AAPL").classList.contains("flash-down")).toBe(true);
  });

  it("clears the flash class from the price cell roughly 550ms after the change", () => {
    vi.useFakeTimers();
    const { rerender } = renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 190.0) });

    act(() => {
      rerender(
        <table>
          <tbody>
            <WatchlistRow ticker="AAPL" tick={makeTick("AAPL", 191.0)} />
          </tbody>
        </table>,
      );
    });
    expect(screen.getByTestId("price-AAPL").classList.contains("flash-up")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(550);
    });

    const priceCell = screen.getByTestId("price-AAPL");
    expect(priceCell.classList.contains("flash-up")).toBe(false);
    expect(priceCell.classList.contains("flash-down")).toBe(false);
  });

  it("applies neither flash class when the price is unchanged on rerender", () => {
    const { rerender } = renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 190.0) });

    rerender(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" tick={makeTick("AAPL", 190.0)} />
        </tbody>
      </table>,
    );

    const priceCell = screen.getByTestId("price-AAPL");
    expect(priceCell.classList.contains("flash-up")).toBe(false);
    expect(priceCell.classList.contains("flash-down")).toBe(false);
  });

  it("colours the percentage cell with the up token when the session change is positive", () => {
    renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 190.0, 1.2) });

    expect(
      screen.getByTestId("change-AAPL").classList.contains("text-[var(--color-up)]"),
    ).toBe(true);
  });

  it("colours the percentage cell with the down token when the session change is negative", () => {
    renderRow({ ticker: "AAPL", tick: makeTick("AAPL", 190.0, -1.2) });

    expect(
      screen.getByTestId("change-AAPL").classList.contains("text-[var(--color-down)]"),
    ).toBe(true);
  });
});

describe("Watchlist", () => {
  it("renders exactly ten rows when the shared stream reports ten tickers", () => {
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    const source = FakeEventSource.instances[0];
    const tickers = [
      "AAPL",
      "GOOGL",
      "MSFT",
      "AMZN",
      "TSLA",
      "NVDA",
      "META",
      "JPM",
      "V",
      "NFLX",
    ];
    act(() => {
      source.fireMessage(
        Object.fromEntries(tickers.map((t) => [t, makeTick(t, 100)])),
      );
    });

    // Body rows carry role="button" (WatchlistRow, plan 01-05, MKT-04
    // keyboard-activatable selection) which overrides their implicit "row"
    // role, so the header row is the only remaining "row"-role element and
    // the ten body rows are queried as buttons instead.
    expect(screen.getAllByRole("row")).toHaveLength(1); // header row only
    expect(screen.getAllByRole("button")).toHaveLength(tickers.length);
  });
});

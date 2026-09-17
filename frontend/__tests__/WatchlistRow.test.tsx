import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { PriceStreamProvider, type PriceStreamState } from "@/context/PriceStreamContext";
import { WatchlistRow } from "@/components/watchlist/WatchlistRow";
import type { WatchlistEntry } from "@/lib/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const baseEntry: WatchlistEntry = {
  ticker: "AAPL",
  added_at: "2026-09-17T19:00:00.000Z",
  price: 190.5,
  previous_price: 189.8,
  change: 0.7,
  change_percent: 0.37,
  direction: "up",
};

function renderRow(entry: WatchlistEntry, streamState?: PriceStreamState) {
  return render(
    <PriceStreamProvider value={streamState}>
      <WatchlistRow entry={entry} selected={false} onSelect={() => {}} onRemove={() => {}} />
    </PriceStreamProvider>,
  );
}

describe("WatchlistRow price flash", () => {
  it("applies flash-up class briefly when the live price ticks upward", () => {
    vi.useFakeTimers();

    const stream: PriceStreamState = {
      status: "connected",
      latest: {
        AAPL: {
          ticker: "AAPL",
          price: 190.5,
          previous_price: 189.8,
          timestamp: 1737310000,
          change: 0.7,
          change_percent: 0.37,
          direction: "up",
        },
      },
      history: {
        AAPL: [
          { ticker: "AAPL", price: 189.8, previous_price: 189.0, timestamp: 1737309999, change: 0.8, change_percent: 0.42, direction: "up" },
        ],
      },
    };

    const { rerender } = renderRow(baseEntry, stream);
    const cell = screen.getByText("190.50");
    expect(cell.className).not.toMatch(/flash-up/);

    const nextStream: PriceStreamState = {
      ...stream,
      latest: {
        AAPL: { ...stream.latest.AAPL, price: 192.0, previous_price: 190.5, change: 1.5, change_percent: 0.79 },
      },
    };

    rerender(
      <PriceStreamProvider value={nextStream}>
        <WatchlistRow entry={baseEntry} selected={false} onSelect={() => {}} onRemove={() => {}} />
      </PriceStreamProvider>,
    );

    const updatedCell = screen.getByText("192.00");
    expect(updatedCell.className).toMatch(/flash-up/);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(updatedCell.className).not.toMatch(/flash-up/);
  });

  it("applies flash-down class when the live price ticks downward", () => {
    vi.useFakeTimers();

    const stream: PriceStreamState = {
      status: "connected",
      latest: {
        AAPL: {
          ticker: "AAPL",
          price: 190.5,
          previous_price: 189.8,
          timestamp: 1737310000,
          change: 0.7,
          change_percent: 0.37,
          direction: "up",
        },
      },
      history: {},
    };

    const { rerender } = render(
      <PriceStreamProvider value={stream}>
        <WatchlistRow entry={baseEntry} selected={false} onSelect={() => {}} onRemove={() => {}} />
      </PriceStreamProvider>,
    );

    const nextStream: PriceStreamState = {
      ...stream,
      latest: {
        AAPL: { ...stream.latest.AAPL, price: 188.0, previous_price: 190.5, change: -2.5, change_percent: -1.3, direction: "down" },
      },
    };

    rerender(
      <PriceStreamProvider value={nextStream}>
        <WatchlistRow entry={baseEntry} selected={false} onSelect={() => {}} onRemove={() => {}} />
      </PriceStreamProvider>,
    );

    const cell = screen.getByText("188.00");
    expect(cell.className).toMatch(/flash-down/);
  });

  it("renders ticker, price, and signed change percent as text (not color alone)", () => {
    renderRow(baseEntry);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("190.50")).toBeInTheDocument();
    expect(screen.getByText("+0.37%")).toBeInTheDocument();
  });
});

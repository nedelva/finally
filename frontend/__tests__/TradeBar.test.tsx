import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TradeBar } from "@/components/TradeBar";
import { postTrade } from "@/lib/api";
import type { TradeResponse, WatchlistEntry } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  postTrade: vi.fn(),
}));

function makeEntry(ticker: string): WatchlistEntry {
  return {
    ticker,
    added_at: "2026-09-20T00:00:00.000Z",
    price: null,
    previous_price: null,
    change: null,
    change_percent: null,
    direction: "flat",
  };
}

describe("TradeBar", () => {
  afterEach(() => {
    vi.mocked(postTrade).mockReset();
  });

  it("renders one option per watchlist entry, with the first entry initially selected", () => {
    render(<TradeBar watchlist={[makeEntry("AAPL"), makeEntry("MSFT")]} onFilled={vi.fn()} />);

    const select = screen.getByTestId("trade-bar-ticker") as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe("AAPL");
  });

  it("disables the ticker select and both buttons and shows the empty-watchlist hint", () => {
    render(<TradeBar watchlist={[]} onFilled={vi.fn()} />);

    expect(screen.getByTestId("trade-bar-ticker")).toBeDisabled();
    expect(screen.getByTestId("trade-bar-buy")).toBeDisabled();
    expect(screen.getByTestId("trade-bar-sell")).toBeDisabled();
    expect(screen.getByText("Add a ticker to your watchlist to start trading.")).toBeInTheDocument();
  });

  it("keeps both buttons disabled while quantity is blank, and enables them once positive", async () => {
    const user = userEvent.setup();
    render(<TradeBar watchlist={[makeEntry("AAPL")]} onFilled={vi.fn()} />);

    expect(screen.getByTestId("trade-bar-buy")).toBeDisabled();
    expect(screen.getByTestId("trade-bar-sell")).toBeDisabled();

    await user.type(screen.getByTestId("trade-bar-quantity"), "1.5");

    expect(screen.getByTestId("trade-bar-buy")).not.toBeDisabled();
    expect(screen.getByTestId("trade-bar-sell")).not.toBeDisabled();
  });

  it("calls postTrade once with the parsed numeric quantity on Buy", async () => {
    const user = userEvent.setup();
    vi.mocked(postTrade).mockResolvedValue({
      ok: true,
      data: {
        success: true,
        trade: {
          id: "t1",
          ticker: "AAPL",
          side: "buy",
          quantity: 1.5,
          price: 190.32,
          executed_at: "2026-09-20T00:00:00.000Z",
        },
        portfolio: { cash_balance: 0, positions: [], total_value: 0, total_unrealized_pnl: 0 },
      },
    });
    render(<TradeBar watchlist={[makeEntry("AAPL")]} onFilled={vi.fn()} />);

    await user.type(screen.getByTestId("trade-bar-quantity"), "1.5");
    await user.click(screen.getByTestId("trade-bar-buy"));

    await waitFor(() =>
      expect(postTrade).toHaveBeenCalledWith({ ticker: "AAPL", side: "buy", quantity: 1.5 }),
    );
  });

  it("disables both buttons and labels the pressed one 'Buying...' while in flight", async () => {
    const user = userEvent.setup();
    let resolvePromise!: (value: { ok: true; data: TradeResponse }) => void;
    vi.mocked(postTrade).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    render(<TradeBar watchlist={[makeEntry("AAPL")]} onFilled={vi.fn()} />);

    await user.type(screen.getByTestId("trade-bar-quantity"), "1.5");
    await user.click(screen.getByTestId("trade-bar-buy"));

    expect(screen.getByTestId("trade-bar-buy")).toBeDisabled();
    expect(screen.getByTestId("trade-bar-buy")).toHaveTextContent("Buying...");
    expect(screen.getByTestId("trade-bar-sell")).toBeDisabled();

    // Resolve with a rejected trade (quantity is NOT cleared on failure, per
    // D-08) so this test isolates the in-flight->resolved transition without
    // conflating it with the separate clear-on-success behavior below.
    resolvePromise({
      ok: true,
      data: { success: false, error: "Insufficient cash for this trade. Lower the quantity and try again." },
    });
    await waitFor(() => expect(screen.getByTestId("trade-bar-buy")).not.toBeDisabled());
  });

  describe("with fake timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears quantity and shows a fading confirmation on success, using the server-returned price", async () => {
      // fireEvent (not userEvent) here — userEvent's internal per-keystroke
      // timers conflict with vi.useFakeTimers(), which this test needs for
      // the fade-timeout assertion below.
      vi.mocked(postTrade).mockResolvedValue({
        ok: true,
        data: {
          success: true,
          trade: {
            id: "t1",
            ticker: "AAPL",
            side: "buy",
            quantity: 1.5,
            price: 190.32,
            executed_at: "2026-09-20T00:00:00.000Z",
          },
          portfolio: { cash_balance: 0, positions: [], total_value: 0, total_unrealized_pnl: 0 },
        },
      });
      const onFilled = vi.fn();
      render(<TradeBar watchlist={[makeEntry("AAPL")]} onFilled={onFilled} />);

      const quantityInput = screen.getByTestId("trade-bar-quantity") as HTMLInputElement;
      fireEvent.change(quantityInput, { target: { value: "1.5" } });
      await act(async () => {
        fireEvent.click(screen.getByTestId("trade-bar-buy"));
      });

      expect(screen.getByTestId("trade-bar-confirmation")).toHaveTextContent(
        "Bought 1.5 AAPL @ $190.32",
      );
      expect(quantityInput.value).toBe("");
      expect(onFilled).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(2600);
      });

      expect(screen.getByTestId("trade-bar-confirmation")).toHaveTextContent("");
    });
  });

  it("renders the server error and preserves the entered quantity on a success:false response", async () => {
    const user = userEvent.setup();
    vi.mocked(postTrade).mockResolvedValue({
      ok: true,
      data: { success: false, error: "Insufficient cash for this trade. Lower the quantity and try again." },
    });
    render(<TradeBar watchlist={[makeEntry("AAPL")]} onFilled={vi.fn()} />);

    const quantityInput = screen.getByTestId("trade-bar-quantity") as HTMLInputElement;
    await user.type(quantityInput, "1000");
    await user.click(screen.getByTestId("trade-bar-buy"));

    await waitFor(() =>
      expect(screen.getByTestId("trade-bar-error")).toHaveTextContent(
        "Insufficient cash for this trade. Lower the quantity and try again.",
      ),
    );
    expect(quantityInput.value).toBe("1000");
  });
});

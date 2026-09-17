import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TradeBar } from "@/components/trade/TradeBar";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TradeBar", () => {
  it("shows the inline validation error from a 400 response (success:false), not a thrown error", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: "Insufficient cash: need $1905.00, have $500.00" }),
    });
    const onTraded = vi.fn();

    render(<TradeBar defaultTicker="AAPL" onTraded={onTraded} />);
    await user.click(screen.getByText("Buy"));

    expect(await screen.findByText(/Insufficient cash/)).toBeInTheDocument();
    expect(onTraded).not.toHaveBeenCalled();
  });

  it("shows a success confirmation and calls onTraded after a successful buy", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        trade: { id: "1", ticker: "AAPL", side: "buy", quantity: 10, price: 190.5, executed_at: "2026-09-17T20:15:00.000Z" },
        portfolio: { cash_balance: 8095, positions: [], total_value: 8095, total_unrealized_pnl: 0 },
      }),
    });
    const onTraded = vi.fn();

    render(<TradeBar defaultTicker="AAPL" onTraded={onTraded} />);
    const qtyInput = screen.getByLabelText("Trade quantity");
    await user.clear(qtyInput);
    await user.type(qtyInput, "10");
    await user.click(screen.getByText("Buy"));

    expect(await screen.findByText(/Bought 10 AAPL/)).toBeInTheDocument();
    expect(onTraded).toHaveBeenCalled();
  });
});

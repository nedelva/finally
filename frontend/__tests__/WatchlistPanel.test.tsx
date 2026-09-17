import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceStreamProvider } from "@/context/PriceStreamContext";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import type { WatchlistEntry } from "@/lib/types";

const entries: WatchlistEntry[] = [
  {
    ticker: "AAPL",
    added_at: "2026-09-17T19:00:00.000Z",
    price: 190.5,
    previous_price: 189.8,
    change: 0.7,
    change_percent: 0.37,
    direction: "up",
  },
];

function renderPanel(refetch = vi.fn()) {
  return render(
    <PriceStreamProvider value={{ status: "connected", latest: {}, history: {} }}>
      <WatchlistPanel
        watchlist={entries}
        loading={false}
        error={null}
        selectedTicker="AAPL"
        onSelect={() => {}}
        refetch={refetch}
      />
    </PriceStreamProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WatchlistPanel", () => {
  it("calls POST /api/watchlist with the uppercased ticker when adding", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ticker: "PYPL", added_at: "2026-09-17T19:00:00.000Z" }),
    });
    const refetch = vi.fn();
    renderPanel(refetch);

    await user.type(screen.getByLabelText("Add ticker to watchlist"), "pypl");
    await user.click(screen.getByText("+"));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/watchlist",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ticker: "PYPL" }),
      }),
    ));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("shows the server error inline and does not refetch when adding fails", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "PYPL is already on the watchlist" }),
    });
    const refetch = vi.fn();
    renderPanel(refetch);

    await user.type(screen.getByLabelText("Add ticker to watchlist"), "PYPL");
    await user.click(screen.getByText("+"));

    expect(await screen.findByText("PYPL is already on the watchlist")).toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("calls DELETE /api/watchlist/{ticker} when removing a row", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    });
    const refetch = vi.fn();
    renderPanel(refetch);

    await user.click(screen.getByLabelText("Remove AAPL from watchlist"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/watchlist/AAPL", expect.objectContaining({ method: "DELETE" })),
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});

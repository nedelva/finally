import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { Watchlist } from "@/components/Watchlist";
import { WatchlistRow } from "@/components/WatchlistRow";
import { addWatchlistTicker, removeWatchlistTicker } from "@/lib/api";
import { PriceStreamProvider } from "@/lib/PriceStreamContext";
import { useWatchlist } from "@/lib/hooks";
import type { PriceTick, WatchlistEntry } from "@/lib/types";

// First vi.mock of a hook module in this project (no existing precedent to
// match) — the idiomatic Vitest way to substitute useWatchlist()'s REST
// response so row membership can be asserted independently of the SSE
// stream's ever-growing ticker set.
vi.mock("@/lib/hooks", () => ({
  useWatchlist: vi.fn(),
}));

// Second, independent mock (of lib/api rather than lib/hooks) — the
// add-ticker form calls addWatchlistTicker() directly, not through a hook,
// so each test controls its resolved/rejected ApiResult independently. The
// remove affordance (02-03) calls removeWatchlistTicker() the same way.
vi.mock("@/lib/api", () => ({
  addWatchlistTicker: vi.fn(),
  removeWatchlistTicker: vi.fn(),
}));

function makeEntry(ticker: string): WatchlistEntry {
  return {
    ticker,
    added_at: "2026-09-18T00:00:00.000Z",
    price: null,
    previous_price: null,
    change: null,
    change_percent: null,
    direction: "flat",
  };
}

function mockUseWatchlist(
  entries: WatchlistEntry[],
  refetch: () => Promise<void> = vi.fn(async () => {}),
) {
  vi.mocked(useWatchlist).mockReturnValue({
    watchlist: entries,
    loading: false,
    error: null,
    refetch,
  });
  // Hoisted so callers can assert call count — a fresh vi.fn() built inside
  // this helper on every invocation (the prior shape) can never be asserted
  // against by the caller.
  return refetch;
}

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

describe("WatchlistRow remove affordance", () => {
  it("renders a remove button with the correct data-testid and aria-label", () => {
    renderRow({ ticker: "AAPL" });

    const button = screen.getByTestId("remove-AAPL");
    expect(button).toHaveAttribute("aria-label", "Remove AAPL from watchlist");
  });

  it("calls onRemove with the ticker when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" onRemove={onRemove} />
        </tbody>
      </table>,
    );

    await user.click(screen.getByTestId("remove-AAPL"));

    expect(onRemove).toHaveBeenCalledWith("AAPL");
  });

  it("does not fire the row's onSelect when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    render(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" onSelect={onSelect} onRemove={onRemove} />
        </tbody>
      </table>,
    );

    await user.click(screen.getByTestId("remove-AAPL"));

    expect(onRemove).toHaveBeenCalledWith("AAPL");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("still fires onSelect when clicking elsewhere in the row", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" onSelect={onSelect} />
        </tbody>
      </table>,
    );

    await user.click(screen.getByText("AAPL"));

    expect(onSelect).toHaveBeenCalledWith("AAPL");
  });

  it("does not fire the row's onSelect when the remove button is activated via keyboard", async () => {
    // Regression test for WR-02: the <tr>'s onKeyDown (Enter/Space ->
    // select()) is attached via React's delegated bubbling, so pressing
    // Enter/Space while focused on the nested remove button used to also
    // fire the row's select() unless the button itself stopped propagation.
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    render(
      <table>
        <tbody>
          <WatchlistRow ticker="AAPL" onSelect={onSelect} onRemove={onRemove} />
        </tbody>
      </table>,
    );

    const button = screen.getByTestId("remove-AAPL");
    button.focus();
    await user.keyboard("{Enter}");

    expect(onRemove).toHaveBeenCalledWith("AAPL");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Watchlist", () => {
  afterEach(() => {
    vi.mocked(useWatchlist).mockReset();
  });

  it("renders exactly ten rows when useWatchlist() returns ten entries", () => {
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];

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
    mockUseWatchlist(tickers.map(makeEntry));

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    // Body rows keep their native/implicit "row" role (WatchlistRow, plan
    // 01-05, MKT-04 keyboard-activatable selection uses tabIndex + key
    // handlers rather than role="button", preserving table semantics for
    // assistive tech) — header row + ten body rows all report as "row".
    expect(screen.getAllByRole("row")).toHaveLength(1 + tickers.length);
  });

  it("renders exactly three rows when useWatchlist() returns three entries, even after the stream has reported ten tickers", () => {
    // This is the membership-source regression guard: row count must follow
    // the REST response, never the SSE-derived ticker set (which only ever
    // grows and cannot shrink on removal).
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];

    mockUseWatchlist(["AAPL", "GOOGL", "MSFT"].map(makeEntry));

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    const source = FakeEventSource.instances[0];
    const tenTickers = [
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
        Object.fromEntries(tenTickers.map((t) => [t, makeTick(t, 100)])),
      );
    });

    expect(screen.getAllByRole("row")).toHaveLength(1 + 3);
  });

  it("still renders a row for an entry with no corresponding tick in the stream", () => {
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];

    mockUseWatchlist([makeEntry("PYPL")]);

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    expect(screen.getByText("PYPL")).toBeInTheDocument();
    expect(screen.getByTestId("price-PYPL")).toHaveTextContent("—");
  });

  it("renders five header cells, matching each body row's five cells", () => {
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];

    mockUseWatchlist([makeEntry("AAPL")]);

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    const headerRow = screen.getAllByRole("row")[0];
    expect(within(headerRow).getAllByRole("columnheader")).toHaveLength(5);
  });

  it("renders the empty state and keeps the add-ticker form visible when there are no entries", () => {
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];

    mockUseWatchlist([]);

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    const empty = screen.getByTestId("watchlist-empty");
    expect(empty).toHaveTextContent("Watchlist is empty");
    expect(empty).toHaveTextContent("Add a ticker above to start streaming its price.");
    expect(screen.getByTestId("watchlist-add-form")).toBeInTheDocument();
  });
});

describe("Watchlist remove wiring", () => {
  afterEach(() => {
    vi.mocked(useWatchlist).mockReset();
    vi.mocked(removeWatchlistTicker).mockReset();
  });

  it("calls removeWatchlistTicker with the row's ticker and refetch on success, without firing onSelect", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    vi.mocked(removeWatchlistTicker).mockResolvedValue({ ok: true, data: null });
    const onSelect = vi.fn();
    const refetch = mockUseWatchlist([makeEntry("AAPL")]);

    render(
      <PriceStreamProvider>
        <Watchlist onSelect={onSelect} />
      </PriceStreamProvider>,
    );

    await user.click(screen.getByTestId("remove-AAPL"));

    await waitFor(() => expect(removeWatchlistTicker).toHaveBeenCalledWith("AAPL"));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call refetch when removeWatchlistTicker resolves not-ok", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    vi.mocked(removeWatchlistTicker).mockResolvedValue({
      ok: false,
      error: "Network error — unable to reach the server.",
    });
    const refetch = mockUseWatchlist([makeEntry("AAPL")]);

    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );

    await user.click(screen.getByTestId("remove-AAPL"));

    await waitFor(() => expect(removeWatchlistTicker).toHaveBeenCalledWith("AAPL"));
    expect(refetch).not.toHaveBeenCalled();
  });
});

describe("Page selection guard on watchlist removal", () => {
  afterEach(() => {
    vi.mocked(useWatchlist).mockReset();
  });

  it("moves the chart selection to the first remaining ticker when the selected ticker leaves the watchlist", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    mockUseWatchlist([makeEntry("AAPL"), makeEntry("GOOGL")]);

    const { rerender } = render(<Page />);

    await user.click(screen.getByTestId("row-AAPL"));
    expect(screen.getByTestId("row-AAPL")).toHaveAttribute("aria-selected", "true");

    mockUseWatchlist([makeEntry("GOOGL")]);
    rerender(<Page />);

    await waitFor(() =>
      expect(screen.getByTestId("row-GOOGL")).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("clears the selection when the watchlist becomes empty", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    mockUseWatchlist([makeEntry("AAPL")]);

    const { rerender } = render(<Page />);

    await user.click(screen.getByTestId("row-AAPL"));
    expect(screen.getByTestId("row-AAPL")).toHaveAttribute("aria-selected", "true");

    mockUseWatchlist([]);
    rerender(<Page />);

    await waitFor(() => expect(screen.getByTestId("watchlist-empty")).toBeInTheDocument());
  });

  it("settles into a stable empty state, without an infinite selection loop, when the last ticker is removed after it has already streamed a price", async () => {
    // Regression test for CR-01: `tickers` (SSE-derived) only ever grows,
    // while `watchlistTickers` (REST-derived) can shrink to empty. A prior
    // two-effect implementation ping-ponged forever in exactly this
    // sequence — select a ticker that has already ticked over SSE, then
    // remove it as the watchlist's last entry — because the "auto-select
    // first available" effect kept re-selecting it from the still-nonempty
    // `tickers` set. A regressed version would throw "Maximum update depth
    // exceeded" here rather than resolve this waitFor.
    const user = userEvent.setup();
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    mockUseWatchlist([makeEntry("AAPL")]);

    const { rerender } = render(<Page />);

    const source = FakeEventSource.instances[0];
    act(() => {
      source.fireMessage({ AAPL: makeTick("AAPL", 190.0) });
    });

    await user.click(screen.getByTestId("row-AAPL"));
    expect(screen.getByTestId("row-AAPL")).toHaveAttribute("aria-selected", "true");

    mockUseWatchlist([]);
    rerender(<Page />);

    await waitFor(() => expect(screen.getByTestId("watchlist-empty")).toBeInTheDocument());
    // Give any residual ping-pong a chance to surface before asserting the
    // final state is durable, not merely transiently reached.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("watchlist-empty")).toBeInTheDocument();
  });

  it("does not change the selection when the selected ticker is still in the watchlist", async () => {
    const user = userEvent.setup();
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    mockUseWatchlist([makeEntry("AAPL"), makeEntry("GOOGL")]);

    const { rerender } = render(<Page />);

    await user.click(screen.getByTestId("row-AAPL"));
    expect(screen.getByTestId("row-AAPL")).toHaveAttribute("aria-selected", "true");

    // Same entries, new array reference — selection must not move.
    mockUseWatchlist([makeEntry("AAPL"), makeEntry("GOOGL")]);
    rerender(<Page />);

    await waitFor(() =>
      expect(screen.getByTestId("row-AAPL")).toHaveAttribute("aria-selected", "true"),
    );
  });
});

describe("Watchlist add-ticker form", () => {
  afterEach(() => {
    vi.mocked(useWatchlist).mockReset();
    vi.mocked(addWatchlistTicker).mockReset();
  });

  function setup(entries: WatchlistEntry[] = []) {
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
    FakeEventSource.instances = [];
    const refetch = mockUseWatchlist(entries);
    render(
      <PriceStreamProvider>
        <Watchlist />
      </PriceStreamProvider>,
    );
    return { refetch };
  }

  it("renders the add-ticker form with the exact placeholder and button label", () => {
    setup();

    expect(screen.getByTestId("watchlist-add-form")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add ticker (e.g. PYPL)")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-add-submit")).toHaveTextContent("Add Ticker");
  });

  it("calls addWatchlistTicker with the typed value, then refetch, on a valid submit", async () => {
    const user = userEvent.setup();
    vi.mocked(addWatchlistTicker).mockResolvedValue({
      ok: true,
      data: { ticker: "PYPL", added_at: "2026-09-18T00:00:00.000Z" },
    });
    const { refetch } = setup();

    await user.type(screen.getByTestId("watchlist-add-input"), "PYPL");
    await user.click(screen.getByTestId("watchlist-add-submit"));

    await waitFor(() => expect(addWatchlistTicker).toHaveBeenCalledWith("PYPL"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders the empty-submission error and does not call addWatchlistTicker for an empty submit", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByTestId("watchlist-add-submit"));

    expect(screen.getByTestId("watchlist-add-error")).toHaveTextContent(
      "Enter a ticker symbol to add it.",
    );
    expect(addWatchlistTicker).not.toHaveBeenCalled();
  });

  it("renders the empty-submission error and does not call addWatchlistTicker for whitespace-only input", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByTestId("watchlist-add-input"), "   ");
    await user.click(screen.getByTestId("watchlist-add-submit"));

    expect(screen.getByTestId("watchlist-add-error")).toHaveTextContent(
      "Enter a ticker symbol to add it.",
    );
    expect(addWatchlistTicker).not.toHaveBeenCalled();
  });

  it("renders the server error verbatim and does not call refetch when addWatchlistTicker resolves not-ok", async () => {
    const user = userEvent.setup();
    vi.mocked(addWatchlistTicker).mockResolvedValue({
      ok: false,
      error: "TOOLONG isn't a valid ticker — use 1-5 letters or numbers, like AAPL.",
    });
    const { refetch } = setup();

    await user.type(screen.getByTestId("watchlist-add-input"), "TOOLONG");
    await user.click(screen.getByTestId("watchlist-add-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("watchlist-add-error")).toHaveTextContent(
        "TOOLONG isn't a valid ticker — use 1-5 letters or numbers, like AAPL.",
      ),
    );
    expect(refetch).not.toHaveBeenCalled();
  });

  it("disables the submit button and input, and labels the button Adding…, while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolvePromise!: (value: {
      ok: true;
      data: { ticker: string; added_at: string };
    }) => void;
    vi.mocked(addWatchlistTicker).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    setup();

    await user.type(screen.getByTestId("watchlist-add-input"), "PYPL");
    await user.click(screen.getByTestId("watchlist-add-submit"));

    expect(screen.getByTestId("watchlist-add-submit")).toBeDisabled();
    expect(screen.getByTestId("watchlist-add-submit")).toHaveTextContent("Adding…");
    expect(screen.getByTestId("watchlist-add-input")).toBeDisabled();

    resolvePromise({ ok: true, data: { ticker: "PYPL", added_at: "2026-09-18T00:00:00.000Z" } });
    await waitFor(() => expect(screen.getByTestId("watchlist-add-submit")).not.toBeDisabled());
  });

  it("clears the input and the error slot after a successful add", async () => {
    const user = userEvent.setup();
    vi.mocked(addWatchlistTicker).mockResolvedValue({
      ok: true,
      data: { ticker: "PYPL", added_at: "2026-09-18T00:00:00.000Z" },
    });
    setup();

    const input = screen.getByTestId("watchlist-add-input") as HTMLInputElement;
    await user.type(input, "PYPL");
    await user.click(screen.getByTestId("watchlist-add-submit"));

    await waitFor(() => expect(input.value).toBe(""));
    expect(screen.getByTestId("watchlist-add-error")).toHaveTextContent("");
  });
});

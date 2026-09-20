import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRICE_HISTORY_LIMIT, usePriceStream } from "@/lib/usePriceStream";

/**
 * Minimal fake EventSource — records every constructed instance so tests can
 * assert single-connection invariants (mount/unmount/remount under React 19
 * StrictMode double-invocation), and exposes helpers to fire the three
 * events usePriceStream wires: open, error, and message.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  url: string;
  readyState = 0; // CONNECTING
  closeSpy = vi.fn();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
    this.closeSpy();
  }

  fireOpen() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  fireError() {
    this.onerror?.();
  }

  fireMessage(data: unknown) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
}

function tick(ticker: string, price: number) {
  return {
    [ticker]: {
      ticker,
      price,
      previous_price: price,
      timestamp: Date.now() / 1000,
      change: 0,
      change_percent: 0,
      direction: "flat",
    },
  };
}

// Number of instances still open (constructed but not yet closed) — the
// invariant the single-connection behaviours below assert on.
function openInstanceCount(): number {
  return FakeEventSource.instances.filter((s) => s.closeSpy.mock.calls.length === 0).length;
}

describe("usePriceStream", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    // @ts-expect-error -- test double, not a full EventSource implementation
    global.EventSource = FakeEventSource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens exactly one EventSource against /api/stream/prices on mount, and closes it on unmount", () => {
    const { unmount } = renderHook(() => usePriceStream());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/stream/prices");

    unmount();

    expect(FakeEventSource.instances[0].closeSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves exactly one unclosed EventSource across a mount, unmount, remount cycle", () => {
    const { unmount } = renderHook(() => usePriceStream());
    unmount();
    renderHook(() => usePriceStream());

    expect(openInstanceCount()).toBe(1);
  });

  it("is connecting before the first open event", () => {
    const { result } = renderHook(() => usePriceStream());
    expect(result.current.status).toBe("connecting");
  });

  it("is connected after the open event fires", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireOpen();
    });

    expect(result.current.status).toBe("connected");
  });

  it("is reconnecting when an error arrives while the connection is retrying", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireOpen();
      source.readyState = FakeEventSource.CONNECTING;
      source.fireError();
    });

    expect(result.current.status).toBe("reconnecting");
  });

  it("populates the latest-tick map for every ticker key in a message", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireMessage({ ...tick("AAPL", 190), ...tick("GOOGL", 175) });
    });

    expect(result.current.ticks.AAPL.price).toBe(190);
    expect(result.current.ticks.GOOGL.price).toBe(175);
    expect(result.current.tickers).toEqual(["AAPL", "GOOGL"]);
  });

  it("appends one history point per ticker per message, in arrival order", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireMessage(tick("AAPL", 190));
    });
    act(() => {
      source.fireMessage(tick("AAPL", 191));
    });

    expect(result.current.history.AAPL.map((p) => p.price)).toEqual([190, 191]);
  });

  it("appends both points when two consecutive messages carry an identical price", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireMessage(tick("AAPL", 190));
    });
    act(() => {
      source.fireMessage(tick("AAPL", 190));
    });

    expect(result.current.history.AAPL).toHaveLength(2);
  });

  it("caps history at PRICE_HISTORY_LIMIT points", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    for (let i = 0; i < PRICE_HISTORY_LIMIT; i++) {
      act(() => {
        source.fireMessage(tick("AAPL", 100 + i));
      });
    }

    expect(result.current.history.AAPL).toHaveLength(PRICE_HISTORY_LIMIT);
  });

  it("evicts the oldest point and keeps the newest one past the limit", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    for (let i = 0; i < PRICE_HISTORY_LIMIT; i++) {
      act(() => {
        source.fireMessage(tick("AAPL", 100 + i));
      });
    }
    act(() => {
      source.fireMessage(tick("AAPL", 999));
    });

    expect(result.current.history.AAPL).toHaveLength(PRICE_HISTORY_LIMIT);
    expect(result.current.history.AAPL[0].price).toBe(101);
    expect(result.current.history.AAPL[PRICE_HISTORY_LIMIT - 1].price).toBe(999);
  });

  it("leaves the previous state intact when a message carries malformed JSON", () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireMessage(tick("AAPL", 190));
    });
    expect(() => {
      act(() => {
        source.fireMessage("{not valid json");
      });
    }).not.toThrow();

    expect(result.current.ticks.AAPL.price).toBe(190);
    expect(result.current.history.AAPL).toHaveLength(1);
  });

  it("waits for a real status transition (sanity check the hook is reactive, not a static stub)", async () => {
    const { result } = renderHook(() => usePriceStream());
    const source = FakeEventSource.instances[0];

    act(() => {
      source.fireOpen();
    });

    await waitFor(() => expect(result.current.status).toBe("connected"));
  });
});

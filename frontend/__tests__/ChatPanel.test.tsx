import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "@/components/chat/ChatPanel";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChatPanel", () => {
  it("renders the greeting message on mount", () => {
    render(<ChatPanel collapsed={false} onToggleCollapsed={() => {}} onActionsExecuted={() => {}} />);
    expect(screen.getByText(/I'm FinAlly/)).toBeInTheDocument();
  });

  it("shows a loading indicator while POST /api/chat is in flight, then renders the reply", async () => {
    const user = userEvent.setup();
    let resolveFetch: (v: unknown) => void = () => {};
    (fetch as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<ChatPanel collapsed={false} onToggleCollapsed={() => {}} onActionsExecuted={() => {}} />);

    await user.type(screen.getByLabelText("Chat message"), "What's my biggest position?");
    await user.click(screen.getByText("Send"));

    expect(screen.getByTestId("chat-loading")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        message: "Your biggest position is AAPL.",
        trades: [],
        watchlist_changes: [],
      }),
    });

    await waitFor(() => expect(screen.queryByTestId("chat-loading")).not.toBeInTheDocument());
    expect(await screen.findByText("Your biggest position is AAPL.")).toBeInTheDocument();
  });

  it("renders executed trade and watchlist action chips with status", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        message: "Done — bought AAPL and added PYPL.",
        trades: [{ ticker: "AAPL", side: "buy", quantity: 10, status: "executed", price: 190.5, error: null }],
        watchlist_changes: [{ ticker: "PYPL", action: "add", status: "executed", error: null }],
      }),
    });
    const onActionsExecuted = vi.fn();

    render(<ChatPanel collapsed={false} onToggleCollapsed={() => {}} onActionsExecuted={onActionsExecuted} />);

    await user.type(screen.getByLabelText("Chat message"), "Buy 10 AAPL and add PYPL");
    await user.click(screen.getByText("Send"));

    expect(await screen.findByText(/Bought 10 AAPL @ \$190\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Added PYPL/)).toBeInTheDocument();
    expect(onActionsExecuted).toHaveBeenCalled();
  });

  it("renders a failed trade chip with its error reason", async () => {
    const user = userEvent.setup();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        message: "Could not buy AAPL.",
        trades: [
          { ticker: "AAPL", side: "buy", quantity: 1000, status: "failed", price: null, error: "Insufficient cash" },
        ],
        watchlist_changes: [],
      }),
    });

    render(<ChatPanel collapsed={false} onToggleCollapsed={() => {}} onActionsExecuted={() => {}} />);

    await user.type(screen.getByLabelText("Chat message"), "Buy 1000 AAPL");
    await user.click(screen.getByText("Send"));

    expect(await screen.findByText(/Insufficient cash/)).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { postChatMessage } from "@/lib/api";
import type { ChatResponse } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  postChatMessage: vi.fn(),
}));

describe("ChatPanel", () => {
  afterEach(() => {
    vi.mocked(postChatMessage).mockReset();
  });

  it("renders the seed greeting as an assistant bubble on first render", () => {
    render(<ChatPanel />);

    expect(
      screen.getByText(
        "Hi, I'm FinAlly. Ask me about your portfolio, or tell me to buy, sell, or update your watchlist.",
      ),
    ).toBeInTheDocument();
  });

  it("disables Send while the input is empty or whitespace-only", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    expect(screen.getByTestId("chat-send")).toBeDisabled();

    await user.type(screen.getByTestId("chat-input"), "   ");
    expect(screen.getByTestId("chat-send")).toBeDisabled();

    await user.type(screen.getByTestId("chat-input"), "hi");
    expect(screen.getByTestId("chat-send")).not.toBeDisabled();
  });

  it("does nothing when the form is submitted with an empty input", () => {
    render(<ChatPanel />);

    const form = screen.getByTestId("chat-input").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(postChatMessage).not.toHaveBeenCalled();
  });

  it("shows the user message and a Thinking bubble while in flight, disabling input and Send", async () => {
    const user = userEvent.setup();
    let resolvePromise!: (value: { ok: true; data: ChatResponse }) => void;
    vi.mocked(postChatMessage).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    render(<ChatPanel />);

    await user.type(screen.getByTestId("chat-input"), "How is my portfolio?");
    await user.click(screen.getByTestId("chat-send"));

    expect(screen.getByText("How is my portfolio?")).toBeInTheDocument();
    expect(screen.getByTestId("chat-thinking")).toHaveTextContent("Thinking…");
    expect(screen.getByTestId("chat-input")).toBeDisabled();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
    expect(screen.getByTestId("chat-send")).toHaveTextContent("Sending…");

    resolvePromise({
      ok: true,
      data: { message: "You have $10,000.00 in cash.", trades: [], watchlist_changes: [] },
    });

    await waitFor(() => expect(screen.queryByTestId("chat-thinking")).not.toBeInTheDocument());
    expect(screen.getByText("You have $10,000.00 in cash.")).toBeInTheDocument();
    // Send is disabled again — the input was cleared on success (empty
    // input), not because the request is still in flight.
    expect(screen.getByTestId("chat-input")).not.toBeDisabled();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("shows the send-failure copy and preserves the typed message on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: false,
      error: "Network error — unable to reach the server.",
    });
    render(<ChatPanel />);

    const input = screen.getByTestId("chat-input") as HTMLInputElement;
    await user.type(input, "buy 10 AAPL");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() =>
      expect(screen.getByTestId("chat-error")).toHaveTextContent(
        "Message not sent — check your connection and try again.",
      ),
    );
    expect(input.value).toBe("buy 10 AAPL");
  });

  it("hides the message list and input when collapsed, and flips the toggle label", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
    expect(screen.getByTestId("chat-toggle")).toHaveTextContent("Hide");

    await user.click(screen.getByTestId("chat-toggle"));

    expect(screen.queryByTestId("chat-messages")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-toggle")).toHaveTextContent("Show");
  });

  async function sendMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.type(screen.getByTestId("chat-input"), text);
    await user.click(screen.getByTestId("chat-send"));
  }

  it("renders one positive pill with the executed-trade copy, formatted through formatMoney", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: true,
      data: {
        message: "Done.",
        trades: [
          { ticker: "AAPL", side: "buy", quantity: 10, status: "executed", price: 190.5, error: null },
        ],
        watchlist_changes: [],
      },
    });
    render(<ChatPanel />);

    await sendMessage(user, "buy 10 aapl");

    await waitFor(() => expect(screen.getAllByTestId("chat-action-pill")).toHaveLength(1));
    const pill = screen.getByTestId("chat-action-pill");
    expect(pill).toHaveAttribute("data-status", "executed");
    expect(pill).toHaveTextContent("Bought 10 AAPL @ $190.50");
  });

  it("renders one destructive pill with the failed-trade copy and the server error verbatim", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: true,
      data: {
        message: "Couldn't do that.",
        trades: [
          {
            ticker: "AAPL",
            side: "sell",
            quantity: 5,
            status: "failed",
            price: null,
            error:
              "You don't own enough shares to sell that many. Lower the quantity and try again.",
          },
        ],
        watchlist_changes: [],
      },
    });
    render(<ChatPanel />);

    await sendMessage(user, "sell 5 aapl");

    await waitFor(() => expect(screen.getAllByTestId("chat-action-pill")).toHaveLength(1));
    const pill = screen.getByTestId("chat-action-pill");
    expect(pill).toHaveAttribute("data-status", "failed");
    expect(pill).toHaveTextContent(
      "Sell AAPL failed — You don't own enough shares to sell that many. Lower the quantity and try again.",
    );
  });

  it("renders positive pills for an executed watchlist add and an executed watchlist remove", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: true,
      data: {
        message: "Done.",
        trades: [],
        watchlist_changes: [
          { ticker: "PLTR", action: "add", status: "executed", error: null },
          { ticker: "AAPL", action: "remove", status: "executed", error: null },
        ],
      },
    });
    render(<ChatPanel />);

    await sendMessage(user, "add pltr and remove aapl");

    await waitFor(() => expect(screen.getAllByTestId("chat-action-pill")).toHaveLength(2));
    const pills = screen.getAllByTestId("chat-action-pill");
    expect(pills[0]).toHaveAttribute("data-status", "executed");
    expect(pills[0]).toHaveTextContent("Added PLTR to watchlist");
    expect(pills[1]).toHaveAttribute("data-status", "executed");
    expect(pills[1]).toHaveTextContent("Removed AAPL from watchlist");
  });

  it("renders destructive pills for a failed watchlist add and a failed watchlist remove, error verbatim", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: true,
      data: {
        message: "Couldn't do that.",
        trades: [],
        watchlist_changes: [
          {
            ticker: "TOOLONG",
            action: "add",
            status: "failed",
            error: "TOOLONG isn't a valid ticker — use 1-5 letters or numbers.",
          },
          {
            ticker: "AAPL",
            action: "remove",
            status: "failed",
            error: "You still hold 2.0 shares of AAPL — sell first.",
          },
        ],
      },
    });
    render(<ChatPanel />);

    await sendMessage(user, "add toolong and remove aapl");

    await waitFor(() => expect(screen.getAllByTestId("chat-action-pill")).toHaveLength(2));
    const pills = screen.getAllByTestId("chat-action-pill");
    expect(pills[0]).toHaveAttribute("data-status", "failed");
    expect(pills[0]).toHaveTextContent(
      "Add TOOLONG failed — TOOLONG isn't a valid ticker — use 1-5 letters or numbers.",
    );
    expect(pills[1]).toHaveAttribute("data-status", "failed");
    expect(pills[1]).toHaveTextContent(
      "Remove AAPL failed — You still hold 2.0 shares of AAPL — sell first.",
    );
  });

  it("renders no pill element when the response carries no actions", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: true,
      data: { message: "Hello.", trades: [], watchlist_changes: [] },
    });
    render(<ChatPanel />);

    await sendMessage(user, "hello");

    await waitFor(() => expect(screen.getByText("Hello.")).toBeInTheDocument());
    expect(screen.queryAllByTestId("chat-action-pill")).toHaveLength(0);
  });

  it("renders watchlist pills before trade pills for a mixed executed/failed turn", async () => {
    const user = userEvent.setup();
    vi.mocked(postChatMessage).mockResolvedValue({
      ok: true,
      data: {
        message: "Added PLTR; the buy failed.",
        trades: [
          {
            ticker: "PLTR",
            side: "buy",
            quantity: 1,
            status: "failed",
            price: null,
            error: "No live price available for PLTR.",
          },
        ],
        watchlist_changes: [{ ticker: "PLTR", action: "add", status: "executed", error: null }],
      },
    });
    render(<ChatPanel />);

    await sendMessage(user, "add pltr and buy 1 pltr");

    await waitFor(() => expect(screen.getAllByTestId("chat-action-pill")).toHaveLength(2));
    const pills = screen.getAllByTestId("chat-action-pill");
    expect(pills[0]).toHaveAttribute("data-status", "executed");
    expect(pills[0]).toHaveTextContent("Added PLTR to watchlist");
    expect(pills[1]).toHaveAttribute("data-status", "failed");
    expect(pills[1]).toHaveTextContent("Buy PLTR failed — No live price available for PLTR.");
  });
});

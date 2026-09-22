import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { getChatHistory, postChatMessage } from "@/lib/api";
import type { ChatHistoryResponse, ChatResponse } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  postChatMessage: vi.fn(),
  getChatHistory: vi.fn(),
}));

describe("ChatPanel", () => {
  beforeEach(() => {
    // Default: every pre-existing test keeps asserting what it asserted
    // before 04-03 — an empty, already-resolved history means hydration
    // never adds anything and the seed-greeting/populated behavior below is
    // unaffected.
    vi.mocked(getChatHistory).mockResolvedValue({ ok: true, data: { messages: [] } });
  });

  afterEach(() => {
    vi.mocked(postChatMessage).mockReset();
    vi.mocked(getChatHistory).mockReset();
  });

  it("renders the seed greeting as an assistant bubble once history resolves empty", async () => {
    render(<ChatPanel />);

    await waitFor(() =>
      expect(
        screen.getByText(
          "Hi, I'm FinAlly. Ask me about your portfolio, or tell me to buy, sell, or update your watchlist.",
        ),
      ).toBeInTheDocument(),
    );
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

  describe("history rehydration (CHAT-06)", () => {
    const SEED_GREETING_TEXT =
      "Hi, I'm FinAlly. Ask me about your portfolio, or tell me to buy, sell, or update your watchlist.";

    it("calls getChatHistory exactly once on mount", async () => {
      render(<ChatPanel />);

      await waitFor(() => expect(getChatHistory).toHaveBeenCalledTimes(1));
    });

    it("shows the history-loading placeholder and no seed greeting while history is pending", async () => {
      let resolveHistory!: (value: { ok: true; data: ChatHistoryResponse }) => void;
      vi.mocked(getChatHistory).mockReturnValue(
        new Promise((resolve) => {
          resolveHistory = resolve;
        }),
      );
      render(<ChatPanel />);

      expect(screen.getByTestId("chat-history-loading")).toHaveTextContent(
        "Loading conversation…",
      );
      expect(screen.queryByText(SEED_GREETING_TEXT)).not.toBeInTheDocument();

      resolveHistory({ ok: true, data: { messages: [] } });
      await waitFor(() => expect(screen.getByText(SEED_GREETING_TEXT)).toBeInTheDocument());
    });

    it("renders every restored entry as a bubble in order, with no seed greeting", async () => {
      vi.mocked(getChatHistory).mockResolvedValue({
        ok: true,
        data: {
          messages: [
            {
              id: "h1",
              role: "user",
              content: "Older question",
              actions: null,
              created_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "h2",
              role: "assistant",
              content: "Older answer",
              actions: null,
              created_at: "2024-01-01T00:00:01Z",
            },
          ],
        },
      });
      render(<ChatPanel />);

      await waitFor(() => expect(screen.getByText("Older question")).toBeInTheDocument());
      expect(screen.getByText("Older answer")).toBeInTheDocument();
      expect(screen.queryByText(SEED_GREETING_TEXT)).not.toBeInTheDocument();

      const container = screen.getByTestId("chat-messages");
      const text = container.textContent ?? "";
      expect(text.indexOf("Older question")).toBeLessThan(text.indexOf("Older answer"));
    });

    it("shows the seed greeting and no error banner when history resolves empty", async () => {
      render(<ChatPanel />);

      await waitFor(() => expect(screen.getByText(SEED_GREETING_TEXT)).toBeInTheDocument());
      expect(screen.queryByTestId("chat-history-error")).not.toBeInTheDocument();
    });

    it("shows the load-error banner and the seed greeting beneath it on failure, without disabling input or Send", async () => {
      const user = userEvent.setup();
      vi.mocked(getChatHistory).mockResolvedValue({
        ok: false,
        error: "Network error — unable to reach the server.",
      });
      render(<ChatPanel />);

      await waitFor(() =>
        expect(screen.getByTestId("chat-history-error")).toHaveTextContent(
          "Couldn't load conversation history — you can still send new messages.",
        ),
      );
      expect(screen.getByText(SEED_GREETING_TEXT)).toBeInTheDocument();

      const input = screen.getByTestId("chat-input") as HTMLInputElement;
      expect(input).not.toBeDisabled();
      await user.type(input, "hi");
      expect(screen.getByTestId("chat-send")).not.toBeDisabled();
    });

    it("renders the action pill for a restored assistant entry, identical to a freshly received turn", async () => {
      vi.mocked(getChatHistory).mockResolvedValue({
        ok: true,
        data: {
          messages: [
            {
              id: "h1",
              role: "user",
              content: "buy 10 aapl",
              actions: null,
              created_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "h2",
              role: "assistant",
              content: "Done.",
              actions: {
                message: "Done.",
                trades: [
                  {
                    ticker: "AAPL",
                    side: "buy",
                    quantity: 10,
                    status: "executed",
                    price: 190.5,
                    error: null,
                  },
                ],
                watchlist_changes: [],
              },
              created_at: "2024-01-01T00:00:01Z",
            },
          ],
        },
      });
      render(<ChatPanel />);

      await waitFor(() => expect(screen.getAllByTestId("chat-action-pill")).toHaveLength(1));
      const pill = screen.getByTestId("chat-action-pill");
      expect(pill).toHaveAttribute("data-status", "executed");
      expect(pill).toHaveTextContent("Bought 10 AAPL @ $190.50");
    });

    it("appends a newly sent exchange after the restored conversation rather than replacing it", async () => {
      const user = userEvent.setup();
      vi.mocked(getChatHistory).mockResolvedValue({
        ok: true,
        data: {
          messages: [
            {
              id: "h1",
              role: "user",
              content: "Older question",
              actions: null,
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
        },
      });
      vi.mocked(postChatMessage).mockResolvedValue({
        ok: true,
        data: { message: "New answer.", trades: [], watchlist_changes: [] },
      });
      render(<ChatPanel />);

      await waitFor(() => expect(screen.getByText("Older question")).toBeInTheDocument());

      await sendMessage(user, "New question");

      await waitFor(() => expect(screen.getByText("New answer.")).toBeInTheDocument());
      expect(screen.getByText("Older question")).toBeInTheDocument();
      expect(screen.getByText("New question")).toBeInTheDocument();

      const container = screen.getByTestId("chat-messages");
      const text = container.textContent ?? "";
      expect(text.indexOf("Older question")).toBeLessThan(text.indexOf("New question"));
    });
  });

  describe("scroll-to-bottom on expand", () => {
    // jsdom hard-codes scrollHeight to 0 (defined on Element.prototype), so
    // without this stub the component's scrollTop = scrollHeight assignment
    // is always 0 = 0 — the assertion below would pass vacuously against
    // both the broken and the fixed component. Scoped to this describe block
    // (not the file-level beforeEach) so the 19 pre-existing tests never
    // observe a non-zero scrollHeight.
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
        configurable: true,
        get: () => 1000,
      });
    });

    afterEach(() => {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
    });

    it("re-pins the message list to the newest message after collapse then expand", async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await waitFor(() => expect(screen.getByTestId("chat-messages")).toBeInTheDocument());

      await user.click(screen.getByTestId("chat-toggle"));
      await user.click(screen.getByTestId("chat-toggle"));

      expect(screen.getByTestId("chat-messages").scrollTop).toBe(1000);
    });
  });
});

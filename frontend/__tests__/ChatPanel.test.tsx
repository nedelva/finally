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
});

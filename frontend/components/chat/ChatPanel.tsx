"use client";

// The AI Copilot panel: a docked, collapsible chat sidebar (PLAN.md §10)
// talking to POST /api/chat (CHAT-01), whose reply is grounded in the user's
// real cash, positions and watchlist prices (CHAT-02). Mirrors TradeBar.tsx's
// submit/in-flight/local-error-state shape, with one deliberate divergence
// (D-07 in 04-UI-SPEC.md's Copywriting Contract): a send failure preserves
// the typed message rather than clearing it, since TradeBar only clears on
// *success*. The message-list scroll container reuses Watchlist.tsx's
// watchlist-scroll-container max-height + overflow-y-auto idiom. Collapse
// mechanism, every user-visible string, and the color/token usage below are
// all locked by 04-UI-SPEC.md — do not improvise copy or introduce a class
// name outside the eight tokens declared in globals.css's @theme block.
//
// Inline action confirmations (CHAT-03..05) and history rehydration
// (CHAT-06) land in 04-02/04-03 — this plan's POST /api/chat always returns
// empty `trades`/`watchlist_changes` arrays, so no confirmation pill UI
// exists here yet.

import { type FormEvent, useEffect, useRef, useState } from "react";
import { postChatMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

// Mirrors backend/app/api/chat.py's MAX_MESSAGE_CHARS so the route's
// over-length 400 can never be triggered from this input — the UI-SPEC's
// Copywriting Contract has exactly one send-failure string, and it does not
// cover a length rejection.
const MAX_MESSAGE_CHARS = 4000;

const SEED_GREETING =
  "Hi, I'm FinAlly. Ask me about your portfolio, or tell me to buy, sell, or update your watchlist.";
const SEND_FAILURE_COPY = "Message not sent — check your connection and try again.";

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `chat-msg-${messageIdCounter}`;
}

export function ChatPanel() {
  // Local state only, per this plan's scope — no new hook. The seed greeting
  // is deliberately NOT seeded into `messages` on mount: it is a derived
  // empty-state branch below, exactly like Watchlist.tsx's empty state, so
  // it is never persisted as a chat_messages row and 04-03's history
  // hydration becomes a pure addition to this branch.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Collapse state is intentionally not persisted (no localStorage, no
  // backend field) — every fresh page load starts expanded, per the UI-SPEC.
  const [collapsed, setCollapsed] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Scrolls the newest bubble (or the Thinking bubble) into view on send and
  // on response arrival, mirroring the project's cleanup-on-unmount timer
  // convention — no timer is introduced here, so no cleanup is needed.
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length, sending]);

  const trimmed = input.trim();
  const sendDisabled = trimmed === "" || sending;

  async function send() {
    if (sendDisabled) return;

    const outgoing = trimmed;
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: "user", content: outgoing, createdAt: Date.now() },
    ]);
    setSending(true);
    setError("");

    const result = await postChatMessage(outgoing);

    if (result.ok) {
      setInput("");
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "assistant",
          content: result.data.message,
          actions: result.data,
          createdAt: Date.now(),
        },
      ]);
    } else {
      // Deliberate divergence from TradeBar: the typed message is left in
      // the input on failure so the user can retry without retyping.
      setError(SEND_FAILURE_COPY);
    }

    setSending(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <div
      data-testid="chat-panel"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">AI Copilot</h2>
        <button
          type="button"
          data-testid="chat-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          className="text-xs font-medium text-gray-500"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div
            ref={messagesRef}
            data-testid="chat-messages"
            className="mt-4 max-h-[440px] overflow-y-auto rounded bg-[var(--color-bg)]"
          >
            <div className="flex flex-col gap-2 p-3">
              {messages.length === 0 ? (
                <div className="flex justify-start">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-white">
                    {SEED_GREETING}
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <p
                      className={
                        message.role === "user"
                          ? "max-w-[85%] whitespace-pre-wrap break-words rounded border border-[var(--color-primary-blue)] bg-[var(--color-primary-blue)]/20 px-3 py-2 text-sm text-white"
                          : "max-w-[85%] whitespace-pre-wrap break-words rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-white"
                      }
                    >
                      {message.content}
                    </p>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <p
                    data-testid="chat-thinking"
                    className="max-w-[85%] animate-pulse whitespace-pre-wrap break-words rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-white"
                  >
                    Thinking…
                  </p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
            <input
              data-testid="chat-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={sending}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder="Message FinAlly…"
              className="flex-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-blue)] disabled:opacity-50"
            />
            <button
              type="submit"
              data-testid="chat-send"
              disabled={sendDisabled}
              className="rounded bg-[var(--color-secondary-purple)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
          <p data-testid="chat-error" className="mt-2 text-sm text-[var(--color-down)] empty:hidden">
            {error}
          </p>
        </>
      )}
    </div>
  );
}

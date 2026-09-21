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
// Inline action confirmation pills (CHAT-03..05) render beneath each
// assistant message from its already-threaded `actions` field — watchlist
// changes first, then trades, matching the backend's own dispatch order
// (app/api/chat.py: watchlist_changes run to completion before the first
// trade). Colour is by status only (--color-up executed / --color-down
// failed), never by action kind, per 04-UI-SPEC.md's single green-succeeded/
// red-failed rule already established by the Buy/Sell button colors.
//
// History rehydration (CHAT-06): useChatHistory() fetches GET
// /api/chat/history once on mount; a hydratedRef-guarded effect prepends the
// restored entries into `messages` exactly once, so a first-ever visit still
// gets the seed greeting and a returning user sees their conversation.

import { type FormEvent, useEffect, useRef, useState } from "react";
import { postChatMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useChatHistory } from "@/lib/hooks";
import type {
  ChatHistoryEntry,
  ChatMessage,
  ChatResponse,
  ChatTradeAction,
  ChatWatchlistAction,
} from "@/lib/types";

// Mirrors backend/app/api/chat.py's MAX_MESSAGE_CHARS so the route's
// over-length 400 can never be triggered from this input — the UI-SPEC's
// Copywriting Contract has exactly one send-failure string, and it does not
// cover a length rejection.
const MAX_MESSAGE_CHARS = 4000;

const SEED_GREETING =
  "Hi, I'm FinAlly. Ask me about your portfolio, or tell me to buy, sell, or update your watchlist.";
const SEND_FAILURE_COPY = "Message not sent — check your connection and try again.";
// Copywriting Contract, verbatim (04-UI-SPEC.md) — the history-fetch loading
// placeholder mirrors Watchlist.tsx's "Loading watchlist…" row pattern, and
// the load-error banner is explicit that sending still works.
const HISTORY_LOADING_COPY = "Loading conversation…";
const HISTORY_ERROR_COPY =
  "Couldn't load conversation history — you can still send new messages.";

let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `chat-msg-${messageIdCounter}`;
}

// Maps one persisted GET /api/chat/history entry into the local ChatMessage
// shape. `actions` passes through unchanged so 04-02's pill rendering works
// identically on a restored turn; `created_at` (server ISO string) becomes
// `createdAt` (client-local number) via Date.parse — see the comment on
// ChatHistoryEntry in lib/types.ts for why these two shapes stay distinct.
function mapHistoryEntry(entry: ChatHistoryEntry): ChatMessage {
  return {
    id: entry.id,
    role: entry.role,
    content: entry.content,
    actions: entry.actions,
    createdAt: Date.parse(entry.created_at),
  };
}

// Copywriting Contract, verbatim (04-UI-SPEC.md) — the trade-executed copy
// is the same string TradeBar.tsx renders for a manual fill.
function tradePillCopy(trade: ChatTradeAction): string {
  if (trade.status === "executed") {
    const verbPast = trade.side === "buy" ? "Bought" : "Sold";
    return `${verbPast} ${trade.quantity} ${trade.ticker} @ ${formatMoney(trade.price)}`;
  }
  const verb = trade.side === "buy" ? "Buy" : "Sell";
  return `${verb} ${trade.ticker} failed — ${trade.error}`;
}

function watchlistPillCopy(change: ChatWatchlistAction): string {
  if (change.status === "executed") {
    const verbPast = change.action === "add" ? "Added" : "Removed";
    const suffix = change.action === "add" ? "to watchlist" : "from watchlist";
    return `${verbPast} ${change.ticker} ${suffix}`;
  }
  const verb = change.action === "add" ? "Add" : "Remove";
  return `${verb} ${change.ticker} failed — ${change.error}`;
}

const PILL_BASE_CLASS =
  "max-w-[85%] whitespace-pre-wrap break-words rounded border px-2 py-1 text-xs font-medium";
const PILL_EXECUTED_CLASS = "border-[var(--color-up)] text-[var(--color-up)]";
const PILL_FAILED_CLASS = "border-[var(--color-down)] text-[var(--color-down)]";

function ActionPills({ actions }: { actions: ChatResponse }) {
  if (actions.watchlist_changes.length === 0 && actions.trades.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1" data-testid="chat-action-pills">
      {actions.watchlist_changes.map((change, index) => (
        <span
          key={`watchlist-${index}-${change.ticker}`}
          data-testid="chat-action-pill"
          data-status={change.status}
          className={`${PILL_BASE_CLASS} ${
            change.status === "executed" ? PILL_EXECUTED_CLASS : PILL_FAILED_CLASS
          }`}
        >
          {watchlistPillCopy(change)}
        </span>
      ))}
      {actions.trades.map((trade, index) => (
        <span
          key={`trade-${index}-${trade.ticker}`}
          data-testid="chat-action-pill"
          data-status={trade.status}
          className={`${PILL_BASE_CLASS} ${
            trade.status === "executed" ? PILL_EXECUTED_CLASS : PILL_FAILED_CLASS
          }`}
        >
          {tradePillCopy(trade)}
        </span>
      ))}
    </div>
  );
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

  // CHAT-06: fetch the persisted conversation once on mount and hydrate it
  // into `messages`. `hydratedRef` guards against the effect re-firing on a
  // later render — `entries` is a fresh array identity on every hook render,
  // so a naive dependency-only guard would re-prepend on every resolution.
  const { entries, loading: historyLoading, error: historyError } = useChatHistory();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (historyLoading) return;
    // Fires exactly once, on the first non-loading resolution — including a
    // zero-entry resolution and a failed one — so the ref can never be left
    // unset and re-fire later.
    hydratedRef.current = true;
    // Prepend rather than replace: a message the user managed to send during
    // the fetch (Send is never disabled by historyLoading) survives, in the
    // right position, after the restored history.
    setMessages((prev) => [...entries.map(mapHistoryEntry), ...prev]);
  }, [historyLoading, entries]);

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
          {historyError && (
            <p
              data-testid="chat-history-error"
              className="mt-4 whitespace-pre-wrap break-words text-sm text-[var(--color-down)]"
            >
              {HISTORY_ERROR_COPY}
            </p>
          )}
          <div
            ref={messagesRef}
            data-testid="chat-messages"
            className={`${
              historyError ? "mt-2" : "mt-4"
            } max-h-[440px] overflow-y-auto rounded bg-[var(--color-bg)]`}
          >
            <div className="flex flex-col gap-2 p-3">
              {historyLoading ? (
                <div className="flex justify-start">
                  <p
                    data-testid="chat-history-loading"
                    className="max-w-[85%] whitespace-pre-wrap break-words rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-gray-500"
                  >
                    {HISTORY_LOADING_COPY}
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-start">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-white">
                    {SEED_GREETING}
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-1 ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
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
                    {message.role === "assistant" && message.actions && (
                      <ActionPills actions={message.actions} />
                    )}
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

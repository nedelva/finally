"use client";

import { useEffect, useRef, useState } from "react";
import { postChatMessage } from "@/lib/api";
import { formatMoney, formatQuantity } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `chat-${idCounter}-${Date.now()}`;
}

function ActionChips({ actions }: { actions: NonNullable<ChatMessage["actions"]> }) {
  if (actions.trades.length === 0 && actions.watchlist_changes.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {actions.trades.map((t, i) => (
        <div
          key={`trade-${i}`}
          className={`rounded border px-2 py-1 text-xs ${
            t.status === "executed"
              ? "border-positive/40 bg-positive-dim text-positive"
              : "border-negative/40 bg-negative-dim text-negative"
          }`}
        >
          {t.status === "executed" ? "✓" : "✕"} {t.side === "buy" ? "Bought" : "Sold"}{" "}
          {formatQuantity(t.quantity)} {t.ticker}
          {t.status === "executed" && t.price !== null ? ` @ ${formatMoney(t.price)}` : ""}
          {t.status === "failed" && t.error ? ` — ${t.error}` : ""}
        </div>
      ))}
      {actions.watchlist_changes.map((w, i) => (
        <div
          key={`wl-${i}`}
          className={`rounded border px-2 py-1 text-xs ${
            w.status === "executed"
              ? "border-accent-blue/40 bg-accent-blue/10 text-accent-blue"
              : "border-negative/40 bg-negative-dim text-negative"
          }`}
        >
          {w.status === "executed" ? "✓" : "✕"} {w.action === "add" ? "Added" : "Removed"} {w.ticker}
          {w.status === "failed" && w.error ? ` — ${w.error}` : ""}
        </div>
      ))}
    </div>
  );
}

export function ChatPanel({
  collapsed,
  onToggleCollapsed,
  onActionsExecuted,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onActionsExecuted: () => void;
}) {
  // Fixed id/timestamp for the seed greeting — Date.now()/nextId() are only
  // called from the send handler (a user event, not render), keeping the
  // initial render pure.
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "chat-seed",
      role: "assistant",
      content: "I'm FinAlly, your trading copilot. Ask me about your portfolio or tell me what to trade.",
      createdAt: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    // jsdom (unit tests) doesn't implement scrollTo — guard for it.
    if (node && typeof node.scrollTo === "function") {
      node.scrollTo({ top: node.scrollHeight });
    }
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: text, createdAt: Date.now() }]);
    setInput("");
    setLoading(true);
    setError(null);

    const res = await postChatMessage(text);
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        content: res.data.message,
        actions: res.data,
        createdAt: Date.now(),
      },
    ]);

    if (res.data.trades.some((t) => t.status === "executed") ||
        res.data.watchlist_changes.some((w) => w.status === "executed")) {
      onActionsExecuted();
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label="Open AI chat"
        className="flex h-full w-10 flex-col items-center justify-center gap-2 rounded-lg border border-hairline bg-panel-raised text-accent-yellow"
      >
        <span className="rotate-90 whitespace-nowrap text-xs font-semibold tracking-wide">AI CHAT</span>
      </button>
    );
  }

  return (
    <section
      className="flex h-full w-full flex-col rounded-lg border border-hairline bg-panel-raised"
      aria-label="AI chat"
    >
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">AI Chat</h2>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Collapse AI chat"
          className="text-ink-muted hover:text-ink-primary"
        >
          ⟩⟩
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-accent-blue text-white"
                  : "border border-hairline bg-panel text-ink-primary"
              }`}
            >
              {m.content}
              {m.actions && <ActionChips actions={m.actions} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-start" data-testid="chat-loading">
            <div className="flex items-center gap-1 rounded-lg border border-hairline bg-panel px-3 py-2 text-sm text-ink-muted">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted" />
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded bg-negative-dim px-2 py-1.5 text-xs text-negative">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-hairline p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask FinAlly…"
          aria-label="Chat message"
          className="flex-1 rounded border border-hairline bg-void px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:border-accent-purple focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-accent-purple px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}

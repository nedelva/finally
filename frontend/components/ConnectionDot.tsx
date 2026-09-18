"use client";

// Four-state stream status indicator (MKT-05). The status is exposed three
// ways — colour, a `data-status` attribute, and an `aria-label` in words —
// because colour alone conveys nothing to a screen reader or a colour-blind
// user, and this dot is the sole signal in the terminal distinguishing a
// live stream from a frozen one (see threat T-01-12 in 01-05-PLAN.md).
//
// No reconnection logic lives here or anywhere near it: the native
// EventSource already retries on its own schedule (server's `retry: 1000`
// directive, stream.py:62); this component only renders the status value
// plan 01-02's usePriceStream hook already derives from the browser's own
// open/error events.

import type { ConnectionStatus } from "@/lib/types";

export interface ConnectionDotProps {
  status: ConnectionStatus;
}

const LABEL: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

/**
 * Colour class per status. Amber is deliberately shared between
 * "connecting" and "reconnecting" — from the user's point of view, opening
 * for the first time and retrying after a drop are the same situation: not
 * yet live, not yet given up on.
 */
const COLOR_CLASS: Record<ConnectionStatus, string> = {
  connected: "bg-[var(--color-up)]",
  connecting: "bg-[var(--color-accent-yellow)] animate-pulse",
  reconnecting: "bg-[var(--color-accent-yellow)] animate-pulse",
  disconnected: "bg-[var(--color-down)]",
};

export function ConnectionDot({ status }: ConnectionDotProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        data-status={status}
        aria-label={LABEL[status]}
        role="status"
        className={`inline-block h-2.5 w-2.5 rounded-full ${COLOR_CLASS[status]}`}
      />
      <span className="text-xs text-gray-400">{LABEL[status]}</span>
    </span>
  );
}

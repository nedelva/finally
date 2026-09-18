"use client";

// Terminal header (MKT-05 dot mount point; T-01-04/T-01-13 mitigations).
// Two things this component must never do: silently drop the
// simulated-feed disclosure, and stand in a placeholder portfolio total or
// cash balance. Both arrive with PORT-01 in Phase 3 — until then this
// header shows no dollar-denominated figure at all, not a zero or a dash
// styled to look implemented (see must_haves.prohibitions in
// 01-05-PLAN.md).

import type { ConnectionStatus } from "@/lib/types";
import { ConnectionDot } from "./ConnectionDot";

export interface HeaderProps {
  status: ConnectionStatus;
}

export function Header({ status }: HeaderProps) {
  return (
    <header className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold text-[var(--color-accent-yellow)]">FinAlly</h1>
        <p className="text-xs text-gray-400">
          AI Trading Workstation — Simulated market data
        </p>
      </div>
      <ConnectionDot status={status} />
    </header>
  );
}

"use client";

// Terminal header (MKT-05 dot mount point; T-01-04/T-01-13 mitigations).
// PORT-01 landed in Phase 3: cash balance and live total portfolio value
// now render here. The standing rule from Phase 1 still binds — neither
// figure may show a placeholder or styled zero before real data exists.
// `formatMoney` already renders an em dash for `null`/`undefined`/`NaN`,
// so passing the raw (possibly-null) prop straight through covers both the
// pre-first-fetch state and the fetch-failed state with the same code
// path, honestly, with no faked number at any point.

import { formatMoney } from "@/lib/format";
import type { ConnectionStatus } from "@/lib/types";
import { ConnectionDot } from "./ConnectionDot";

export interface HeaderProps {
  status: ConnectionStatus;
  cashBalance: number | null;
  totalValue: number | null;
}

export function Header({ status, cashBalance, totalValue }: HeaderProps) {
  return (
    <header className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold text-[var(--color-accent-yellow)]">FinAlly</h1>
        <p className="text-xs text-gray-400">
          AI Trading Workstation — Simulated market data
        </p>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Cash</span>
          <span
            data-testid="header-cash"
            className="text-base font-semibold tabular-nums text-gray-100"
          >
            {formatMoney(cashBalance)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total Value
          </span>
          <span
            data-testid="header-total-value"
            className="text-base font-semibold tabular-nums text-gray-100"
          >
            {formatMoney(totalValue)}
          </span>
        </div>
        <ConnectionDot status={status} />
      </div>
    </header>
  );
}

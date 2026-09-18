"use client";

// Minimal RED-phase stub — intentionally does not yet implement the
// data-status/aria-label/colour contract. Task 1 GREEN fills this in.

import type { ConnectionStatus } from "@/lib/types";

export interface ConnectionDotProps {
  status: ConnectionStatus;
}

export function ConnectionDot({ status }: ConnectionDotProps) {
  return <span>{status}</span>;
}

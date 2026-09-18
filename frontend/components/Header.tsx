"use client";

// Minimal RED-phase stub — intentionally does not yet implement the
// brand/disclosure/dot layout. Task 1 GREEN fills this in.

import type { ConnectionStatus } from "@/lib/types";

export interface HeaderProps {
  status: ConnectionStatus;
}

export function Header({ status }: HeaderProps) {
  return <div>{status}</div>;
}

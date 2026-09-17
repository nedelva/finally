"use client";

// Minimal RED-phase stub — deliberately incomplete so the test suite loads
// and fails on real behavioural assertions instead of a module-resolution
// error (INVALID_RED per this project's TDD convention). GREEN replaces the
// body with the real Recharts wiring described in the plan.

import type { PricePoint } from "@/lib/usePriceStream";

export interface SparklineProps {
  data: PricePoint[];
  width?: number;
  height?: number;
}

export function Sparkline({}: SparklineProps) {
  return null;
}

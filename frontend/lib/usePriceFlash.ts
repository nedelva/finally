"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a transient CSS class ("flash-up" | "flash-down" | "") that
 * appears for ~550ms whenever `price` changes value, then clears itself —
 * the price-flash effect required by PLAN.md §2. Implemented as a timed
 * class toggle (not a CSS animation restart trick) so re-mounted/rapid
 * updates behave predictably in tests.
 */
export function usePriceFlash(price: number | null | undefined): string {
  const [flashClass, setFlashClass] = useState("");
  const prevRef = useRef<number | null | undefined>(price);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = price;

    if (prev === null || prev === undefined || price === null || price === undefined) return;
    if (price === prev) return;

    setFlashClass(price > prev ? "flash-up" : "flash-down");

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFlashClass(""), 550);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [price]);

  return flashClass;
}

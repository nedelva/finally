import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePriceFlash } from "@/lib/usePriceFlash";

describe("usePriceFlash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an empty string on first render even though a price is supplied", () => {
    const { result } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: 190.0 },
    });

    expect(result.current).toBe("");
  });

  it("returns an empty string when the price is stable across re-renders", () => {
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: 190.0 },
    });

    act(() => {
      rerender({ price: 190.0 });
    });

    expect(result.current).toBe("");
  });

  it("returns flash-up when the price increases", () => {
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: 190.0 },
    });

    act(() => {
      rerender({ price: 191.0 });
    });

    expect(result.current).toBe("flash-up");
  });

  it("returns flash-down when the price decreases", () => {
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: 190.0 },
    });

    act(() => {
      rerender({ price: 189.0 });
    });

    expect(result.current).toBe("flash-down");
  });

  it("clears the flash class after 550ms", () => {
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: 190.0 },
    });

    act(() => {
      rerender({ price: 191.0 });
    });
    expect(result.current).toBe("flash-up");

    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(result.current).toBe("");
  });

  it("returns an empty string when re-rendered with the identical price", () => {
    const { result, rerender } = renderHook(({ price }) => usePriceFlash(price), {
      initialProps: { price: 190.0 },
    });

    act(() => {
      rerender({ price: 190.0 });
    });

    expect(result.current).toBe("");
  });

  it("returns an empty string when transitioning from null/undefined into a real price", () => {
    const { result, rerender } = renderHook(
      ({ price }: { price: number | null | undefined }) => usePriceFlash(price),
      { initialProps: { price: null as number | null | undefined } },
    );

    act(() => {
      rerender({ price: 190.0 });
    });
    expect(result.current).toBe("");

    const { result: result2, rerender: rerender2 } = renderHook(
      ({ price }: { price: number | null | undefined }) => usePriceFlash(price),
      { initialProps: { price: undefined as number | null | undefined } },
    );

    act(() => {
      rerender2({ price: 190.0 });
    });
    expect(result2.current).toBe("");
  });
});

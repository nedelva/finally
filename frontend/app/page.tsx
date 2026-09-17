"use client";

import { Watchlist } from "@/components/Watchlist";
import { PriceStreamProvider, usePriceStreamContext } from "@/lib/PriceStreamContext";

function Terminal() {
  const { status } = usePriceStreamContext();

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-[var(--color-accent-yellow)]">FinAlly</h1>
        <p className="text-sm text-gray-400">
          Simulated market data — status: {status}
        </p>
      </header>

      <Watchlist />
    </main>
  );
}

export default function Page() {
  return (
    <PriceStreamProvider>
      <Terminal />
    </PriceStreamProvider>
  );
}

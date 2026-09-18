"use client";

import { Header } from "@/components/Header";
import { Watchlist } from "@/components/Watchlist";
import { PriceStreamProvider, usePriceStreamContext } from "@/lib/PriceStreamContext";

function Terminal() {
  const { status } = usePriceStreamContext();

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <Header status={status} />

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

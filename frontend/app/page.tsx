"use client";

import { PriceStreamProvider, usePriceStreamContext } from "@/lib/PriceStreamContext";
import { formatPercent, formatPrice } from "@/lib/format";

function Terminal() {
  const { ticks, tickers, status } = usePriceStreamContext();

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-[var(--color-accent-yellow)]">FinAlly</h1>
        <p className="text-sm text-gray-400">
          Simulated market data — status: {status}
        </p>
      </header>

      <table className="w-full max-w-xl text-left text-sm">
        <thead>
          <tr className="text-gray-500">
            <th className="pr-4">Ticker</th>
            <th className="pr-4">Price</th>
            <th>Change %</th>
          </tr>
        </thead>
        <tbody>
          {tickers.map((ticker) => {
            const priceTick = ticks[ticker];
            return (
              <tr key={ticker}>
                <td className="pr-4">{ticker}</td>
                <td className="pr-4">{formatPrice(priceTick?.price)}</td>
                <td>{formatPercent(priceTick?.change_percent, { sign: true })}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

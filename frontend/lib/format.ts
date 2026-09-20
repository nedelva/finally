/** Formatting helpers. All null-safe — the watchlist price fields are
 * nullable per API_CONTRACT.md, and pre-first-tick state must render an
 * em dash, never a NaN or a thrown error. */

export function formatMoney(value: number | null | undefined, opts?: { sign?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = opts?.sign && value > 0 ? "+" : "";
  return (
    sign +
    value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number | null | undefined, opts?: { sign?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = opts?.sign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  // Fractional shares are supported — trim trailing zeros but keep up to 4dp.
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatTime(isoOrUnixSeconds: string | number): string {
  const date =
    typeof isoOrUnixSeconds === "number"
      ? new Date(isoOrUnixSeconds * 1000)
      : new Date(isoOrUnixSeconds);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatClock(isoOrUnixSeconds: string | number): string {
  const date =
    typeof isoOrUnixSeconds === "number"
      ? new Date(isoOrUnixSeconds * 1000)
      : new Date(isoOrUnixSeconds);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

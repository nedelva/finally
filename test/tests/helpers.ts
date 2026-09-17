import type { Locator, Page } from "@playwright/test";

export const DEFAULT_WATCHLIST = [
  "AAPL",
  "GOOGL",
  "MSFT",
  "AMZN",
  "TSLA",
  "NVDA",
  "META",
  "JPM",
  "V",
  "NFLX",
];

/** The value span immediately following a given label span in the header
 * (`Total value` / `Cash`) — see frontend/components/layout/Header.tsx. */
export function headerValue(page: Page, label: "Total value" | "Cash"): Locator {
  return page.locator("header").getByText(label, { exact: true }).locator("xpath=following-sibling::span[1]");
}

export function watchlistRow(page: Page, ticker: string): Locator {
  return page.getByTestId(`watchlist-row-${ticker}`);
}

/** The live price cell within a watchlist row (first `.tabular` element —
 * the second `.tabular` is the %-change cell). */
export function watchlistPrice(page: Page, ticker: string): Locator {
  return watchlistRow(page, ticker).locator(".tabular").first();
}

export function positionRow(page: Page, ticker: string): Locator {
  return page.getByTestId(`position-row-${ticker}`);
}

export async function waitForBackend(page: Page, baseURL: string) {
  await page.waitForTimeout(0);
  const res = await page.request.get(`${baseURL}/api/health`);
  return res.ok();
}

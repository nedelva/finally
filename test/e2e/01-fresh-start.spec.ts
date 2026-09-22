import { test, expect } from "@playwright/test";

// Fresh-start scenario (PLAN.md section 12): default watchlist, $10,000
// cash, prices actively streaming — asserted against the real, packaged
// container. This spec's numeric filename prefix (01-) is load-bearing: it
// must run before any spec that trades, since every spec shares one
// SQLite-backed container with no per-test isolation.

const DEFAULT_TICKERS = [
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

test("fresh start: default watchlist, $10,000 cash, prices streaming", async ({ page }) => {
  // next.config.js sets trailingSlash: true; StaticFiles(html=True) resolves
  // the index for "/" — do not hand-write "/index.html" paths.
  await page.goto("/");

  // A freshly seeded profile has cash_balance = 10000.0; formatMoney renders
  // it as the literal "$10,000.00".
  await expect(page.getByTestId("header-cash")).toHaveText("$10,000.00");

  // All ten default tickers render.
  for (const ticker of DEFAULT_TICKERS) {
    await expect(page.getByTestId(`row-${ticker}`)).toBeVisible();
  }

  // Prices are actively streaming: capture one ticker's price text, then
  // assert it changes within a generous bound. The simulator ticks about
  // every 500ms, so ~10s is generous. Playwright's built-in retrying
  // expect(...).not.toHaveText polls automatically — no fixed sleep.
  const priceCell = page.getByTestId("price-AAPL");
  const initialPrice = await priceCell.textContent();
  await expect(priceCell).not.toHaveText(initialPrice ?? "", { timeout: 10_000 });
});

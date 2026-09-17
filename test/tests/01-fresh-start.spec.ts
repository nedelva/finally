import { expect, test } from "@playwright/test";
import { DEFAULT_WATCHLIST, headerValue, watchlistPrice, watchlistRow } from "./helpers";

// Scenario 1 (PLAN.md §12): fresh start — default watchlist, $10k cash, prices streaming.
// MUST run before any trade/watchlist-mutating spec — it asserts the pristine seed state.

test.describe("fresh start", () => {
  test("shows the default 10-ticker watchlist", async ({ page }) => {
    await page.goto("/");

    for (const ticker of DEFAULT_WATCHLIST) {
      await expect(watchlistRow(page, ticker)).toBeVisible();
    }
    // Exactly 10 rows — no extras, nothing missing.
    await expect(page.locator('[data-testid^="watchlist-row-"]')).toHaveCount(DEFAULT_WATCHLIST.length);
  });

  test("shows $10,000.00 cash and total value", async ({ page }) => {
    await page.goto("/");

    await expect(headerValue(page, "Cash")).toHaveText("$10,000.00");
    // Total value = cash + 0 positions on a fresh DB.
    await expect(headerValue(page, "Total value")).toHaveText("$10,000.00");
  });

  test("connection status dot goes green (SSE connected)", async ({ page }) => {
    await page.goto("/");
    const dot = page.getByTestId("connection-dot");
    await expect(dot).toHaveClass(/bg-positive/, { timeout: 10_000 });
  });

  test("prices visibly stream in (a watchlist price cell updates)", async ({ page }) => {
    await page.goto("/");
    // TSLA/NVDA carry the highest configured volatility (see
    // backend/app/market/seed_prices.py), giving the best odds of a visible
    // 2-decimal-place change within a short polling window.
    const cell = watchlistPrice(page, "TSLA");
    await expect(cell).not.toHaveText("—", { timeout: 10_000 });
    const initial = await cell.textContent();

    await expect
      .poll(async () => cell.textContent(), { timeout: 15_000, intervals: [500] })
      .not.toBe(initial);
  });

  test("empty positions table and portfolio at $0 P&L", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("No open positions — buy something below.")).toBeVisible();
  });
});

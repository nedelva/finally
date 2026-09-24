import { test, expect } from "@playwright/test";

// Portfolio visualization (PLAN.md section 12): the heatmap, positions
// table, and P&L chart all render real data after a trade. Buys NVDA itself
// rather than relying on 03-trading.spec.ts's MSFT position, so this spec
// never contends over the same ticker.

test("heatmap, positions table, and P&L chart render real data after a buy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("row-AAPL")).toBeVisible();

  await page.getByTestId("trade-bar-ticker").selectOption("NVDA");
  await page.getByTestId("trade-bar-quantity").fill("1");
  await page.getByTestId("trade-bar-buy").click();

  await expect(page.getByTestId("trade-bar-confirmation")).toHaveText(/Bought 1 NVDA/);

  // Heatmap tile renders for the new position.
  await expect(page.getByTestId("heatmap-tile-NVDA")).toBeVisible();

  // Positions table renders real values for quantity, average cost, current
  // price, and unrealized P&L — never an em dash for a position with a live
  // price.
  const row = page.getByTestId("position-row-NVDA");
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("—");

  // The backend writes a portfolio_snapshots row immediately after every
  // executed trade, so a plotted point is guaranteed to exist shortly after
  // this buy. Snapshot cadence makes an exact count timing-dependent, so
  // assert "at least one" with a generous explicit timeout rather than a
  // fixed sleep.
  await expect(page.locator(".recharts-dot")).not.toHaveCount(0, { timeout: 15_000 });
});

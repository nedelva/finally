import { expect, test } from "@playwright/test";
import { headerValue, positionRow } from "./helpers";

// Scenario 3 (PLAN.md §12): buy shares via the trade bar — cash decreases by the expected
// amount, the position appears in the positions table, portfolio total updates.
//
// Leaves a 2-share MSFT position in place for 04-visualizations.spec.ts; it is sold off in
// 05-sell-trade.spec.ts.

function parseMoney(text: string | null): number {
  if (!text) throw new Error("empty money text");
  return Number(text.replace(/[^0-9.-]/g, ""));
}

test("buying MSFT decreases cash and creates a position", async ({ page, baseURL }) => {
  await page.goto("/");

  const cashBefore = parseMoney(await headerValue(page, "Cash").textContent());
  expect(cashBefore).toBeCloseTo(10000, 1); // sanity: runs right after fresh-start/watchlist specs

  await page.getByLabel("Trade ticker").fill("MSFT");
  await page.getByLabel("Trade quantity").fill("2");
  await page.getByRole("button", { name: "Buy" }).click();

  const feedback = page.getByRole("status");
  await expect(feedback).toContainText("Bought 2 MSFT @", { timeout: 10_000 });
  const feedbackText = await feedback.textContent();
  const fillPrice = parseMoney(feedbackText?.split("@")[1] ?? null);
  expect(fillPrice).toBeGreaterThan(0);

  // UI: cash decreased by exactly quantity * fill price.
  await expect
    .poll(async () => parseMoney(await headerValue(page, "Cash").textContent()), { timeout: 10_000 })
    .toBeCloseTo(cashBefore - 2 * fillPrice, 1);

  // UI: position row appears with the right quantity.
  const row = positionRow(page, "MSFT");
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(1)).toHaveText("2");

  // UI: total value roughly unchanged (cash converted to market value 1:1 at fill time;
  // small tolerance for price drift between fill and the next SSE tick).
  const totalAfter = parseMoney(await headerValue(page, "Total value").textContent());
  expect(Math.abs(totalAfter - 10000)).toBeLessThan(5);

  // Cross-check against the backend directly — never trust the UI alone.
  const apiPortfolio = await page.request.get(`${baseURL}/api/portfolio`);
  expect(apiPortfolio.ok()).toBeTruthy();
  const body = await apiPortfolio.json();
  const msft = body.positions.find((p: { ticker: string }) => p.ticker === "MSFT");
  expect(msft).toBeTruthy();
  expect(msft.quantity).toBe(2);
  expect(body.cash_balance).toBeCloseTo(cashBefore - 2 * fillPrice, 1);
});

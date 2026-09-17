import { expect, test } from "@playwright/test";
import { headerValue, positionRow } from "./helpers";

// Scenario 4 (PLAN.md §12): sell shares — cash increases, position disappears on a full sell.
// Sells off the 2-share MSFT position opened in 03-buy-trade.spec.ts.

function parseMoney(text: string | null): number {
  if (!text) throw new Error("empty money text");
  return Number(text.replace(/[^0-9.-]/g, ""));
}

test("selling the full MSFT position increases cash and removes the row", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(positionRow(page, "MSFT")).toBeVisible();

  const cashBefore = parseMoney(await headerValue(page, "Cash").textContent());

  await page.getByLabel("Trade ticker").fill("MSFT");
  await page.getByLabel("Trade quantity").fill("2");
  await page.getByRole("button", { name: "Sell" }).click();

  const feedback = page.getByRole("status");
  await expect(feedback).toContainText("Sold 2 MSFT @", { timeout: 10_000 });
  const feedbackText = await feedback.textContent();
  const fillPrice = parseMoney(feedbackText?.split("@")[1] ?? null);

  await expect
    .poll(async () => parseMoney(await headerValue(page, "Cash").textContent()), { timeout: 10_000 })
    .toBeCloseTo(cashBefore + 2 * fillPrice, 1);

  // Full sell -> row disappears entirely.
  await expect(positionRow(page, "MSFT")).not.toBeVisible();

  const apiPortfolio = await page.request.get(`${baseURL}/api/portfolio`);
  const body = await apiPortfolio.json();
  expect(body.positions.find((p: { ticker: string }) => p.ticker === "MSFT")).toBeUndefined();
});

test("selling more than owned is rejected", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Trade ticker").fill("AAPL");
  await page.getByLabel("Trade quantity").fill("999999");
  await page.getByRole("button", { name: "Sell" }).click();

  const feedback = page.getByRole("status");
  await expect(feedback).toBeVisible({ timeout: 10_000 });
  const text = await feedback.textContent();
  expect(text?.toLowerCase()).not.toContain("sold");
});

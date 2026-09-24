import { test, expect } from "@playwright/test";

// Trading journeys (PLAN.md section 12): buy, sell, and a refused over-sell,
// with cash and positions moving exactly as the product promises. Buys and
// sells MSFT itself rather than relying on any earlier spec's side effects —
// AAPL is left to 05-chat.spec.ts so the two specs never contend over the
// same position.

function parseMoney(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ""));
}

test("buy MSFT: cash decreases and the position appears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("row-AAPL")).toBeVisible();

  const cashBefore = parseMoney((await page.getByTestId("header-cash").textContent()) ?? "");

  await page.getByTestId("trade-bar-ticker").selectOption("MSFT");
  await page.getByTestId("trade-bar-quantity").fill("2");
  await page.getByTestId("trade-bar-buy").click();

  await expect(page.getByTestId("trade-bar-confirmation")).toHaveText(/Bought 2 MSFT/);
  await expect(page.getByTestId("position-row-MSFT")).toBeVisible();
  await expect
    .poll(async () => parseMoney((await page.getByTestId("header-cash").textContent()) ?? ""))
    .toBeLessThan(cashBefore);
});

test("sell MSFT: cash increases and the position remains", async ({ page }) => {
  await page.goto("/");

  // Relies on the previous test's buy having landed MSFT in the shared
  // container's positions table.
  await expect(page.getByTestId("position-row-MSFT")).toBeVisible();
  const cashBefore = parseMoney((await page.getByTestId("header-cash").textContent()) ?? "");

  await page.getByTestId("trade-bar-ticker").selectOption("MSFT");
  await page.getByTestId("trade-bar-quantity").fill("1");
  await page.getByTestId("trade-bar-sell").click();

  await expect(page.getByTestId("trade-bar-confirmation")).toHaveText(/Sold 1 MSFT/);
  await expect(page.getByTestId("position-row-MSFT")).toBeVisible();
  await expect
    .poll(async () => parseMoney((await page.getByTestId("header-cash").textContent()) ?? ""))
    .toBeGreaterThan(cashBefore);
});

test("refuse an over-sell: cash and position quantity stay unchanged, error is visible", async ({
  page,
}) => {
  await page.goto("/");

  const row = page.getByTestId("position-row-MSFT");
  await expect(row).toBeVisible();
  // Quantity is the second column (Symbol, Qty, Avg Cost, Price, P&L, Chg%).
  // Scoping to this cell (rather than the row's full text) avoids a false
  // failure from the price/P&L cells changing under live streaming between
  // the "before" and "after" snapshots.
  const qtyCell = row.locator("td").nth(1);
  const qtyBefore = await qtyCell.textContent();
  const cashBefore = parseMoney((await page.getByTestId("header-cash").textContent()) ?? "");

  await page.getByTestId("trade-bar-ticker").selectOption("MSFT");
  await page.getByTestId("trade-bar-quantity").fill("9999");
  await page.getByTestId("trade-bar-sell").click();

  await expect(page.getByTestId("trade-bar-error")).toBeVisible();
  await expect
    .poll(async () => parseMoney((await page.getByTestId("header-cash").textContent()) ?? ""))
    .toBe(cashBefore);
  await expect(qtyCell).toHaveText(qtyBefore ?? "");
});

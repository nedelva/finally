import { expect, test } from "@playwright/test";
import { watchlistPrice, watchlistRow } from "./helpers";

// (See the exact:true note below — the watchlist row itself is role="button" and its
// accessible name concatenates all descendant text/aria-labels, so an unscoped
// getByRole("button", {name: "Remove X..."}) also matches the row. Scope to the row.)

// Scenario 2 (PLAN.md §12): add and remove a ticker from the watchlist.

test.describe("watchlist add/remove", () => {
  const TICKER = "PYPL";

  test("add a ticker via the watchlist panel", async ({ page }) => {
    await page.goto("/");

    const input = page.getByLabel("Add ticker to watchlist");
    await input.fill(TICKER);
    // Exact match required: watchlist rows are role="button" too, and their accessible name
    // (ticker + price + %-change, e.g. "...+0.05%...") can contain a bare "+" substring.
    await page.getByRole("button", { name: "+", exact: true }).click();

    await expect(watchlistRow(page, TICKER)).toBeVisible();
    // The market data source must start pricing it immediately (API_CONTRACT.md) —
    // it should not stay a null/dash price forever.
    await expect(watchlistPrice(page, TICKER)).not.toHaveText("—", { timeout: 10_000 });
  });

  test("remove the ticker again", async ({ page }) => {
    await page.goto("/");
    const row = watchlistRow(page, TICKER);
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: `Remove ${TICKER} from watchlist` }).click();

    await expect(watchlistRow(page, TICKER)).not.toBeVisible();
  });

  test("adding a duplicate ticker is rejected with a visible error", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Add ticker to watchlist");
    await input.fill("AAPL");
    await page.getByRole("button", { name: "+", exact: true }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    // Still exactly one AAPL row — no duplicate inserted.
    await expect(page.locator('[data-testid="watchlist-row-AAPL"]')).toHaveCount(1);
  });
});

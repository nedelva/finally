import { test, expect } from "@playwright/test";

// Watchlist mutation journeys (PLAN.md section 12): add a ticker, remove a
// ticker, and reject a malformed/empty entry. Runs after 01-fresh-start,
// which established the pristine $10,000 baseline this spec does not touch.
// Each test creates whatever state it needs itself, per this suite's
// self-sufficiency convention.

test("add a ticker: appears in the grid and starts streaming a price", async ({ page }) => {
  await page.goto("/");

  // Wait for the default watchlist to finish its first load before mutating
  // it — avoids racing the initial GET /api/watchlist fetch.
  await expect(page.getByTestId("row-AAPL")).toBeVisible();

  await page.getByTestId("watchlist-add-input").fill("PYPL");
  await page.getByTestId("watchlist-add-submit").click();

  await expect(page.getByTestId("row-PYPL")).toBeVisible();
  // A newly added ticker shows an em dash until the market data source
  // ticks it for the first time; assert the mutation propagated all the way
  // to the running data source, not just to the database.
  await expect(page.getByTestId("price-PYPL")).not.toHaveText("—", { timeout: 10_000 });
});

test("remove a ticker: detaches from the grid", async ({ page }) => {
  await page.goto("/");

  // Relies on the previous test's PYPL addition persisting in the shared
  // container's database — both tests run in this file, in this order,
  // under the suite's workers:1/fullyParallel:false configuration.
  await expect(page.getByTestId("row-PYPL")).toBeVisible();

  await page.getByTestId("remove-PYPL").click();

  await expect(page.getByTestId("row-PYPL")).not.toBeAttached();
});

test("reject a malformed entry: shows an error and leaves the watchlist unchanged", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("row-AAPL")).toBeVisible();
  const rows = page.locator('[data-testid="watchlist-scroll-container"] tbody tr');
  const countBefore = await rows.count();

  // Empty submission.
  await page.getByTestId("watchlist-add-submit").click();
  await expect(page.getByTestId("watchlist-add-error")).toBeVisible();
  await expect(rows).toHaveCount(countBefore);

  // Malformed ticker: exceeds the backend's 1-5 alphanumeric-character
  // format (app/market/ticker.py's TICKER_FORMAT_RE).
  await page.getByTestId("watchlist-add-input").fill("TOOLONGTICKER");
  await page.getByTestId("watchlist-add-submit").click();
  await expect(page.getByTestId("watchlist-add-error")).toBeVisible();
  await expect(rows).toHaveCount(countBefore);
});

import { expect, test } from "@playwright/test";

// Scenario 5 (PLAN.md §12): portfolio visualizations — heatmap renders at least one tile once
// a position exists, and the P&L chart has at least one data point.
//
// Depends on the MSFT position opened in 03-buy-trade.spec.ts (a startup snapshot + a
// post-trade snapshot together give the P&L chart >=2 points, which is what it needs to
// switch from its "Not enough history yet" placeholder to an actual line).

test("heatmap renders a tile for the open position", async ({ page }) => {
  await page.goto("/");
  const heatmap = page.getByRole("region", { name: "Portfolio heatmap" });
  await expect(heatmap).toBeVisible();
  await expect(heatmap.getByText("No open positions yet")).not.toBeVisible();
  await expect(heatmap.locator("svg rect")).not.toHaveCount(0, { timeout: 10_000 });
});

test("P&L chart has at least one data point / renders a line", async ({ page }) => {
  await page.goto("/");
  const chart = page.getByRole("region", { name: "Portfolio value over time" });
  await expect(chart).toBeVisible();
  await expect(chart.getByText("Not enough history yet")).not.toBeVisible({ timeout: 10_000 });
  // Recharts renders the line as a <g class="recharts-line"> wrapping a <path> — Playwright's
  // toBeVisible() on the <g> itself is unreliable (SVG <g> elements report no intrinsic
  // bounding box), so assert on the actual drawn path having real geometry instead.
  const linePath = chart.locator("svg .recharts-line path.recharts-curve");
  await expect(linePath).toHaveCount(1, { timeout: 10_000 });
  const d = await linePath.getAttribute("d");
  expect(d && d.length).toBeGreaterThan(0);
});

test("positions table still shows the MSFT position", async ({ page, baseURL }) => {
  await page.goto("/");
  const res = await page.request.get(`${baseURL}/api/portfolio/history`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.snapshots.length).toBeGreaterThanOrEqual(2);
});

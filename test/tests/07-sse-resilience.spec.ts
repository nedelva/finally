import { expect, test } from "@playwright/test";

// Scenario 7 (PLAN.md §12): SSE resilience, reasonable-effort per the integration-tester brief
// (a full server-side network partition isn't practical from Playwright against a container it
// doesn't otherwise control). Two checks, weakest to strongest:
//
//   1. Page reload re-establishes streaming (always exercised — the lightest possible check).
//   2. A genuine client-side network interruption of the SSE connection (via Playwright route
//      interception aborting `/api/stream/prices`), confirming the app does not hard-crash and
//      that EventSource's built-in retry (the app sends `retry: 1000`) brings the connection
//      dot back to green once the route is restored.

test("reload re-establishes the price stream", async ({ page }) => {
  await page.goto("/");
  const dot = page.getByTestId("connection-dot");
  await expect(dot).toHaveClass(/bg-positive/, { timeout: 10_000 });

  await page.reload();
  await expect(dot).toHaveClass(/bg-positive/, { timeout: 10_000 });
});

test("client-side SSE interruption: dot leaves green, then recovers once the connection is restored", async ({
  page,
}) => {
  await page.goto("/");
  const dot = page.getByTestId("connection-dot");
  await expect(dot).toHaveClass(/bg-positive/, { timeout: 10_000 });

  // Sever the SSE connection at the network layer without killing the app/container.
  await page.route("**/api/stream/prices", (route) => route.abort());

  // Force a reconnect attempt: EventSource doesn't reliably notice a route change on an
  // already-open stream, so reload while the route is blocked to guarantee a fresh connection
  // attempt hits the abort.
  await page.reload();

  // App must not hard-crash: the page (and the rest of the UI) should still be usable.
  await expect(page.getByTestId("connection-dot")).toBeVisible();
  await expect(dot).not.toHaveClass(/bg-positive/, { timeout: 10_000 });

  // Restore the connection and confirm EventSource's built-in retry brings it back.
  await page.unroute("**/api/stream/prices");
  await expect(dot).toHaveClass(/bg-positive/, { timeout: 15_000 });
});

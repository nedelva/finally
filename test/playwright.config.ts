import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for FinAlly.
 *
 * This suite does NOT manage the app container itself (no `webServer` block) —
 * per the integration-tester process, the app is brought up separately via:
 *
 *   docker compose -f test/docker-compose.test.yml up --build -d
 *
 * and torn down via:
 *
 *   docker compose -f test/docker-compose.test.yml down -v
 *
 * BASE_URL defaults to the port mapped in docker-compose.test.yml (8010 -> container 8000).
 *
 * Tests run fully serially (single worker, no parallel shuffling) because they share one
 * running backend + SQLite volume and build up portfolio/watchlist state across files
 * (numbered 01..07 to fix execution order) — e.g. the "fresh start" assertions must run
 * before any trade mutates cash_balance, and the visualization scenario relies on a position
 * opened by the preceding buy-trade scenario.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

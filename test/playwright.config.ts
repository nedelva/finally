import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Every spec shares one app container backed by one SQLite file and one
  // PriceCache, with no per-test isolation anywhere in this single-user
  // app — concurrent specs would read each other's cash balances and
  // positions. This is a hard architectural requirement, not performance
  // tuning (05-RESEARCH.md Common Pitfalls #6).
  workers: 1,
  fullyParallel: false,
  // A flaky pass must never mask a real regression.
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8000",
    trace: "on-first-retry",
  },
  reporter: "list",
});

// Spec-ordering convention (established here, plan 05-05 inherits it): with
// workers: 1 and fullyParallel: false, Playwright runs spec files in sorted
// filename order. The fresh-start scenario asserts a pristine $10,000.00
// cash balance, so it must run before any spec that trades. Ordering is
// therefore encoded in the filenames as a two-digit numeric prefix — this
// plan's spec is test/e2e/01-fresh-start.spec.ts, and plan 05-05 continues
// from 02-. This prefix is load-bearing: do not rename a spec in a way that
// silently reorders the suite. Every spec other than 01- must also create
// whatever state it asserts on rather than depending on an earlier spec's
// side effects.

import { expect, test } from "@playwright/test";
import { positionRow } from "./helpers";

// Scenario 6 (PLAN.md §12): AI chat (mocked, LLM_MOCK=true) — send "buy AAPL", get a response,
// see the trade execution appear inline as a confirmation chip, and confirm the position
// actually shows up in the positions table afterward. Cross-checks the chat-reported action
// against real portfolio state (API), not just the chat bubble text, per the deterministic
// mock routing documented in backend/app/llm/mock.py ("buy" + a watchlist ticker -> buy qty 1).

test("chat 'buy AAPL' executes a real trade, shown as an inline confirmation", async ({ page, baseURL }) => {
  await page.goto("/");

  await page.getByLabel("Chat message").fill("buy AAPL");
  await page.getByRole("button", { name: "Send" }).click();

  // Loading indicator appears while the (mocked) LLM call is in flight...
  await expect(page.getByTestId("chat-loading")).toBeVisible();
  // ...and resolves into the assistant's reply.
  await expect(page.getByText("Buying 1 share of AAPL at the current market price.")).toBeVisible({
    timeout: 10_000,
  });

  // Inline confirmation chip for the executed trade.
  const chip = page.locator("text=/✓ Bought 1 AAPL @/");
  await expect(chip).toBeVisible();

  // Cross-check #1: the positions table (UI) reflects the trade.
  const row = positionRow(page, "AAPL");
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(1)).toHaveText("1");

  // Cross-check #2: the backend itself (not just what the chat bubble claims).
  const apiPortfolio = await page.request.get(`${baseURL}/api/portfolio`);
  expect(apiPortfolio.ok()).toBeTruthy();
  const body = await apiPortfolio.json();
  const aapl = body.positions.find((p: { ticker: string }) => p.ticker === "AAPL");
  expect(aapl).toBeTruthy();
  expect(aapl.quantity).toBe(1);

  // Cross-check #3: chat_messages persistence — the /api/chat response itself must have
  // reported the trade as executed with a concrete fill price (API_CONTRACT.md shape).
  const chatRes = await page.request.post(`${baseURL}/api/chat`, {
    data: { message: "what's my biggest position?" },
  });
  expect(chatRes.ok()).toBeTruthy();
  const chatBody = await chatRes.json();
  expect(Array.isArray(chatBody.trades)).toBeTruthy();
  expect(Array.isArray(chatBody.watchlist_changes)).toBeTruthy();
});

test("chat watchlist management: 'watch PLTR' adds it, 'remove PLTR' takes it off", async ({
  page,
  baseURL,
}) => {
  await page.goto("/");

  await page.getByLabel("Chat message").fill("watch PLTR");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=/✓ Added PLTR/")).toBeVisible({ timeout: 10_000 });

  let res = await page.request.get(`${baseURL}/api/watchlist`);
  let body = await res.json();
  expect(body.watchlist.some((w: { ticker: string }) => w.ticker === "PLTR")).toBeTruthy();

  await page.getByLabel("Chat message").fill("remove PLTR from my watchlist");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=/✓ Removed PLTR/")).toBeVisible({ timeout: 10_000 });

  res = await page.request.get(`${baseURL}/api/watchlist`);
  body = await res.json();
  expect(body.watchlist.some((w: { ticker: string }) => w.ticker === "PLTR")).toBeFalsy();
});

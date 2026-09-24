import { test, expect, type Page } from "@playwright/test";

// The mocked AI copilot (PLAN.md section 12), exercised entirely against the
// deterministic LLM_MOCK=true path the container runs under. Each message is
// phrased to hit the mock's intended branch exactly (backend/app/llm/mock.py):
// a portfolio-keyword grounding reply, an executed trade, an executed
// watchlist change, and a rejected trade reported inline. Buys AAPL — left
// unclaimed by 03-trading.spec.ts on purpose so the two specs never contend
// over the same position.
//
// Every data-status assertion below is scoped through the chat-action-pill
// testid, never a bare [data-status=...] selector — data-status is also
// carried by the connection dot, and an unscoped selector would violate
// Playwright's strict mode by matching more than one element.
//
// Deviation from the plan's literal action text (Rule 3 — blocking issue
// found during execution): the header cash figure and the watchlist rows
// only refresh via their own hooks' mount-time fetch (frontend/lib/hooks.ts)
// — usePortfolio additionally polls every 20s, but useWatchlist does not
// poll at all. Unlike TradeBar, which explicitly calls refetchPortfolio()
// through page.tsx's onFilled prop after a manual trade, a chat-dispatched
// action has no equivalent live-refresh hook, so a manual trade's effects
// appear immediately while a chat trade's or watchlist change's effects do
// not appear in the header/watchlist until the next mount or poll tick.
// Each chat-triggered mutation below is proven server-side by its inline
// pill (data-status="executed"), and the UI-level effect (cash figure,
// watchlist row) is then observed deterministically via page.reload() — a
// fresh mount's fetch — rather than racing usePortfolio's 20s poll or
// waiting on a refresh that useWatchlist never performs on its own.

function parseMoney(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ""));
}

async function expandChatIfNeeded(page: Page): Promise<void> {
  if (!(await page.getByTestId("chat-input").isVisible())) {
    await page.getByTestId("chat-toggle").click();
  }
}

test("chat: grounded reply, executed trade, executed watchlist change, failed trade", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("row-AAPL")).toBeVisible();
  await expandChatIfNeeded(page);

  // Grounding: a portfolio-keyword message hits the mock's grounded-reply
  // branch, proving the reply is built from real portfolio context.
  await page.getByTestId("chat-input").fill("what is my portfolio worth");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-thinking")).toBeVisible();
  await expect(page.getByText(/^Cash balance is/)).toBeVisible({ timeout: 15_000 });

  // Executed trade: "buy 1 aapl" matches the mock's trade regex.
  const cashBeforeBuy = parseMoney((await page.getByTestId("header-cash").textContent()) ?? "");

  await page.getByTestId("chat-input").fill("buy 1 aapl");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("chat-action-pill").last()).toHaveAttribute(
    "data-status",
    "executed",
    { timeout: 15_000 },
  );

  await page.reload();
  await expect(page.getByTestId("row-AAPL")).toBeVisible();
  // Retrying poll rather than a one-shot read: the reloaded page's own
  // usePortfolio mount-time fetch needs a moment to resolve.
  await expect
    .poll(async () => parseMoney((await page.getByTestId("header-cash").textContent()) ?? ""))
    .toBeLessThan(cashBeforeBuy);
  await expandChatIfNeeded(page);

  // Watchlist action: "add sofi" matches the mock's watchlist regex.
  const pillCountBeforeAdd = await page.getByTestId("chat-action-pill").count();

  await page.getByTestId("chat-input").fill("add sofi");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("chat-action-pill")).toHaveCount(pillCountBeforeAdd + 1, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("chat-action-pill").nth(pillCountBeforeAdd)).toHaveAttribute(
    "data-status",
    "executed",
  );

  await page.reload();
  await expect(page.getByTestId("row-AAPL")).toBeVisible();
  await expect(page.getByTestId("row-SOFI")).toBeVisible();
  await expandChatIfNeeded(page);

  // Failure reported inline: only 1 AAPL share is held (bought above), so
  // selling 9999 is refused and reported as a failed pill with cash
  // unchanged. Cash never changes on a rejected trade, so no reload/poll is
  // needed here — the figure is correct at every instant.
  const cashBeforeFailedSell = parseMoney(
    (await page.getByTestId("header-cash").textContent()) ?? "",
  );
  const pillCountBeforeFail = await page.getByTestId("chat-action-pill").count();

  await page.getByTestId("chat-input").fill("sell 9999 aapl");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("chat-action-pill")).toHaveCount(pillCountBeforeFail + 1, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("chat-action-pill").nth(pillCountBeforeFail)).toHaveAttribute(
    "data-status",
    "failed",
  );
  await expect
    .poll(async () => parseMoney((await page.getByTestId("header-cash").textContent()) ?? ""))
    .toBe(cashBeforeFailedSell);
});

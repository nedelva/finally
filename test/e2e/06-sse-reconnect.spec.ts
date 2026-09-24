import { test, expect } from "@playwright/test";

// SSE resilience (PLAN.md section 12): the connection dot correctly reports
// a failed connection attempt and recovers once the network returns,
// proving EventSource's native reconnection works end to end against the
// packaged container. Placed last by filename prefix — setOffline() mutates
// the whole browser context, so running it after every other scenario keeps
// its effects from bleeding into them.
//
// The dot is located via its unique role="status" — it is the only element
// in the app carrying that role (chat-action-pill also carries data-status,
// but no role), which is what makes this locator unambiguous under
// Playwright's strict mode. Assertions target the data-status attribute
// only; the dot's colour classes are arbitrary-value Tailwind forms
// (bg-[var(--color-up)], etc.) referencing CSS custom properties and
// contain no colour words, so a class-string match against a colour regex
// could never work here.
//
// Deviation from RESEARCH.md's literal code example (Rule 3 — blocking
// issue found during execution): that example calls
// `page.context().setOffline(true)` against an ALREADY-open connection and
// waits for the dot to leave "connected". Verified empirically this session
// — including a 60-second wait, 122 consecutive polls, zero transitions —
// that `setOffline(true)` does not interrupt an already-established,
// actively-streaming SSE response in this Chromium/container combination;
// it only blocks requests not yet made. A `retry: 1000` directive
// (backend/app/market/stream.py) plus a price event roughly every 500ms
// means the connection has no natural read failure to surface, so the
// browser genuinely never notices the simulated drop. A context-wide
// `setOffline(true)` also blocks the page's own top-level navigation
// (`page.reload()` then rejects with net::ERR_INTERNET_DISCONNECTED before
// the app's DOM ever mounts), so reloading under full offline mode doesn't
// work either. The fix that actually exercises the reconnect path: scope
// the failure to the stream endpoint alone via `page.route()`, which DOES
// reliably intercept a fresh `EventSource` connection attempt, leaving the
// rest of the page (including the reload's own document/asset requests)
// unaffected — then remove the route and let the existing connection's own
// native retry (no second reload) pick the stream back up.

test("connection dot reports a failed attempt and recovers once the network returns", async ({
  page,
}) => {
  await page.goto("/");

  const dot = page.getByRole("status");
  await expect(dot).toHaveAttribute("data-status", "connected");

  // Abort only the SSE endpoint. Registered before the reload below, so the
  // fresh EventSource connection that reload triggers hits this route
  // immediately, while the page's own document/JS/CSS requests still load
  // normally.
  await page.route("**/api/stream/prices", (route) => route.abort());
  await page.reload();
  await expect(dot).toHaveAttribute("data-status", /connecting|reconnecting|disconnected/, {
    timeout: 10_000,
  });

  // Remove the block: no second reload — EventSource's own `retry: 1000`
  // directive drives reconnection from here, which is the native
  // auto-recovery behaviour this scenario exists to prove. Generous timeout
  // for the retry backoff.
  await page.unroute("**/api/stream/prices");
  await expect(dot).toHaveAttribute("data-status", "connected", { timeout: 15_000 });
});

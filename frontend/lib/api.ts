import type {
  AddWatchlistResponse,
  ChatHistoryResponse,
  ChatResponse,
  Portfolio,
  PortfolioHistoryResponse,
  TradeRequest,
  TradeResponse,
  WatchlistResponse,
} from "./types";

/**
 * Thin fetch wrapper for the FinAlly REST API.
 *
 * Per API_CONTRACT.md: `fetch` never throws on a 4xx/5xx HTTP status — only
 * on network failure. Every call here therefore checks `res.ok` explicitly
 * and reads the `{error}` body on failure, rather than relying on a thrown
 * exception. `ApiResult` makes both branches explicit at the call site.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      return { ok: false, error: await readError(res) };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Network error — unable to reach the server." };
  }
}

export function getPortfolio(): Promise<ApiResult<Portfolio>> {
  return getJson<Portfolio>("/api/portfolio");
}

export function getPortfolioHistory(): Promise<ApiResult<PortfolioHistoryResponse>> {
  return getJson<PortfolioHistoryResponse>("/api/portfolio/history");
}

export function getWatchlist(): Promise<ApiResult<WatchlistResponse>> {
  return getJson<WatchlistResponse>("/api/watchlist");
}

export async function postTrade(req: TradeRequest): Promise<ApiResult<TradeResponse>> {
  try {
    const res = await fetch("/api/portfolio/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    // Both 200 (executed) and 400 (validation failure) bodies are
    // meaningful JSON the caller needs to render — the discriminant is the
    // `success` field inside the body, not the HTTP status.
    if (res.status === 200 || res.status === 400) {
      return { ok: true, data: (await res.json()) as TradeResponse };
    }
    return { ok: false, error: await readError(res) };
  } catch {
    return { ok: false, error: "Network error — unable to reach the server." };
  }
}

export async function addWatchlistTicker(
  ticker: string,
): Promise<ApiResult<AddWatchlistResponse>> {
  try {
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    if (!res.ok) {
      return { ok: false, error: await readError(res) };
    }
    return { ok: true, data: (await res.json()) as AddWatchlistResponse };
  } catch {
    return { ok: false, error: "Network error — unable to reach the server." };
  }
}

export async function removeWatchlistTicker(ticker: string): Promise<ApiResult<null>> {
  try {
    const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
      method: "DELETE",
    });
    // 204 No Content — must not call res.json() on an empty body.
    if (res.status === 204) {
      return { ok: true, data: null };
    }
    if (!res.ok) {
      return { ok: false, error: await readError(res) };
    }
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Network error — unable to reach the server." };
  }
}

export function getChatHistory(): Promise<ApiResult<ChatHistoryResponse>> {
  return getJson<ChatHistoryResponse>("/api/chat/history");
}

export async function postChatMessage(message: string): Promise<ApiResult<ChatResponse>> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      return { ok: false, error: await readError(res) };
    }
    return { ok: true, data: (await res.json()) as ChatResponse };
  } catch {
    return { ok: false, error: "Network error — unable to reach the server." };
  }
}

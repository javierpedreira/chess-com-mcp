/**
 * Thin, stateless client for the public Chess.com "Published-Data" API.
 *
 * Docs: https://www.chess.com/news/view/published-data-api
 *
 * Notes:
 * - The API is public and needs no authentication or API key.
 * - Chess.com requires a descriptive `User-Agent` header. Requests without one
 *   may be rejected with HTTP 403. Configure it via the CHESS_API_USER_AGENT
 *   env var (recommended: include a contact email or repo URL).
 * - Everything here is stateless and safe to run in a serverless function.
 */

export const CHESS_API_BASE = "https://api.chess.com/pub";

export const USER_AGENT =
  process.env.CHESS_API_USER_AGENT ??
  "chess-com-mcp/1.0 (+https://github.com/; remote MCP connector)";

/** Error thrown when the Chess.com API responds with a non-2xx status. */
export class ChessApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`Chess.com API request to ${path} failed with HTTP ${status}`);
    this.name = "ChessApiError";
  }
}

async function request(path: string, accept: string): Promise<Response> {
  const url = `${CHESS_API_BASE}${path}`;
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: accept,
    },
    // Stateless: never reuse a cached body across invocations.
    cache: "no-store",
  });
}

/** GET a JSON endpoint and parse it. Throws {@link ChessApiError} on failure. */
export async function fetchJson<T = unknown>(path: string): Promise<T> {
  const res = await request(path, "application/json");
  const text = await res.text();

  if (!res.ok) {
    throw new ChessApiError(res.status, path, text);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // A 2xx with a non-JSON body is unexpected; surface it as an API error.
    throw new ChessApiError(res.status, path, text);
  }
}

/** GET a plain-text endpoint (e.g. PGN). Throws {@link ChessApiError} on failure. */
export async function fetchText(path: string): Promise<string> {
  const res = await request(path, "application/x-chess-pgn, text/plain, */*");
  const text = await res.text();

  if (!res.ok) {
    throw new ChessApiError(res.status, path, text);
  }

  return text;
}

/** Chess.com usernames are case-insensitive; the API expects lowercase. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Club identifiers are the lowercase, hyphenated "url ID" segment. */
export function normalizeClubId(urlId: string): string {
  return urlId.trim().toLowerCase();
}

/** Format a year/month pair into the `yyyy`/`mm` path segments the API uses. */
export function formatYearMonth(
  year: number,
  month: number,
): { yyyy: string; mm: string } {
  return {
    yyyy: String(year),
    mm: String(month).padStart(2, "0"),
  };
}

/** Titles accepted by GET /pub/titled/{title}. */
export const CHESS_TITLES = [
  "GM",
  "WGM",
  "IM",
  "WIM",
  "FM",
  "WFM",
  "NM",
  "WNM",
  "CM",
  "WCM",
] as const;

export type ChessTitle = (typeof CHESS_TITLES)[number];

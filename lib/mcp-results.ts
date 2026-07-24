/**
 * Helpers to turn Chess.com API responses (or errors) into MCP tool results.
 *
 * The MCP CallToolResult shape is `{ content: [...], isError?: boolean }`.
 * We keep everything as `text` content so any MCP client can render it.
 */

import { ChessApiError } from "@/lib/chess";

/**
 * Serverless function responses on Vercel are capped (~4.5 MB). Chess.com game
 * archives for very active players can exceed that, so we guard slightly below
 * the limit and return a clear, actionable message instead of a hard failure.
 */
const MAX_RESULT_BYTES = 4_000_000;

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function tooLargeMessage(context: string, bytes: number): string {
  const mb = (bytes / 1_000_000).toFixed(1);
  return [
    `The response for ${context} is ~${mb} MB, which is too large to return in a`,
    "single MCP message (serverless response limit ~4.5 MB).",
    "Try a narrower request, for example:",
    "- a specific month via get_player_games_by_month(username, year, month),",
    "- the list of available months via get_player_game_archives(username), or",
    "- download_player_games_pgn(...) which is more compact than the JSON games.",
  ].join(" ");
}

/** Wrap arbitrary JSON data as a tool result, guarding against oversized payloads. */
export function jsonResult(data: unknown, context: string): ToolResult {
  const text = JSON.stringify(data);
  const bytes = Buffer.byteLength(text, "utf8");

  if (bytes > MAX_RESULT_BYTES) {
    return textError(tooLargeMessage(context, bytes));
  }

  return { content: [{ type: "text", text }] };
}

/** Wrap plain text (e.g. PGN) as a tool result, guarding against oversized payloads. */
export function textResult(text: string, context: string): ToolResult {
  const bytes = Buffer.byteLength(text, "utf8");

  if (bytes > MAX_RESULT_BYTES) {
    return textError(tooLargeMessage(context, bytes));
  }

  return { content: [{ type: "text", text }] };
}

/** Build an error tool result from a plain message. */
export function textError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Turn any thrown error into a clear, non-throwing tool result. */
export function errorResult(err: unknown, context: string): ToolResult {
  if (err instanceof ChessApiError) {
    switch (err.status) {
      case 404:
        return textError(
          `Not found (HTTP 404): ${context}. The player, club, or archive does not exist on Chess.com (check the spelling — usernames and club IDs are case-insensitive).`,
        );
      case 429:
        return textError(
          `Rate limited (HTTP 429): ${context}. Chess.com is throttling requests; please retry after a short wait.`,
        );
      case 403:
        return textError(
          `Forbidden (HTTP 403): ${context}. Chess.com rejected the request — this usually means a missing or invalid User-Agent header (set the CHESS_API_USER_AGENT env var).`,
        );
      case 410:
        return textError(
          `Gone (HTTP 410): ${context}. This resource has been permanently removed by Chess.com.`,
        );
      default:
        return textError(
          `Chess.com API error (HTTP ${err.status}) for ${context}.`,
        );
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  return textError(`Unexpected error while handling ${context}: ${message}`);
}

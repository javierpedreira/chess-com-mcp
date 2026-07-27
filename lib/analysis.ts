/**
 * Position-analysis helpers.
 *
 * The Chess.com Published-Data API has NO engine/analysis endpoint, so the
 * analysis we offer from a FEN is a link to Chess.com's interactive analysis
 * board (engine + move exploration run in the browser). Zero cost, no engine
 * on the server.
 */

import { USER_AGENT } from "@/lib/chess";

/**
 * Very light FEN sanity check: at least a piece-placement field with 8 ranks
 * and a side-to-move field. Chess.com's analysis board is the real authority.
 */
export function looksLikeFen(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return false;
  const ranks = parts[0].split("/");
  if (ranks.length !== 8) return false;
  return parts[1] === "w" || parts[1] === "b";
}

/** Build the Chess.com interactive analysis-board URL for a FEN. */
export function buildAnalysisUrl(fen: string): string {
  const trimmed = fen.trim();
  return `https://www.chess.com/analysis?tab=analysis&fen=${encodeURIComponent(trimmed)}`;
}

/** Pixel dimensions produced by each dynboard `size` value. */
export const BOARD_IMAGE_SIZES: Record<number, number> = { 1: 240, 2: 480, 3: 720 };

/**
 * Build a Chess.com `dynboard` URL that renders a FEN as a PNG board image.
 *
 * This is an UNOFFICIAL, undocumented Chess.com endpoint (separate from the
 * public /pub API). Testing shows it reliably honours `fen` and `size`
 * (1=240px, 2=480px, 3=720px); other query params (board theme, piece set,
 * coordinates, flip) are ignored and it renders a default green board. It may
 * change or stop working without notice.
 *
 * @param size 1, 2 or 3 (240/480/720 px). Defaults to 2.
 */
export function buildBoardImageUrl(fen: string, size = 2): string {
  const trimmed = fen.trim();
  const s = size in BOARD_IMAGE_SIZES ? size : 2;
  return `https://www.chess.com/dynboard?fen=${encodeURIComponent(trimmed)}&size=${s}`;
}

/**
 * Build a Chess.com analysis-board URL that starts from `fen` and plays through
 * a line of SAN moves. Verified behaviour: `?fen=…&pgn=…` is rejected, but a
 * full PGN with `[SetUp "1"]` / `[FEN "…"]` headers loads the custom start plus
 * the moves (with engine + step-by-step navigation).
 *
 * @param pgn A line of moves in SAN, e.g. `28... Re2+ 29. Kg1 Rd1#`.
 */
export function buildInteractiveLineUrl(fen: string, pgn: string): string {
  const fullPgn = `[SetUp "1"]\n[FEN "${fen.trim()}"]\n\n${pgn.trim()}`;
  return `https://www.chess.com/analysis?pgn=${encodeURIComponent(fullPgn)}&tab=analysis`;
}

/**
 * Download the `dynboard` PNG for a FEN and return it as base64, so a tool can
 * embed it inline as MCP image content. Throws on a non-2xx response.
 */
export async function fetchBoardImage(
  fen: string,
  size = 2,
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(buildBoardImageUrl(fen, size), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`dynboard responded with HTTP ${res.status}`);
  }
  const mimeType = res.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { base64: bytes.toString("base64"), mimeType };
}

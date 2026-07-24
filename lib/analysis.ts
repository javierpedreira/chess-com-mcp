/**
 * Position-analysis helpers.
 *
 * The Chess.com Published-Data API has NO engine/analysis endpoint, so the
 * analysis we offer from a FEN is a link to Chess.com's interactive analysis
 * board (engine + move exploration run in the browser). Zero cost, no engine
 * on the server.
 */

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

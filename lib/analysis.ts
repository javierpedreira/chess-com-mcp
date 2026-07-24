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

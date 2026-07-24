/**
 * Position-analysis helpers.
 *
 * The Chess.com Published-Data API has NO engine/analysis endpoint, so this
 * module adds analysis capabilities from a FEN in two ways:
 *
 * 1. `buildAnalysisUrls` — links to open the position in an interactive
 *    analysis board (Chess.com / Lichess). Zero cost, no engine.
 * 2. `fetchLichessCloudEval` — a real Stockfish evaluation from Lichess'
 *    free, no-auth Cloud Evaluation API (only for positions already present
 *    in their cloud database; returns null otherwise).
 */

import { USER_AGENT } from "@/lib/chess";

export type AnalysisUrls = {
  chesscom: string;
  lichess: string;
};

/** Error thrown when the Lichess API responds with a non-2xx (other than 404). */
export class LichessApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Lichess cloud-eval request failed with HTTP ${status}`);
    this.name = "LichessApiError";
  }
}

/**
 * Very light FEN sanity check: at least a piece-placement field with 8 ranks
 * and a side-to-move field. The analysis providers are the real authority.
 */
export function looksLikeFen(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return false;
  const ranks = parts[0].split("/");
  if (ranks.length !== 8) return false;
  return parts[1] === "w" || parts[1] === "b";
}

/** Build interactive analysis-board URLs for a FEN. */
export function buildAnalysisUrls(fen: string): AnalysisUrls {
  const trimmed = fen.trim();
  return {
    // Chess.com analysis board takes the FEN as a query param.
    chesscom: `https://www.chess.com/analysis?tab=analysis&fen=${encodeURIComponent(trimmed)}`,
    // Lichess' canonical shareable analysis URL uses the FEN in the path with
    // spaces replaced by underscores (slashes stay as-is).
    lichess: `https://lichess.org/analysis/${trimmed.replace(/ /g, "_")}`,
  };
}

/**
 * Fetch a Stockfish cloud evaluation from Lichess for a FEN.
 *
 * @param fen      Position in FEN notation.
 * @param multiPv  Number of principal variations to return (1-5).
 * @returns The raw Lichess cloud-eval JSON, or `null` if the position is not
 *          in the cloud database (HTTP 404).
 */
export async function fetchLichessCloudEval(
  fen: string,
  multiPv: number,
): Promise<unknown | null> {
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(
    fen.trim(),
  )}&multiPv=${multiPv}`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();

  // 404 => position simply isn't in Lichess' cloud database (expected, common).
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new LichessApiError(res.status, text);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new LichessApiError(res.status, text);
  }
}

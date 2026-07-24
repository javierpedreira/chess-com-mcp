import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import {
  CHESS_TITLES,
  fetchJson,
  fetchText,
  formatYearMonth,
  normalizeClubId,
  normalizeUsername,
} from "@/lib/chess";
import {
  buildAnalysisUrls,
  fetchLichessCloudEval,
  looksLikeFen,
} from "@/lib/analysis";
import {
  errorResult,
  jsonResult,
  textError,
  textResult,
} from "@/lib/mcp-results";

// Run on the Node.js runtime (mcp-handler + Buffer usage), never Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long-running archive downloads (Vercel plan limits still apply).
export const maxDuration = 60;

// Reusable Zod fields with descriptions the model can rely on.
const usernameField = z
  .string()
  .min(1)
  .describe("Chess.com username (case-insensitive), e.g. 'hikaru' or 'MagnusCarlsen'.");

const clubIdField = z
  .string()
  .min(1)
  .describe(
    "Club URL identifier — the lowercase, hyphenated slug from the club's URL, e.g. 'chess-com-developer-community'.",
  );

const yearField = z.coerce
  .number()
  .int()
  .min(2007)
  .max(2100)
  .describe("Four-digit year, e.g. 2024. Chess.com data starts in 2007.");

const monthField = z.coerce
  .number()
  .int()
  .min(1)
  .max(12)
  .describe("Month number 1-12 (will be zero-padded automatically).");

const fenField = z
  .string()
  .min(1)
  .describe(
    "Chess position in FEN notation, e.g. 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'.",
  );

const handler = createMcpHandler(
  (server) => {
    // ----------------------------------------------------------------- Players

    server.tool(
      "get_player_profile",
      "Get a Chess.com player's public profile (name, country, followers, join date, status, etc.). Wraps GET /pub/player/{username}.",
      { username: usernameField },
      async ({ username }) => {
        const user = normalizeUsername(username);
        try {
          const data = await fetchJson(`/player/${user}`);
          return jsonResult(data, `profile of '${user}'`);
        } catch (err) {
          return errorResult(err, `profile of '${user}'`);
        }
      },
    );

    server.tool(
      "get_player_stats",
      "Get a player's game statistics (ratings and records for rapid, blitz, bullet, daily, tactics, puzzle rush, etc.). Wraps GET /pub/player/{username}/stats.",
      { username: usernameField },
      async ({ username }) => {
        const user = normalizeUsername(username);
        try {
          const data = await fetchJson(`/player/${user}/stats`);
          return jsonResult(data, `stats of '${user}'`);
        } catch (err) {
          return errorResult(err, `stats of '${user}'`);
        }
      },
    );

    server.tool(
      "is_player_online",
      "Estimate whether a player is currently online. The public API has no realtime presence endpoint, so this is derived from the profile's `last_online` timestamp (considered online if active within the last 5 minutes). Wraps GET /pub/player/{username}.",
      { username: usernameField },
      async ({ username }) => {
        const user = normalizeUsername(username);
        try {
          const profile = await fetchJson<{ last_online?: number; status?: string }>(
            `/player/${user}`,
          );
          const lastOnline = profile.last_online ?? null;
          const nowSeconds = Math.floor(Date.now() / 1000);
          const secondsSince = lastOnline === null ? null : nowSeconds - lastOnline;
          const isOnline = secondsSince !== null && secondsSince <= 5 * 60;

          return jsonResult(
            {
              username: user,
              is_online: isOnline,
              basis: "derived from last_online timestamp (<= 5 minutes = online)",
              last_online: lastOnline,
              last_online_iso:
                lastOnline === null ? null : new Date(lastOnline * 1000).toISOString(),
              seconds_since_last_online: secondsSince,
              account_status: profile.status ?? null,
            },
            `online status of '${user}'`,
          );
        } catch (err) {
          return errorResult(err, `online status of '${user}'`);
        }
      },
    );

    server.tool(
      "get_titled_players",
      "List all usernames holding a given chess title (e.g. all Grandmasters). Wraps GET /pub/titled/{title}.",
      {
        title: z
          .enum(CHESS_TITLES)
          .describe(
            "Title abbreviation. One of: GM, WGM, IM, WIM, FM, WFM, NM, WNM, CM, WCM.",
          ),
      },
      async ({ title }) => {
        const t = title.toUpperCase();
        try {
          const data = await fetchJson(`/titled/${t}`);
          return jsonResult(data, `titled players '${t}'`);
        } catch (err) {
          return errorResult(err, `titled players '${t}'`);
        }
      },
    );

    // ------------------------------------------------------------------- Games

    server.tool(
      "get_player_current_games",
      "Get a player's currently in-progress (Daily/correspondence) games. Wraps GET /pub/player/{username}/games.",
      { username: usernameField },
      async ({ username }) => {
        const user = normalizeUsername(username);
        try {
          const data = await fetchJson(`/player/${user}/games`);
          return jsonResult(data, `current games of '${user}'`);
        } catch (err) {
          return errorResult(err, `current games of '${user}'`);
        }
      },
    );

    server.tool(
      "get_player_games_by_month",
      "Get all of a player's finished games for a specific month, as structured JSON (includes PGN, ratings, results, time control, etc.). Wraps GET /pub/player/{username}/games/{yyyy}/{mm}.",
      { username: usernameField, year: yearField, month: monthField },
      async ({ username, year, month }) => {
        const user = normalizeUsername(username);
        const { yyyy, mm } = formatYearMonth(year, month);
        const context = `games of '${user}' for ${yyyy}-${mm}`;
        try {
          const data = await fetchJson(`/player/${user}/games/${yyyy}/${mm}`);
          return jsonResult(data, context);
        } catch (err) {
          return errorResult(err, context);
        }
      },
    );

    server.tool(
      "get_player_game_archives",
      "Get the list of monthly archive URLs available for a player (each URL corresponds to one month of games). Useful to discover which months exist before fetching them. Wraps GET /pub/player/{username}/games/archives.",
      { username: usernameField },
      async ({ username }) => {
        const user = normalizeUsername(username);
        try {
          const data = await fetchJson(`/player/${user}/games/archives`);
          return jsonResult(data, `game archives of '${user}'`);
        } catch (err) {
          return errorResult(err, `game archives of '${user}'`);
        }
      },
    );

    server.tool(
      "download_player_games_pgn",
      "Download all of a player's games for a specific month as a single PGN text file (raw PGN, more compact than the JSON representation). Wraps GET /pub/player/{username}/games/{yyyy}/{mm}/pgn.",
      { username: usernameField, year: yearField, month: monthField },
      async ({ username, year, month }) => {
        const user = normalizeUsername(username);
        const { yyyy, mm } = formatYearMonth(year, month);
        const context = `PGN of '${user}' for ${yyyy}-${mm}`;
        try {
          const pgn = await fetchText(`/player/${user}/games/${yyyy}/${mm}/pgn`);
          return textResult(pgn, context);
        } catch (err) {
          return errorResult(err, context);
        }
      },
    );

    // ------------------------------------------------------------------- Clubs

    server.tool(
      "get_club_profile",
      "Get a club's public profile (name, description, admin list, member count, creation date, etc.). Wraps GET /pub/club/{url_id}.",
      { url_id: clubIdField },
      async ({ url_id }) => {
        const club = normalizeClubId(url_id);
        try {
          const data = await fetchJson(`/club/${club}`);
          return jsonResult(data, `club profile '${club}'`);
        } catch (err) {
          return errorResult(err, `club profile '${club}'`);
        }
      },
    );

    server.tool(
      "get_club_members",
      "Get a club's members grouped by activity (weekly, monthly, all-time), each with username and last-activity timestamp. Wraps GET /pub/club/{url_id}/members.",
      { url_id: clubIdField },
      async ({ url_id }) => {
        const club = normalizeClubId(url_id);
        try {
          const data = await fetchJson(`/club/${club}/members`);
          return jsonResult(data, `club members '${club}'`);
        } catch (err) {
          return errorResult(err, `club members '${club}'`);
        }
      },
    );

    // -------------------------------------------------------------- Analysis
    // Note: the Chess.com public API has no engine/analysis endpoint. These
    // tools work from a FEN using analysis-board URLs and Lichess' free,
    // no-auth Cloud Evaluation API. Handy for training/exercise workflows.

    server.tool(
      "get_analysis_board_url",
      "Given a chess position (FEN), return links to open it in an interactive analysis board (Chess.com and Lichess), where an engine and move exploration are available in the browser. Does not require an engine on the server.",
      { fen: fenField },
      async ({ fen }) => {
        if (!looksLikeFen(fen)) {
          return textError(
            `'${fen}' does not look like a valid FEN. Expected something like 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'.`,
          );
        }
        return jsonResult(
          { fen: fen.trim(), analysis_urls: buildAnalysisUrls(fen) },
          `analysis board URLs for FEN`,
        );
      },
    );

    server.tool(
      "analyze_fen",
      "Evaluate a chess position (FEN) with Stockfish via the Lichess Cloud Evaluation API, returning the engine score and best line(s). Also includes analysis-board URLs. Note: only positions present in Lichess' cloud database are covered (common/opening positions usually are; rare positions may return no evaluation — use the URLs to analyze those interactively).",
      {
        fen: fenField,
        multiPv: z.coerce
          .number()
          .int()
          .min(1)
          .max(5)
          .default(1)
          .describe("How many principal variations (best lines) to return, 1-5. Default 1."),
      },
      async ({ fen, multiPv }) => {
        if (!looksLikeFen(fen)) {
          return textError(
            `'${fen}' does not look like a valid FEN. Expected something like 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'.`,
          );
        }
        const analysisUrls = buildAnalysisUrls(fen);
        try {
          const cloudEval = await fetchLichessCloudEval(fen, multiPv);
          return jsonResult(
            {
              fen: fen.trim(),
              analysis_urls: analysisUrls,
              cloud_eval: cloudEval,
              note:
                cloudEval === null
                  ? "This position is not in Lichess' cloud-eval database. Open one of the analysis_urls to analyze it interactively with an engine."
                  : "cloud_eval is the raw Lichess response. Each pv has UCI `moves`; scores are `cp` (centipawns) or `mate` (forced mate in N). Open analysis_urls to explore interactively.",
            },
            `cloud evaluation for FEN`,
          );
        } catch (err) {
          // Never throw: fall back to the analysis-board URLs.
          return jsonResult(
            {
              fen: fen.trim(),
              analysis_urls: analysisUrls,
              cloud_eval: null,
              note: `Could not fetch a cloud evaluation (${
                err instanceof Error ? err.message : String(err)
              }). Open one of the analysis_urls to analyze the position interactively.`,
            },
            `cloud evaluation for FEN`,
          );
        }
      },
    );
  },
  {
    // Advertised server metadata.
    serverInfo: {
      name: "chess-com-mcp",
      version: "1.0.0",
    },
  },
  {
    // Route is mounted at app/[transport]/route.ts, so the base path is "/".
    basePath: "",
    // No Redis configured -> stateless Streamable HTTP only (the transport
    // used by claude.ai custom connectors). This is intentional for serverless.
    verboseLogs: false,
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };

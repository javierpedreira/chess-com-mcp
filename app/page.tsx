const TOOLS = [
  ["get_player_profile", "Public profile of a player"],
  ["get_player_stats", "Ratings and game records"],
  ["is_player_online", "Online status (derived from last_online)"],
  ["get_titled_players", "Usernames for a given title (GM, IM, …)"],
  ["get_player_current_games", "In-progress daily games"],
  ["get_player_games_by_month", "Finished games for a month (JSON)"],
  ["get_player_game_archives", "List of available monthly archives"],
  ["download_player_games_pgn", "Games for a month as PGN text"],
  ["get_club_profile", "Public profile of a club"],
  ["get_club_members", "Club members grouped by activity"],
  ["get_analysis_board_url", "Chess.com analysis-board link from a FEN"],
] as const;

export default function Home() {
  return (
    <>
      <h1 style={{ marginBottom: 0 }}>♟️ Chess.com MCP Server</h1>
      <p style={{ color: "#555", marginTop: "0.25rem" }}>
        A remote Model Context Protocol server for the public Chess.com API.
      </p>

      <p>
        The MCP endpoint is available at{" "}
        <code
          style={{
            background: "#eee",
            padding: "0.15rem 0.4rem",
            borderRadius: 4,
          }}
        >
          /mcp
        </code>
        . Add this deployment&apos;s <code>/mcp</code> URL as a custom connector
        in claude.ai (Settings → Connectors → Add custom connector).
      </p>

      <h2>Available tools</h2>
      <ul>
        {TOOLS.map(([name, desc]) => (
          <li key={name}>
            <code>{name}</code> — {desc}
          </li>
        ))}
      </ul>

      <p style={{ color: "#777", fontSize: "0.9rem" }}>
        Data provided by the public Chess.com Published-Data API. This project is
        not affiliated with Chess.com.
      </p>
    </>
  );
}

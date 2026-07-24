# ♟️ Chess.com MCP Server

Remote **MCP (Model Context Protocol)** server for the public
[Chess.com](https://www.chess.com/news/view/published-data-api) API, written in
TypeScript with **Next.js (App Router)** + [`mcp-handler`](https://www.npmjs.com/package/mcp-handler)
and the **Streamable HTTP** transport.

It's designed to be deployed to **Vercel** and added as a remote *custom
connector* in [claude.ai](https://claude.ai). The Chess.com API is public (no
authentication or API key), so **the connector needs no OAuth or secrets
either**.

The MCP endpoint is exposed at **`/mcp`**.

---

## Tools

### Players
| Tool | Chess.com endpoint | Description |
| --- | --- | --- |
| `get_player_profile(username)` | `GET /pub/player/{username}` | Public player profile. |
| `get_player_stats(username)` | `GET /pub/player/{username}/stats` | Ratings and records per time class. |
| `is_player_online(username)` | `GET /pub/player/{username}` | Online status **derived** from `last_online` (≤ 5 min ⇒ online). |
| `get_titled_players(title)` | `GET /pub/titled/{title}` | Usernames holding a given title (GM, IM, …). |

### Games
| Tool | Chess.com endpoint | Description |
| --- | --- | --- |
| `get_player_current_games(username)` | `GET /pub/player/{username}/games` | In-progress Daily games. |
| `get_player_games_by_month(username, year, month)` | `GET /pub/player/{username}/games/{yyyy}/{mm}` | Finished games for a month (JSON). |
| `get_player_game_archives(username)` | `GET /pub/player/{username}/games/archives` | List of available monthly archives. |
| `download_player_games_pgn(username, year, month)` | `GET /pub/player/{username}/games/{yyyy}/{mm}/pgn` | Games for a month as PGN (plain text). |

### Clubs
| Tool | Chess.com endpoint | Description |
| --- | --- | --- |
| `get_club_profile(url_id)` | `GET /pub/club/{url_id}` | Public club profile. |
| `get_club_members(url_id)` | `GET /pub/club/{url_id}/members` | Members grouped by activity. |

### Analysis (from a FEN)
The Chess.com public API has **no engine/analysis endpoint**, so this tool
returns a link to analyze the position in the browser:

| Tool | Description |
| --- | --- |
| `get_analysis_board_url(fen)` | Link to open the position in Chess.com's analysis board (engine + move exploration run in the browser). |
| `get_board_image_url(fen, size?)` | URL rendering the position as a PNG board image via Chess.com's `dynboard` (`size` 1/2/3 = 240/480/720px). ⚠️ Unofficial, undocumented endpoint — may change without notice. |

> **`title`** accepts: `GM, WGM, IM, WIM, FM, WFM, NM, WNM, CM, WCM`.
> **`url_id`** is the lowercase *slug* from the club's URL (e.g.
> `chess-com-developer-community`).

Each tool returns the Chess.com JSON as-is (or the PGN text for
`download_player_games_pgn`). Usernames and club IDs are normalized to
lowercase automatically.

---

## Error handling and limits

- If Chess.com responds with **404** (player/club/archive not found), **429**
  (rate limit), **403** (invalid User-Agent), etc., the tool returns a clear
  message with `isError: true` **instead of throwing an uncaught exception**.
- **Stateless**: every call is independent (suitable for serverless functions).
  No Redis is used; only the **Streamable HTTP** transport (the one claude.ai
  custom connectors use).
- **Large responses (> 1 MB):** monthly archives for very active players can be
  large. Vercel serverless functions have a response limit (~4.5 MB); if it's
  exceeded, the tool returns an actionable message suggesting alternatives (a
  specific month, the archives list, or the PGN, which is more compact).
  Responses between 1 and ~4 MB are returned normally.

---

## Requirements

- Node.js ≥ 20
- A [Vercel](https://vercel.com) account (the Hobby plan is enough)

## Local development

```bash
npm install
cp .env.example .env.local   # optional but recommended: set your User-Agent
npm run dev
```

- Info page: <http://localhost:3000>
- MCP endpoint: <http://localhost:3000/mcp>

Quick check (list tools over Streamable HTTP):

```bash
curl -sS http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Type-check and build:

```bash
npm run typecheck
npm run build
```

To try it with the official MCP inspector:

```bash
npx @modelcontextprotocol/inspector
# In the inspector: Transport = "Streamable HTTP", URL = http://localhost:3000/mcp
```

---

## Environment variable

| Variable | Required | Description |
| --- | --- | --- |
| `CHESS_API_USER_AGENT` | Recommended | Descriptive User-Agent that Chess.com asks API consumers to send (ideally with a contact or the repo URL). Without a valid User-Agent, Chess.com may respond with **403**. If unset, a default is used. |

---

## Deploy to Vercel

### Option A — from the web (recommended)

1. Push this repository to GitHub (see below).
2. In [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
3. Vercel detects Next.js automatically; no build settings to change.
4. (Recommended) Under **Settings → Environment Variables** add
   `CHESS_API_USER_AGENT` with a value like
   `chess-com-mcp/1.0 (+https://github.com/<your-user>/chess-com-mcp; contact: you@email.com)`.
5. **Deploy**. When it finishes you'll get a URL like
   `https://<your-project>.vercel.app`.
6. Your MCP endpoint is **`https://<your-project>.vercel.app/mcp`**.

### Option B — from the CLI

```bash
npm i -g vercel
vercel            # first deploy (preview) — follow the wizard
vercel --prod     # production deploy
# To configure the User-Agent:
vercel env add CHESS_API_USER_AGENT
```

---

## Add the connector in claude.ai

1. Open **claude.ai → Settings → Connectors**.
2. Click **Add custom connector**.
3. Fill in:
   - **Name:** `Chess.com` (or whatever you prefer)
   - **URL:** `https://<your-project>.vercel.app/mcp`
4. Save. Since the server requires no authentication, it **won't** ask for any
   OAuth step.
5. In a new conversation, enable the connector and try, for example:
   > *"Look up Hikaru's profile and stats on Chess.com"*
   > *"Which GMs are on Chess.com?"*
   > *"Download MagnusCarlsen's games from January 2024 as PGN"*

> **Note:** remote custom connectors require a claude.ai plan that supports them
> (Pro/Team/Enterprise, subject to availability). The transport used is
> **Streamable HTTP**.

---

## Project structure

```
chess-com-mcp/
├── app/
│   ├── [transport]/
│   │   └── route.ts        # MCP handler (GET/POST/DELETE) → exposes /mcp
│   ├── layout.tsx          # Layout for the info page
│   └── page.tsx            # Landing page at / documenting the endpoint
├── lib/
│   ├── chess.ts            # Stateless Chess.com API client
│   ├── analysis.ts         # FEN helpers + Chess.com analysis-board URL
│   └── mcp-results.ts      # Result/error formatting + size guard
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

---

## License

MIT. Data served by the public Chess.com API. This project is not affiliated
with Chess.com.

# ♟️ Chess.com MCP Server

Servidor **MCP (Model Context Protocol)** remoto para la API pública de
[Chess.com](https://www.chess.com/news/view/published-data-api), escrito en
TypeScript con **Next.js (App Router)** + [`mcp-handler`](https://www.npmjs.com/package/mcp-handler)
y transporte **Streamable HTTP**.

Está pensado para desplegarse en **Vercel** y añadirse como *custom connector*
remoto en [claude.ai](https://claude.ai). La API de Chess.com es pública (sin
autenticación ni API key), así que **el conector tampoco necesita OAuth ni
secretos**.

El endpoint MCP queda expuesto en **`/mcp`**.

---

## Herramientas (tools)

### Jugadores
| Tool | Endpoint Chess.com | Descripción |
| --- | --- | --- |
| `get_player_profile(username)` | `GET /pub/player/{username}` | Perfil público del jugador. |
| `get_player_stats(username)` | `GET /pub/player/{username}/stats` | Ratings y récords por modalidad. |
| `is_player_online(username)` | `GET /pub/player/{username}` | Estado online **deducido** de `last_online` (≤ 5 min ⇒ online). |
| `get_titled_players(title)` | `GET /pub/titled/{title}` | Lista de usuarios con un título (GM, IM, …). |

### Partidas
| Tool | Endpoint Chess.com | Descripción |
| --- | --- | --- |
| `get_player_current_games(username)` | `GET /pub/player/{username}/games` | Partidas Daily en curso. |
| `get_player_games_by_month(username, year, month)` | `GET /pub/player/{username}/games/{yyyy}/{mm}` | Partidas terminadas de un mes (JSON). |
| `get_player_game_archives(username)` | `GET /pub/player/{username}/games/archives` | Lista de archivos mensuales disponibles. |
| `download_player_games_pgn(username, year, month)` | `GET /pub/player/{username}/games/{yyyy}/{mm}/pgn` | Partidas de un mes en PGN (texto plano). |

### Clubs
| Tool | Endpoint Chess.com | Descripción |
| --- | --- | --- |
| `get_club_profile(url_id)` | `GET /pub/club/{url_id}` | Perfil público del club. |
| `get_club_members(url_id)` | `GET /pub/club/{url_id}/members` | Miembros agrupados por actividad. |

> **`title`** acepta: `GM, WGM, IM, WIM, FM, WFM, NM, WNM, CM, WCM`.
> **`url_id`** es el *slug* en minúsculas de la URL del club (p. ej.
> `chess-com-developer-community`).

Cada tool devuelve el JSON de Chess.com tal cual (o el texto PGN en el caso de
`download_player_games_pgn`). Los usernames y club IDs se normalizan a
minúsculas automáticamente.

---

## Manejo de errores y límites

- Si Chess.com responde **404** (jugador/club/archivo inexistente), **429**
  (rate limit), **403** (User-Agent inválido), etc., la tool devuelve un mensaje
  claro con `isError: true` **en lugar de lanzar una excepción sin capturar**.
- **Sin estado**: cada llamada es independiente (apto para funciones
  serverless). No se usa Redis; solo transporte **Streamable HTTP** (el que usan
  los custom connectors de claude.ai).
- **Respuestas grandes (> 1 MB):** los archivos mensuales de jugadores muy
  activos pueden ser grandes. Las funciones serverless de Vercel tienen un
  límite de respuesta (~4.5 MB); si se supera, la tool devuelve un mensaje
  accionable sugiriendo alternativas (mes concreto, lista de archivos, o el PGN,
  que es más compacto). Respuestas de entre 1 y ~4 MB se devuelven con
  normalidad.

---

## Requisitos

- Node.js ≥ 20
- Una cuenta de [Vercel](https://vercel.com) (el plan Hobby es suficiente)

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # opcional pero recomendado: ajusta el User-Agent
npm run dev
```

- Página informativa: <http://localhost:3000>
- Endpoint MCP: <http://localhost:3000/mcp>

Comprobación rápida (lista de tools vía Streamable HTTP):

```bash
curl -sS http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Type-check y build:

```bash
npm run typecheck
npm run build
```

Para probarlo con el inspector oficial de MCP:

```bash
npx @modelcontextprotocol/inspector
# En el inspector: Transport = "Streamable HTTP", URL = http://localhost:3000/mcp
```

---

## Variable de entorno

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `CHESS_API_USER_AGENT` | Recomendada | User-Agent descriptivo que Chess.com pide a los consumidores de su API (idealmente con un contacto o URL del repo). Sin un User-Agent válido, Chess.com puede responder **403**. Si no se define, se usa uno por defecto. |

---

## Despliegue en Vercel

### Opción A — desde la web (recomendada)

1. Sube este repositorio a GitHub (ver más abajo).
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repo.
3. Vercel detecta Next.js automáticamente; no hace falta cambiar nada de build.
4. (Recomendado) En **Settings → Environment Variables** añade
   `CHESS_API_USER_AGENT` con un valor como
   `chess-com-mcp/1.0 (+https://github.com/<tu-usuario>/chess-com-mcp; contact: tu@email.com)`.
5. **Deploy**. Al terminar tendrás una URL tipo
   `https://<tu-proyecto>.vercel.app`.
6. Tu endpoint MCP es **`https://<tu-proyecto>.vercel.app/mcp`**.

### Opción B — desde la CLI

```bash
npm i -g vercel
vercel            # primer deploy (preview) — sigue el asistente
vercel --prod     # deploy a producción
# Para configurar el User-Agent:
vercel env add CHESS_API_USER_AGENT
```

---

## Añadir el conector en claude.ai

1. Abre **claude.ai → Settings (Ajustes) → Connectors**.
2. Pulsa **Add custom connector**.
3. Rellena:
   - **Name:** `Chess.com` (o el que prefieras)
   - **URL:** `https://<tu-proyecto>.vercel.app/mcp`
4. Guarda. Como el servidor no requiere autenticación, **no** te pedirá ningún
   paso de OAuth.
5. En una conversación nueva, activa el conector y prueba, por ejemplo:
   > *«Busca el perfil y las estadísticas de Hikaru en Chess.com»*
   > *«¿Qué GMs hay en Chess.com?»*
   > *«Descárgame en PGN las partidas de MagnusCarlsen de enero de 2024»*

> **Nota:** los custom connectors remotos requieren un plan de claude.ai que los
> soporte (Pro/Team/Enterprise según disponibilidad). El transporte usado es
> **Streamable HTTP**.

---

## Estructura del proyecto

```
chess-com-mcp/
├── app/
│   ├── [transport]/
│   │   └── route.ts        # Handler MCP (GET/POST/DELETE) → expone /mcp
│   ├── layout.tsx          # Layout de la página informativa
│   └── page.tsx            # Landing en / que documenta el endpoint
├── lib/
│   ├── chess.ts            # Cliente stateless de la API de Chess.com
│   └── mcp-results.ts      # Formateo de resultados/errores + guarda de tamaño
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

---

## Licencia

MIT. Datos servidos por la API pública de Chess.com. Proyecto no afiliado a
Chess.com.

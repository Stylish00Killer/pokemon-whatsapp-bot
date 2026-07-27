# EVE BOT ⚡

A feature-packed WhatsApp bot with Pokémon adventures, anime card game, economy system, moderation, media tools, and AI chat — built on [Baileys](https://github.com/WhiskeySockets/Baileys) and **SQLite** (via better-sqlite3).

## How to Run

```bash
bash start.sh
```

The `start.sh` script:
1. Builds the React dashboard if `dashboard/dist` is missing or source files are newer
2. Resolves system library paths for the `canvas` npm package
3. Starts the bot via `node index.js`

The **Start Bot** workflow runs this automatically.

## Project Structure

```
eve-bot/
├── index.js              # Entry point
├── start.sh              # Build + launch script (workflow uses this)
├── src/
│   ├── aurora.js         # Bot init & command loader
│   ├── config/index.js   # Env config (reads .env)
│   ├── web.js            # Express dashboard server + all API routes
│   ├── database/         # SQLite KV + economy models
│   ├── Structures/       # WAclient, Functions, Contact
│   ├── Handlers/         # Message/event dispatchers
│   ├── Commands/         # Command modules by category (108 commands)
│   └── Helpers/          # XP stats, card/spawn data, session backup
├── dashboard/
│   ├── src/              # React SPA (Vite + React Router)
│   │   ├── pages/        # 23 pages including Analytics, AICenter, Notifications
│   │   ├── components/   # Shared UI components (GlassCard, Button, etc.)
│   │   ├── context/      # AuthContext, ThemeContext, ToastContext
│   │   ├── hooks/        # useStats, useLogs
│   │   └── services/     # api.js (centralized fetch client)
│   └── dist/             # Built output (served by Express)
├── sessions/             # Baileys WhatsApp session files
├── database.sqlite       # Main SQLite database
└── assets/               # Images, fonts, JSON data
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable         | Required | Description |
|------------------|----------|-------------|
| `NAME`           | Yes      | Bot display name |
| `PREFIX`         | Yes      | Command prefix (default `-`) |
| `OWNER`          | Yes      | Your WhatsApp number (no `+`) |
| `PORT`           | No       | Dashboard port (default `3000`) |
| `ADMIN_PASSWORD` | No       | Dashboard login password (default `0000`) |
| `OPENAI_KEY`     | No       | OpenAI API key for AI chat |
| `REMOVEBG_KEY`   | No       | remove.bg key for background removal |
| `SESSION_SECRET` | No       | Cookie signing secret (set in Replit Secrets) |

## Dashboard

The web dashboard runs on port 3000 and provides:

- **Dashboard** — live stats, QR pairing, metrics charts
- **Live Logs** — real-time SSE log stream with filtering
- **Commands** — browse, search, enable/disable all 108 commands
- **Analytics** — hourly heatmap, top commands, economy overview, DB sizes
- **Notifications** — event log with browser desktop notification support
- **WhatsApp** — Chats, Messages, Groups, Contacts management
- **DB Studio** — browse/query SQLite tables with write-mode toggle
- **Assets** — manage bot image/data assets
- **Backup** — session and database snapshot management
- **AI Center** — configure AI provider integrations (OpenAI, Gemini, Groq, etc.)
- **Monitoring** — CPU/RAM history, health checks, error timeline
- **Dev Tools** — hot reload, restart, heap/process info
- **Theme Builder** — customize colors, font, compact mode

Login password: set `ADMIN_PASSWORD` in `.env` (default: `0000`).

## User Preferences

- Keep the glassmorphism dark design theme (`--bg: #030309`, purple/cyan accent)
- Do NOT redesign from scratch — build on existing structure
- Maintain the existing Express + SQLite + React architecture
- Keep the `dashboard/src/` component structure (`pages/`, `components/`, `context/`, `hooks/`, `services/`)

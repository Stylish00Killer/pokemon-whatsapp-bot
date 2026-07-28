# EVE BOT ⚡ — Workspace

This workspace contains two independent WhatsApp bots:

| Bot | Directory | Workflow |
|---|---|---|
| EVE Bot (full-featured) | `eve-bot/` | **Start Bot** |
| Pokémon Bot (focused battles) | `pokemon-bot/` | **Pokemon Bot** |

---

## eve-bot/

A feature-packed WhatsApp bot with Pokémon adventures, anime card game, economy system, moderation, media tools, and AI chat — built on [Baileys](https://github.com/WhiskeySockets/Baileys) and **SQLite**.

### How to Run

Use the **Start Bot** workflow, or manually:

```bash
cd eve-bot && bash start.sh
```

The script:
1. Resolves system library paths (`libuuid.so.1`) for the `canvas` package
2. Builds the React dashboard if `dashboard/dist` is missing or stale
3. Starts the bot via `node index.js`

### Structure

```
eve-bot/
├── index.js              # Entry point
├── start.sh              # Build + launch script
├── serve.js              # Auto-restart supervisor
├── config.js             # Central config (BOT_NAME, PREFIX)
├── src/
│   ├── aurora.js         # Bot init & command loader
│   ├── web.js            # Express dashboard + all API routes
│   ├── database/         # SQLite KV + economy models
│   ├── Structures/       # WAclient, Functions, Contact
│   ├── Handlers/         # Message/event dispatchers
│   ├── Commands/         # Command modules (Cards, Owner, Pokemons)
│   └── Helpers/          # XP stats, card/spawn data, session backup
├── dashboard/
│   └── src/              # React SPA (Vite)
├── sessions/             # Baileys WhatsApp session files
└── database.sqlite       # Main SQLite database
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NAME` | Yes | Bot display name |
| `PREFIX` | Yes | Command prefix (default `-`) |
| `OWNER` | Yes | Your WhatsApp number (no `+`) |
| `PORT` | No | Dashboard port (default `3000`) |
| `ADMIN_PASSWORD` | No | Dashboard login password (default `0000`) |
| `OPENAI_KEY` | No | OpenAI API key for AI chat |
| `REMOVEBG_KEY` | No | remove.bg key for background removal |
| `SESSION_SECRET` | No | Cookie signing secret (Replit Secret) |

### Dashboard

Web dashboard on port 3000 — log in with `ADMIN_PASSWORD` (default `0000`).

---

## pokemon-bot/

A focused, independent WhatsApp Pokémon battle bot — PVP duels and wild encounters. No dashboard, no economy, no bloat.

### How to Run

Use the **Pokemon Bot** workflow, or manually:

```bash
cd pokemon-bot && bash start.sh
```

On first run it prints a QR code. Scan with WhatsApp → Linked Devices → Link a Device.
Session saved in `pokemon-bot/auth_info_pokemon/` — completely independent from eve-bot.

### Commands (prefix: `!`)

| Command | Description |
|---|---|
| `!start` | Show starter selection |
| `!start bulbasaur / charmander / squirtle` | Register & choose starter |
| `!pvp @user` | Challenge a group member |
| `!pvp accept` | Accept an incoming challenge |
| `!pvp cancel` | Cancel pending/active battle |
| `!pve` | Encounter a random wild Pokémon |
| `!fight [move]` | Execute a move in your active battle |

### Structure

```
pokemon-bot/
├── src/
│   ├── bot.js              # Baileys connection & message routing
│   ├── handlers/
│   │   ├── index.js        # Command router (prefix: !)
│   │   ├── start.js        # !start
│   │   ├── pvp.js          # !pvp
│   │   ├── pve.js          # !pve
│   │   └── fight.js        # !fight
│   ├── engine/
│   │   └── battle.js       # In-memory battle session manager
│   ├── data/
│   │   └── pokemon.js      # Static Pokémon stats & move pool
│   └── store/
│       └── players.js      # In-memory player registry
├── auth_info_pokemon/      # WhatsApp session (auto-created, separate from eve-bot)
├── package.json
├── start.sh
└── README.md
```

---

## User Preferences

- Keep the glassmorphism dark design theme (`--bg: #030309`, purple/cyan accent) in eve-bot dashboard
- Do NOT redesign from scratch — build on existing structure
- Maintain the existing Express + SQLite + React architecture in eve-bot
- Keep the `dashboard/src/` component structure (`pages/`, `components/`, `context/`, `hooks/`, `services/`)

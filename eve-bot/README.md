# EVE BOT ⚡

> **Made by S00K**

A feature-packed WhatsApp bot with Pokémon adventures, anime card game, economy system, moderation, media tools, and AI chat — built on [Baileys](https://github.com/WhiskeySockets/Baileys) and **SQLite** (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)).

---

## Requirements

| Tool     | Version |
|----------|---------|
| Node.js  | ≥ 18    |
| npm      | ≥ 8     |
| ffmpeg   | system  |

No MongoDB, no Redis, no external database required. All data is stored in `database.sqlite` (created automatically on first run).

---

## Local Setup

### 1 — Install system dependencies

The `canvas` package is a native C++ addon that needs graphics libraries installed on your OS **before** running `npm install`.

**Ubuntu / Debian**
```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential python3 \
  libcairo2-dev libpango1.0-dev libjpeg-dev \
  libgif-dev librsvg2-dev pkg-config
```

**Fedora / RHEL / CentOS**
```bash
sudo dnf install -y \
  gcc-c++ python3 make \
  cairo-devel pango-devel libjpeg-turbo-devel \
  giflib-devel librsvg2-devel pkgconf
```

**macOS** (Homebrew)
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Windows**
Install the prerequisites with the GTK 2 bundle approach — see the
[node-canvas Windows docs](https://github.com/Automattic/node-canvas/wiki/Installation:-Windows)
for step-by-step instructions. The short version:
1. Install **Node.js ≥ 18** and **npm ≥ 8**.
2. Install **Visual Studio Build Tools** (C++ workload) or run
   `npm install --global windows-build-tools` from an elevated prompt.
3. Install **GTK 2** runtime from the link above and add its `bin` folder to `PATH`.

**ffmpeg** (all platforms)
- Ubuntu/Debian: `sudo apt-get install -y ffmpeg`
- macOS: `brew install ffmpeg`
- Windows: download from <https://ffmpeg.org/download.html> and add to `PATH`

---

### 2 — Clone and install npm packages

```bash
# clone (or unzip) the project, then:
npm install
```

> **Windows tip:** if `canvas` fails to build, try the pre-built binaries approach:
> `npm install canvas --build-from-source` or pin to a version that ships
> a pre-built `.node` file for your Node version.

---

### 3 — Configure environment

```bash
# Linux / macOS
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env
```

Open `.env` and fill in at minimum:

| Variable         | Required | Notes |
|------------------|----------|-------|
| `NAME`           | Yes      | Bot display name |
| `PREFIX`         | Yes      | Command prefix, e.g. `-` |
| `OWNER`          | Yes      | Your WhatsApp number without `+` (e.g. `919999999999`) |
| `PORT`           | No       | Dashboard port (default `3000`) |
| `ADMIN_PASSWORD` | No       | Dashboard admin password (default `0000`) |
| `OPENAI_KEY`     | No       | OpenAI key for AI chat |
| `REMOVEBG_KEY`   | No       | remove.bg key for background removal |

---

### 4 — Start the bot

**Recommended — with auto-restart:**
```bash
npm run serve
```
This runs `serve.js`, a lightweight supervisor that automatically restarts the bot if it crashes (network drop, unhandled exception, etc.). It works on Windows, Linux, and macOS with no extra packages. If the bot crashes more than 10 times in 60 seconds the supervisor gives up and exits so you can investigate.

**One-shot (no auto-restart):**
```bash
npm start
```

On **first run** the bot prints a QR code in the terminal. Scan it with WhatsApp → **Linked Devices → Link a Device**.

After the first scan, the session is saved in the `sessions/` folder. Subsequent starts will reconnect automatically without showing the QR again.

Press **Ctrl+C** to stop the bot cleanly (works with both commands).

---

## Environment Variables

| Variable         | Required | Description                                                           |
|------------------|----------|-----------------------------------------------------------------------|
| `NAME`           | Yes      | Display name for the bot                                              |
| `PREFIX`         | Yes      | Command prefix (e.g. `-`)                                             |
| `OWNER`          | Yes      | Your WhatsApp number without `+` (e.g. `919999999999`). Comma-separated for multiple mods. |
| `PORT`           | No       | Port for the QR-code web page (default `3000`)                        |
| `SESSION_FOLDER` | No       | Path to session folder (default `sessions`)                           |
| `MODS_GROUP`     | No       | WhatsApp group JID for admin alert forwarding                         |
| `OPENAI_KEY`     | No       | OpenAI API key (for AI chat — falls back to free API if not set)      |
| `REMOVEBG_KEY`   | No       | remove.bg API key (for background removal command)                    |
| `ADMIN_PASSWORD` | No       | Password for the web dashboard admin panel                            |

---

## Command Categories

| Category     | Description                                              |
|--------------|----------------------------------------------------------|
| `economy`    | Gold wallet, daily rewards, bonus, rob, gamble, shop     |
| `pokemon`    | Catch, battle, party, evolve, trade, Pokédex             |
| `cards`      | Card spawning, collecting, auctions, deck management     |
| `general`    | Help, profile, leaderboard, info, owner, mods            |
| `moderation` | Mute, kick, ban, anti-link, welcome messages             |
| `fun`        | Games, quizzes, reactions, random content                |
| `media`      | YouTube download, Spotify, lyrics, stickers, TTS         |
| `weeb`       | Anime info, manga, characters, wallpapers                |
| `utils`      | Sticker, translate, Google, image upload                 |
| `dev`        | Bot owner tools (ban, broadcast, eval, restart)          |
| `chat-gpt`   | AI chat (OpenAI or free fallback)                        |

Use `-help` to see the full command list, or `-help <command>` for details on a specific command.

---

## Data Storage

| What               | Where                                              |
|--------------------|---------------------------------------------------|
| All key-value data | `database.sqlite` (SQLite WAL mode)               |
| Economy accounts   | `economy` table in `database.sqlite`              |
| WhatsApp session   | `sessions/` folder (Baileys MultiFileAuthState)   |

The `sessions/` folder is **not** committed to git (`.gitignore`). Keep a backup if you want to avoid re-scanning the QR.

---

## Web Dashboard

After starting the bot, visit `http://localhost:3000` to access the web dashboard:

- **Dashboard** — Bot status, uptime, connected groups/users
- **Commands** — Browse and search all commands
- **Leaderboard** — Economy top-players
- **Live Logs** — Real-time log stream (SSE)
- **Admin** — Ban management, broadcast, command enable/disable (requires `ADMIN_PASSWORD`)

---

## Project Structure

```
eve-bot/
├── index.js                  # Entry point
├── database.sqlite           # Auto-created on first run
├── src/
│   ├── aurora.js             # Bot initialisation & command loader
│   ├── config/index.js       # Env config loader
│   ├── web.js                # Web dashboard (Express)
│   ├── database/
│   │   ├── index.js          # Database factory
│   │   ├── kv.js             # SQLiteKV – general key-value store
│   │   └── economy.js        # Economy model (SQLite-backed)
│   ├── Structures/
│   │   ├── WAclient.js       # Message serialiser
│   │   ├── Functions.js      # Utility / canvas / Pokémon helpers
│   │   └── Contact.js        # Contact store
│   ├── Handlers/
│   │   ├── Message.js        # Command dispatcher
│   │   ├── Events.js         # Group join/leave events
│   │   ├── card.js           # Card cron spawner
│   │   ├── pokemon.js        # Pokémon cron spawner
│   │   └── shizofunc.js      # Interactive button helpers
│   ├── Commands/             # Command modules (by category)
│   ├── Helpers/              # XP stats, card/spawn data
│   └── lib/                  # YouTube / Spotify helpers
├── assets/
│   ├── Images/               # Battle / Pokéball images
│   ├── fonts/                # Custom fonts
│   └── json/                 # types.json (type effectiveness)
├── sessions/                 # Baileys auth state (git-ignored)
└── .env                      # Your config (copy from .env.example)
```

---

## License

See `LICENSE`.

---

_EVE BOT — Made by S00K ⚡_

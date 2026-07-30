# EVE Bot + Pokémon Bot

A monorepo with two independent WhatsApp bots built on [Baileys](https://github.com/WhiskeySockets/Baileys) and SQLite.

## Bots

### EVE Bot (`eve-bot/`)
- Feature-packed WhatsApp bot: Pokémon, anime card game, economy, moderation, media tools, AI chat
- Stack: Node.js, Baileys, SQLite (better-sqlite3), Express dashboard (React/Vite)
- **Workflow:** `Start Bot` — runs `cd eve-bot && bash start.sh`
- Dashboard available on port 3000
- Config: `eve-bot/config.js` (BOT_NAME, PREFIX). Owner auto-assigned from WhatsApp session.
- Session: saved in `eve-bot/sessions/` — reconnects without QR on restart

### Pokémon Bot (`pokemon-bot/`)
- Standalone WhatsApp PVP/PVE Pokémon battle bot
- Stack: Node.js, Baileys, SQLite, Express dashboard (React/Vite)
- **Workflow:** `Pokemon Bot` — runs `cd pokemon-bot && bash start.sh`
- Dashboard available on port 3001
- No `.env` required. Bot prefix is `!` (hardcoded).
- Session: saved in `pokemon-bot/auth_info_pokemon/` — scan QR on first run

## Running

Both workflows are pre-configured. Start them via the Workflows panel.

On first run, Pokémon Bot will print a QR code in the terminal — scan with WhatsApp → Linked Devices → Link a Device.

EVE Bot will reconnect automatically after the first scan (session is already saved).

## Requirements (handled by NixOS/Replit)
- Node.js ≥ 18
- ffmpeg (system)
- Native canvas libraries (libuuid resolved automatically in start.sh)

## User Preferences

# EVE Bot + Pokémon Bot — Monorepo

Two WhatsApp bots built on [Baileys](https://github.com/WhiskeySockets/Baileys) and SQLite (via `better-sqlite3`), running as separate Replit workflows.

---

## Project Layout

```
eve-bot/          Full-featured WhatsApp bot (Pokémon, economy, AI, moderation, dashboard)
pokemon-bot/      Standalone WhatsApp Pokémon battle bot (PVE / PVP)
```

---

## Running the Bots

### eve-bot (Start Bot workflow)
- Workflow: **Start Bot** → `cd eve-bot && bash start.sh`
- Connects automatically — session is already saved in `eve-bot/sessions/`
- Builds the React dashboard on first run (or when source files change)
- Dashboard available on port **3000** (admin password: `0000` by default)
- Config: `eve-bot/config.js` (bot name, prefix, optional API keys)

### pokemon-bot (Pokemon Bot workflow)
- Workflow: **Pokemon Bot** → `cd pokemon-bot && bash start.sh`
- **First run requires a QR scan**: WhatsApp → Linked Devices → Link a Device
- After scanning, session is saved in `pokemon-bot/auth_info_pokemon/` and reconnects automatically on restart
- Prefix: `!`  Commands: `!start`, `!pve`, `!pvp`, `!fight`

---

## System Dependencies

Both bots need `libuuid` for the `canvas` native addon. The `start.sh` scripts resolve this automatically on NixOS/Replit by finding the library in the Nix store.

---

## Environment Variables (eve-bot)

Configured in `eve-bot/config.js`. Optional env vars:

| Variable         | Purpose                        |
|------------------|--------------------------------|
| `OPENAI_KEY`     | AI chat feature                |
| `REMOVEBG_KEY`   | Background removal feature     |

---

## User Preferences

_None recorded yet._

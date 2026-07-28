# Pokémon Bot ⚡

A focused WhatsApp Pokémon battle bot — PVP duels and wild encounters.
Built independently from `eve-bot/` using Baileys + pure in-memory state.

## Commands

| Command | Description |
|---|---|
| `!start` | Show starter selection |
| `!start bulbasaur` | Register and choose Bulbasaur |
| `!start charmander` | Register and choose Charmander |
| `!start squirtle` | Register and choose Squirtle |
| `!pvp @user` | Challenge a group member |
| `!pvp accept` | Accept an incoming challenge |
| `!pvp cancel` | Cancel a pending/active battle |
| `!pve` | Encounter a random wild Pokémon |
| `!fight [move]` | Execute a move in your active battle |

## Setup

```bash
cd pokemon-bot
npm install
npm start        # prints QR on first run
```

Scan the QR with **WhatsApp → Linked Devices → Link a Device**.

Session is saved in `auth_info_pokemon/` — completely separate from `eve-bot/`.

## Structure

```
pokemon-bot/
├── src/
│   ├── bot.js              # Baileys connection & event routing
│   ├── handlers/
│   │   ├── index.js        # Command router (prefix: !)
│   │   ├── start.js        # !start — register & choose starter
│   │   ├── pvp.js          # !pvp  — PVP challenge flow
│   │   ├── pve.js          # !pve  — wild Pokémon encounter
│   │   └── fight.js        # !fight — execute a battle move
│   ├── engine/
│   │   └── battle.js       # In-memory battle session manager
│   ├── data/
│   │   └── pokemon.js      # Static Pokémon stats & move pool
│   └── store/
│       └── players.js      # In-memory player registry
├── auth_info_pokemon/      # WhatsApp session (auto-created)
├── package.json
├── start.sh
└── README.md
```

## Environment

No `.env` required. Bot prefix is `!` (hardcoded in `src/handlers/index.js`).

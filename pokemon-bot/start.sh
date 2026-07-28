#!/usr/bin/env bash
# pokemon-bot launcher

set -e

# Resolve libuuid.so.1 — required for native node modules on NixOS/Replit
for f in /nix/store/*util-linux*/lib/libuuid.so.1; do
    if [ -f "$f" ]; then
        export LD_LIBRARY_PATH="$(dirname "$f")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        break
    fi
done

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "[SETUP] Installing bot dependencies…"
    npm install --silent
fi

# ── Build dashboard if needed ─────────────────────────────────────────────────
DIST="dashboard/dist/index.html"

build_dashboard() {
    echo "[BUILD] Building Pokémon dashboard…"
    cd dashboard
    if [ ! -d "node_modules" ]; then
        echo "[BUILD] Installing dashboard dependencies…"
        npm install --silent 2>&1 | tail -3
    fi
    npm run build
    cd ..
    echo "[BUILD] Dashboard ready."
}

if [ ! -f "$DIST" ]; then
    echo "[BUILD] dashboard/dist not found — building…"
    build_dashboard
else
    NEWEST_SRC=$(find dashboard/src -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" \) \
        -newer "$DIST" 2>/dev/null | head -1)
    if [ -n "$NEWEST_SRC" ]; then
        echo "[BUILD] Source files changed — rebuilding…"
        build_dashboard
    fi
fi

exec node src/bot.js

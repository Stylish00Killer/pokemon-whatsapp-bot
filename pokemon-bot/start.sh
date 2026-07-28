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
    echo "[SETUP] Installing dependencies…"
    npm install --silent
fi

exec node src/bot.js

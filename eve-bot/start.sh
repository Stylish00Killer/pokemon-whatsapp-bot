#!/usr/bin/env bash
# EVE BOT launcher
# 1. Builds the React dashboard when dist is missing or source files are newer
# 2. Resolves libuuid.so.1 for the canvas npm package
# 3. Starts the bot

set -e

# ── Resolve libuuid.so.1 first (needed for npm build too if canvas is used) ───
for f in /nix/store/*util-linux*/lib/libuuid.so.1; do
    if [ -f "$f" ]; then
        export LD_LIBRARY_PATH="$(dirname "$f")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        break
    fi
done

# ── Build dashboard if dist is missing or source is newer ─────────────────────
DIST="dashboard/dist/index.html"

build_dashboard() {
    echo "[BUILD] Building React dashboard..."
    cd dashboard
    # Skip npm install if node_modules already present
    if [ ! -d "node_modules" ]; then
        echo "[BUILD] Installing dashboard dependencies..."
        npm install --silent 2>&1 | tail -3
    fi
    npm run build
    cd ..
    echo "[BUILD] Dashboard ready."
}

if [ ! -f "$DIST" ]; then
    echo "[BUILD] dashboard/dist not found — building..."
    build_dashboard
else
    # Check if any source file is newer than the built dist
    NEWEST_SRC=$(find dashboard/src -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" \) \
        -newer "$DIST" 2>/dev/null | head -1)
    if [ -n "$NEWEST_SRC" ]; then
        echo "[BUILD] Source files changed — rebuilding..."
        build_dashboard
    fi
fi

exec node index.js

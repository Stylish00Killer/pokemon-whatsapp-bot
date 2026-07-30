#!/usr/bin/env bash
# Runs the Pokémon command render test with the correct LD_LIBRARY_PATH for canvas on NixOS/Replit
set -e
for f in /nix/store/*util-linux*/lib/libuuid.so.1; do
    if [ -f "$f" ]; then
        export LD_LIBRARY_PATH="$(dirname "$f")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
        break
    fi
done
cd "$(dirname "$0")"
node test-pokemon-render.js

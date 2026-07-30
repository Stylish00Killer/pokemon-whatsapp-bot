'use strict';
/**
 * Wipes the WhatsApp session for pokemon-bot.
 * Run from the pokemon-bot/ directory:  node scripts/reset-auth.js
 *
 * After running, restart the bot — it will print a fresh QR code to the
 * terminal and the dashboard (port 3001 → Overview page).
 */

const path = require('path');
const fs   = require('fs');

const AUTH_DIR = path.resolve(__dirname, '..', 'auth_info_pokemon');

if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('✓  Auth directory removed:', AUTH_DIR);
} else {
    console.log('ℹ  Auth directory not found — nothing to remove.');
}

fs.mkdirSync(AUTH_DIR, { recursive: true });
console.log('✓  Empty auth directory recreated.');
console.log('\nRestart the Pokémon Bot — a fresh QR code will appear in the');
console.log('terminal and on the dashboard at http://localhost:3001\n');

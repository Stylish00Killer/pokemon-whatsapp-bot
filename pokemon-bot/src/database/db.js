'use strict';

/**
 * Central database initialiser.
 * Ensures all required tables exist before the bot starts accepting messages.
 * Call once at startup (bot.js already does this via createEconomyModel + SQLiteKV,
 * but this module makes every table explicit and verifiable).
 */

const SQLiteKV        = require('./kv');
const createEconomyModel = require('./economy');

function initDb() {
    // Economy table (gem, treasury, pokeball, cooldowns)
    const Economy = createEconomyModel();

    // KV-backed tables — created eagerly so schema is visible on first run
    const kv        = new SQLiteKV('kv');         // general key-value
    const poke      = kv.table('poke');           // Pokémon party / wild state
    const users     = kv.table('users');          // registered trainers
    const pokemon   = kv.table('pokemon');        // per-user Pokédex / storage
    const party     = kv.table('party');          // active party (mirror of poke for clarity)
    const inventory = kv.table('inventory');      // items (pokéballs, potions, etc.)

    return { Economy, kv, poke, users, pokemon, party, inventory };
}

module.exports = initDb;

#!/usr/bin/env node
'use strict';

/**
 * Task 1 — SQLite Integrity & Schema Verification
 * Run from pokemon-bot/: node scripts/verify-db.js
 */

process.chdir(require('path').join(__dirname, '..'));

const initDb   = require('../src/database/db');
const Database = require('better-sqlite3');
const path     = require('path');

(async () => {
    console.log('\n━━━ SQLite Schema Verification ━━━\n');

    // ── 1. Initialise all tables ──────────────────────────────────────────
    let db;
    try {
        db = initDb();
        console.log('✅ initDb() — all tables initialised without errors');
    } catch (err) {
        console.error('❌ initDb() failed:', err.message);
        process.exit(1);
    }

    // ── 2. Inspect raw SQLite for created tables ──────────────────────────
    const raw    = new Database(path.join(process.cwd(), 'pokemon.sqlite'));
    const tables = raw.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all().map(r => r.name);

    console.log('\n📋 Tables present in pokemon.sqlite:');
    tables.forEach(t => console.log(`   • ${t}`));

    const required = ['economy', 'kv', 'poke', 'users', 'pokemon', 'party', 'inventory'];
    const missing  = required.filter(t => !tables.includes(t));
    if (missing.length) {
        console.error('\n❌ Missing tables:', missing.join(', '));
        process.exit(1);
    }
    console.log('\n✅ All required tables present:', required.join(', '));

    // ── 3. Insert & read a dummy player profile ───────────────────────────
    const TEST_USER = 'verify_test_player@s.whatsapp.net';
    console.log('\n━━━ Dummy Player Insert / Read ━━━\n');

    try {
        const { Economy, poke, users, inventory } = db;

        // Economy
        let econ = await Economy.findOrCreate({ userId: TEST_USER });
        econ.pokeball = 10;
        econ.gem      = 50;
        await econ.save();
        econ = await Economy.findOne({ userId: TEST_USER });
        console.log(`✅ Economy row: pokeball=${econ.pokeball}, gem=${econ.gem}`);

        // KV — users table
        users.set(TEST_USER, { name: 'VerifyBot', registered: true });
        const u = users.get(TEST_USER);
        console.log(`✅ users  KV: name=${u.name}, registered=${u.registered}`);

        // KV — poke / party
        const mockParty = [{ name: 'pikachu', level: 5, hp: 45, maxHp: 45 }];
        poke.set(`${TEST_USER}_Party`, mockParty);
        const party = poke.get(`${TEST_USER}_Party`);
        console.log(`✅ poke   KV: party[0].name=${party[0].name}, level=${party[0].level}`);

        // KV — inventory
        inventory.set(`${TEST_USER}_items`, { pokeball: 5, potion: 2 });
        const inv = inventory.get(`${TEST_USER}_items`);
        console.log(`✅ inventory KV: pokeball=${inv.pokeball}, potion=${inv.potion}`);

        // Cleanup
        users.delete(TEST_USER);
        poke.delete(`${TEST_USER}_Party`);
        inventory.delete(`${TEST_USER}_items`);
        raw.prepare(`DELETE FROM economy WHERE userId = ?`).run(TEST_USER);
        console.log('\n✅ Test data cleaned up.');

    } catch (err) {
        console.error('❌ Insert/read test failed:', err.message);
        process.exit(1);
    }

    raw.close();
    console.log('\n🎉 All schema checks passed.\n');
})();

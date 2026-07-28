'use strict';

const { default: Baileys, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom }  = require('@hapi/boom');
const pino      = require('pino');
const path      = require('path');
const fs        = require('fs');

const SQLiteKV        = require('./database/kv');
const handleMessage   = require('./handlers');
const startSpawner    = require('./pokemon-spawner');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info_pokemon');

async function start() {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

    // ── Database ──────────────────────────────────────────────────────────────
    const DB  = new SQLiteKV('kv');
    const poke = DB.table('poke');
    console.log('[DB]  SQLite connected → pokemon.sqlite');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version }          = await fetchLatestBaileysVersion();

    const client = Baileys({
        version,
        auth:  state,
        logger: pino({ level: 'silent' }),
        browser: ['Pokemon Bot', 'Chrome', '1.0.0'],
        printQRInTerminal: true,
        generateHighQualityLinkPreview: false,
    });

    // ── Attach DB + state maps ────────────────────────────────────────────────
    client.DB   = DB;
    client.poke = poke;
    client.prefix = '!';

    // In-memory maps (mirrors eve-bot aurora.js)
    client.pokemonResponse            = new Map();  // groupJid → wild Pokémon data
    client.pokemonBattleResponse      = new Map();  // groupJid → battle session
    client.pokemonBattlePlayerMap     = new Map();  // playerJid → groupJid
    client.pokemonMoveLearningResponse = new Map(); // `${group}${user}` → pending move
    client.pokemonEvolutionResponse   = new Map();  // userJid → pending evolution

    client.ev.on('creds.update', saveCreds);

    // ── Connection ───────────────────────────────────────────────────────────
    client.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) console.log('\n[QR] Scan the QR with WhatsApp → Linked Devices → Link a Device\n');
        if (connection === 'connecting') console.log('[BOT] Connecting to WhatsApp…');
        if (connection === 'open') {
            console.log('[BOT] ✓ Pokémon Bot connected!');
            console.log('[BOT] Prefix: !   Commands: !start-journey !challenge !battle !catch !heal !party !dex !pss');
            startSpawner(client);
        }
        if (connection === 'close') {
            const code = new Boom(lastDisconnect?.error).output?.statusCode;
            if (code === DisconnectReason.loggedOut) {
                console.log('[BOT] Logged out. Delete auth_info_pokemon/ and restart.');
            } else {
                console.log(`[BOT] Disconnected (${code}). Reconnecting in 3 s…`);
                setTimeout(start, 3000);
            }
        }
    });

    // ── Messages ─────────────────────────────────────────────────────────────
    client.ev.on('messages.upsert', async ({ type, messages }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg?.message) return;
        await handleMessage(client, msg);
    });
}

start().catch(err => { console.error('[FATAL]', err); process.exit(1); });

'use strict';

const { default: Baileys, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom }  = require('@hapi/boom');
const pino      = require('pino');
const path      = require('path');
const fs        = require('fs');

const SQLiteKV          = require('./database/kv');
const createEconomyModel = require('./database/economy');
const handleMessage     = require('./handlers');
const startSpawner      = require('./engine/spawner');
const utils             = require('./utils');
const { startServer, setClient, setQR, setConnected } = require('./web');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info_pokemon');

async function start() {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

    // ── Dashboard web server ──────────────────────────────────────────────────
    startServer();

    // ── Database ──────────────────────────────────────────────────────────────
    const DB       = new SQLiteKV('kv');
    const poke     = DB.table('poke');
    const Economy  = createEconomyModel();
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

    // ── Attach DB, economy, utils + state maps ────────────────────────────────
    client.DB     = DB;
    client.poke   = poke;
    client.econ   = Economy;
    client.utils  = utils;
    client.prefix = '!';

    // In-memory maps (mirrors eve-bot aurora.js)
    client.pokemonResponse             = new Map();  // groupJid → wild Pokémon data
    client.pokemonBattleResponse       = new Map();  // groupJid → battle session
    client.pokemonBattlePlayerMap      = new Map();  // playerJid → groupJid
    client.pokemonMoveLearningResponse = new Map();  // `${group}${user}` → pending move
    client.pokemonEvolutionResponse    = new Map();  // userJid → pending evolution

    client.ev.on('creds.update', saveCreds);

    // ── Share client reference with dashboard ─────────────────────────────────
    setClient(client);

    // ── Connection ────────────────────────────────────────────────────────────
    client.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n[QR] Scan the QR with WhatsApp → Linked Devices → Link a Device\n');
            setQR(qr);
        }
        if (connection === 'connecting') console.log('[BOT] Connecting to WhatsApp…');
        if (connection === 'open') {
            setConnected(true);
            console.log('[BOT] ✓ Pokémon Bot connected!');
            console.log('[BOT] Prefix: !');
            console.log('[BOT] Commands: !start !catch !heal !party !pss !dex !pve !challenge !battle !learn !pg !daily');
            startSpawner(client);
        }
        if (connection === 'close') {
            setConnected(false);
            const code = new Boom(lastDisconnect?.error).output?.statusCode;
            if (code === DisconnectReason.loggedOut) {
                console.log('[BOT] Logged out. Delete auth_info_pokemon/ and restart.');
            } else {
                console.log(`[BOT] Disconnected (${code}). Reconnecting in 3s…`);
                setTimeout(start, 3000);
            }
        }
    });

    // ── Messages ──────────────────────────────────────────────────────────────
    client.ev.on('messages.upsert', async ({ type, messages }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg?.message) return;
        try {
            await handleMessage(client, msg);
        } catch (err) {
            // Log but never let a handler error bubble up and crash the connection
            console.error('[MSG ERROR]', err.message);
        }
    });
}

start().catch(err => { console.error('[FATAL]', err); process.exit(1); });

'use strict';

const {
    default: Baileys,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
} = require('@whiskeysockets/baileys');
const { Boom }  = require('@hapi/boom');
const pino      = require('pino');
const path      = require('path');
const fs        = require('fs');

const SQLiteKV            = require('./database/kv');
const createEconomyModel  = require('./database/economy');
const handleMessage       = require('./handlers');
const startSpawner        = require('./engine/spawner');
const utils               = require('./utils');
const { startServer, setClient, setQR, setConnected } = require('./web');

const AUTH_DIR = path.join(__dirname, '..', 'auth_info_pokemon');

// ── Process-level error guards ────────────────────────────────────────────────
// Prevents uncaught async errors (e.g. socket write after close) from killing
// the process entirely.
process.on('uncaughtException',  err    => console.error('[BOT UNCAUGHT EXCEPTION]',  err));
process.on('unhandledRejection', reason => console.error('[BOT UNHANDLED REJECTION]', reason));

// ── One-time state (survives reconnects) ──────────────────────────────────────
let reconnectTimer = null;   // active setTimeout handle — prevents duplicate timers
let activeSock     = null;   // current Baileys socket reference for cleanup
let spawnerStarted = false;  // cron job must register exactly once
let sharedClient   = null;   // DB + in-memory maps — kept alive across reconnects

// ── Helpers ───────────────────────────────────────────────────────────────────
function wipeAuth() {
    try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        console.log('[BOT] Session wiped — fresh QR will be generated.');
    } catch (e) {
        console.error('[BOT] wipeAuth error:', e.message);
    }
}

/**
 * Schedule a single reconnect attempt.
 * Calling this multiple times within the same disconnect event is safe —
 * only the first call has any effect; duplicates are silently dropped.
 */
function scheduleReconnect(ms) {
    if (reconnectTimer !== null) return; // already queued — do not stack
    console.log(`[BOT] Reconnect scheduled in ${ms / 1000}s…`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectBot();
    }, ms);
}

// ── Connection logic ──────────────────────────────────────────────────────────
async function connectBot() {
    // 1. Tear down the previous socket fully before creating a new one.
    //    Skipping this step is what causes the 440 "Connection Replaced" loop:
    //    WhatsApp sees two live sessions and kicks one out, triggering another
    //    reconnect, which repeats the cycle indefinitely.
    if (activeSock) {
        try { activeSock.ev.removeAllListeners(); } catch {}
        try { activeSock.ws?.close?.();           } catch {}
        activeSock = null;
    }

    try {
        if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version }          = await fetchLatestBaileysVersion();

        const sock = Baileys({
            version,
            auth:   state,
            logger: pino({ level: 'silent' }),
            browser: ['Pokemon Bot', 'Chrome', '1.0.0'],
            printQRInTerminal: true,
            generateHighQualityLinkPreview: false,
        });

        activeSock = sock;

        // 2. Build sharedClient once. On reconnects only the socket-bound methods
        //    are refreshed — the DB connection and in-memory Maps are preserved,
        //    so active battles and wild-spawn state survive disconnects.
        if (!sharedClient) {
            const DB      = new SQLiteKV('kv');
            const poke    = DB.table('poke');
            const Economy = createEconomyModel();
            console.log('[DB]  SQLite connected → pokemon.sqlite');

            sharedClient = {
                DB, poke, econ: Economy, utils, prefix: '!',
                pokemonResponse:             new Map(),
                pokemonBattleResponse:       new Map(),
                pokemonBattlePlayerMap:      new Map(),
                pokemonMoveLearningResponse: new Map(),
                pokemonEvolutionResponse:    new Map(),
            };
        }

        // Refresh socket-bound methods so handlers and spawner always use
        // the current socket after a reconnect.
        sharedClient.ev            = sock.ev;
        sharedClient.sendMessage   = (...a) => sock.sendMessage(...a);
        sharedClient.groupMetadata = (...a) => sock.groupMetadata(...a);
        sharedClient.ws            = sock.ws;

        setClient(sharedClient);
        sock.ev.on('creds.update', saveCreds);

        // ── Connection state machine ──────────────────────────────────────────
        sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
            if (qr) {
                console.log('\n[QR] Scan the QR with WhatsApp → Linked Devices → Link a Device\n');
                setQR(qr);
            }

            if (connection === 'connecting') {
                console.log('[BOT] Connecting to WhatsApp…');
            }

            if (connection === 'open') {
                setConnected(true);
                console.log('[BOT] ✓ Pokémon Bot connected!');
                console.log('[BOT] Prefix: !');
                console.log('[BOT] Commands: !start !catch !heal !party !pss !dex !pve !challenge !battle !learn !pg !daily');

                // 3. Start the wild-spawn cron exactly once across all reconnects.
                if (!spawnerStarted) {
                    startSpawner(sharedClient);
                    spawnerStarted = true;
                }
            }

            if (connection === 'close') {
                setConnected(false);

                // Extract status code from Boom error or raw error code
                const statusCode =
                    new Boom(lastDisconnect?.error)?.output?.statusCode
                    ?? lastDisconnect?.error?.code;

                if (statusCode === DisconnectReason.loggedOut) {
                    // 401 — user explicitly logged out; wipe session and show fresh QR
                    console.log('[BOT] Logged out (401). Wiping session → fresh QR…');
                    wipeAuth();
                    scheduleReconnect(2000);

                } else if (statusCode === 500) {
                    // Bad session / stream conflict — credentials are corrupt
                    console.log('[BOT] Bad session (500). Wiping auth → fresh QR…');
                    wipeAuth();
                    scheduleReconnect(2000);

                } else if (statusCode === 440) {
                    // Connection replaced — another socket connected with the same
                    // credentials while this one was still alive. Back off long enough
                    // for the competing session to either disconnect or stabilise.
                    console.log('[BOT] Connection replaced (440). Backing off 10s…');
                    scheduleReconnect(10000);

                } else if (statusCode === 515) {
                    // Restart required by WhatsApp
                    console.log('[BOT] Restart required (515). Reconnecting in 5s…');
                    scheduleReconnect(5000);

                } else if (statusCode === 428 || statusCode === 408) {
                    // Temporary / timeout close
                    console.log(`[BOT] Temporary close (${statusCode}). Reconnecting in 5s…`);
                    scheduleReconnect(5000);

                } else {
                    console.log(`[BOT] Disconnected (${statusCode ?? 'unknown'}). Reconnecting in 3s…`);
                    scheduleReconnect(3000);
                }
            }
        });

        // ── Messages ──────────────────────────────────────────────────────────
        sock.ev.on('messages.upsert', async ({ type, messages }) => {
            if (type !== 'notify') return;
            const msg = messages[0];
            if (!msg?.message) return;
            try {
                await handleMessage(sharedClient, msg);
            } catch (err) {
                console.error('[MSG ERROR]', err.message);
            }
        });

    } catch (err) {
        console.error('[BOT] connectBot error:', err.message);
        scheduleReconnect(5000);
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────
// startServer() is called ONCE here and never again — it must not be inside
// connectBot() because reconnects would try to rebind the same port.
(async () => {
    startServer();
    await connectBot();
})().catch(err => { console.error('[FATAL]', err); process.exit(1); });

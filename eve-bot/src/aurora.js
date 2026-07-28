'use strict';

const {
    default: Baileys,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const { Boom }          = require('@hapi/boom');
const { join }          = require('path');
const { readdirSync }   = require('fs-extra');
const { mkdirSync, existsSync } = require('fs');
const express           = require('express');
const { imageSync }     = require('qr-image');
const P                 = require('pino');
const chalk             = require('chalk');

const config = require('../config');
const initDatabase  = require('./database');
const SQLiteKV      = require('./database/kv');
const contact       = require('./Structures/Contact');
const utils         = require('./Structures/Functions');
const YT            = require('./lib/YT');
const { setupWeb, setClient, setLoadCommands, addMessage, setChatName } = require('./web');
const { restoreSession, scheduleBackup, backupSession } = require('./Helpers/sessionBackup');

// ─── Startup banner ───────────────────────────────────────────────────────────
console.log(chalk.bold.cyan('\n███████╗██╗   ██╗███████╗'));
console.log(chalk.bold.cyan('██╔════╝██║   ██║██╔════╝'));
console.log(chalk.bold.cyan('█████╗  ██║   ██║█████╗  '));
console.log(chalk.bold.cyan('██╔══╝  ╚██╗ ██╔╝██╔══╝  '));
console.log(chalk.bold.cyan('███████╗ ╚████╔╝ ███████╗'));
console.log(chalk.bold.cyan('╚══════╝  ╚═══╝  ╚══════╝'));
console.log(chalk.bold.white('\n  ⚡ EVE BOT  v1.0.0  —  Made by S00K\n'));

// ─── Express app ─────────────────────────────────────────────────────────────
const PORT = 3000;
const app  = express();

setupWeb(app);

app.listen(PORT, () =>
    console.log(chalk.green(`[SERVER] Dashboard running on port ${PORT}`))
);

// ─── State maps (shared across reconnects) ───────────────────────────────────
const cardResponse            = new Map();
const auctionResponse         = new Map();
const pokemonMap              = new Map();
const sellResponse            = new Map();
const pokemonMoveLearningMap  = new Map();
const evoMap                  = new Map();
const battleMap               = new Map();
const battlePlayerMap         = new Map();

// ─── Command collection helper ────────────────────────────────────────────────
class CmdMap extends Map {
    find(fn) {
        for (const v of this.values()) {
            if (fn(v)) return v;
        }
        return undefined;
    }

    filter(fn) {
        const results = [];
        for (const v of this.values()) {
            if (fn(v)) results.push(v);
        }
        results.first = () => results[0];
        results.sort  = (compareFn) => { Array.prototype.sort.call(results, compareFn); return results; };
        return results;
    }

    reduce(fn, initial) {
        let acc = initial;
        for (const v of this.values()) {
            acc = fn(acc, v);
        }
        return acc;
    }
}

// ─── Main start function ─────────────────────────────────────────────────────
const start = async () => {
    const sessionDir = join(process.cwd(), 'sessions');
    if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });

    // ── Restore session from backup (prevents QR re-scan after container reset)
    restoreSession(sessionDir);

    // ── Database ──────────────────────────────────────────────────────────────
    const { kv, Economy } = initDatabase();
    console.log(chalk.green('[DB]     SQLite connected'));

    // ── Baileys auth (file-based, no DB) ─────────────────────────────────────
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const client = Baileys({
        version,
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['EVE Bot', 'silent', '1.0.0'],
        printQRInTerminal: true,
        generateHighQualityLinkPreview: true,
    });

    // Share the client reference with the web server immediately so the QR
    // endpoint can serve the QR image before the connection is fully open.
    setClient(client);

    // ── Config ────────────────────────────────────────────────────────────────
    client.name   = config.BOT_NAME;
    client.prefix = config.PREFIX;
    client.owner  = [];   // auto-populated from client.user on connection
    client.mods   = [];   // expanded by refreshMods()

    /**
     * Rebuild client.mods from two sources (merged + deduplicated):
     *   1. client.owner – auto-detected from the connected WhatsApp account
     *   2. DB 'moderators' key – managed via the dashboard or owner commands
     */
    client.refreshMods = async () => {
        const dbMods = client.DB.get('moderators') || [];
        client.mods = [...new Set([...client.owner, ...dbMods])];
        return client.mods;
    };

    // ── Database tables ───────────────────────────────────────────────────────
    client.DB        = kv;
    client.contactDB = kv.table('contacts');
    client.exp       = kv.table('experience');
    client.cards     = kv.table('cards');
    client.bg        = kv.table('bg');
    client.poke      = kv.table('poke');
    client.econ      = Economy;

    // ── Utility / helpers ─────────────────────────────────────────────────────
    client.contact = contact;
    client.utils   = utils;
    client.YT      = YT;

    // ── Groups helper ─────────────────────────────────────────────────────────
    client.groups = { adminsGroup: '' };
    client.getAllGroups = async () =>
        Object.keys(await client.groupFetchAllParticipating());

    client.getAllUsers = async () => {
        const data = client.contactDB.all().map((x) => x.id);
        return data
            .filter((element) => /^\d+@s$/.test(element))
            .map((element) => `${element}.whatsapp.net`);
    };

    // ── In-memory response maps ───────────────────────────────────────────────
    client.cardMap                     = cardResponse;
    client.aucMap                      = auctionResponse;
    client.sellMap                     = sellResponse;
    client.pokemonResponse             = pokemonMap;
    client.pokemonMoveLearningResponse = pokemonMoveLearningMap;
    client.pokemonEvolutionResponse    = evoMap;
    client.pokemonBattleResponse       = battleMap;
    client.pokemonBattlePlayerMap      = battlePlayerMap;

    // ── Commands collection ───────────────────────────────────────────────────
    client.cmd = new CmdMap();

    // ── Colourful logger ──────────────────────────────────────────────────────
    client.log = (text, color = 'green') =>
        console.log(chalk.keyword(color)(text));

    // ── Command loader ────────────────────────────────────────────────────────
    const loadCommands = () => {
        const commandRoot = join(__dirname, 'Commands');
        let loaded = 0;
        let failed = 0;

        let dirs;
        try { dirs = readdirSync(commandRoot); } catch { return; }

        for (const $dir of dirs) {
            const dirPath = join(commandRoot, $dir);
            let files;
            try {
                files = readdirSync(dirPath).filter((f) => f.endsWith('.js'));
            } catch { continue; }

            for (const file of files) {
                const filePath = join(dirPath, file);
                try {
                    delete require.cache[require.resolve(filePath)];
                    const command = require(filePath);
                    if (command && command.name) {
                        client.cmd.set(command.name, command);
                        loaded++;
                    }
                } catch (err) {
                    console.error(
                        chalk.red(`[CMD] Failed to load ${file}: ${err.message}`)
                    );
                    failed++;
                }
            }
        }

        console.log(chalk.cyan(`[CMD]    ${loaded} commands loaded${failed ? chalk.red(` (${failed} failed)`) : ''}`));
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const MessageHandler = require('./Handlers/Message');
    const CardHandler    = require('./Handlers/card');
    const PokeHandler    = require('./Handlers/pokemon');
    const EventsHandler  = require('./Handlers/Events');

    // ── Connection updates ────────────────────────────────────────────────────
    client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (update.qr) {
            try { client.QR = imageSync(update.qr); } catch { /* ignore */ }
            client.log(
                `[QR]     Scan the QR above or visit http://localhost:${PORT}`,
                'blue'
            );
        }

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error).output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                client.log('[BOT]    Reconnecting…', 'yellow');
                setTimeout(start, 3000);
            } else {
                client.log('[BOT]    Logged out. Restart to re-scan QR.', 'red');
                setTimeout(start, 3000);
            }
        }

        if (connection === 'connecting') {
            client.log('[BOT]    Connecting to WhatsApp…', 'yellow');
        }

        if (connection === 'open') {
            // Auto-detect owner from the logged-in WhatsApp account's JID
            const botJid = client.user?.id || '';
            const botNum = botJid.split('@')[0].split(':')[0];
            if (botNum) client.owner = [botNum];

            // Populate mods dynamically now that the WA connection is live
            await client.refreshMods();

            console.log(chalk.green('[BOT]    ✓ Connected to WhatsApp'));
            console.log(chalk.cyan(`[BOT]    Name   : ${client.name}`));
            console.log(chalk.cyan(`[BOT]    Prefix : ${client.prefix}`));
            console.log(chalk.cyan(`[BOT]    Mods   : ${client.mods.length}`));
            console.log(chalk.bold.green('\n  ✅ Ready\n'));

            setClient(client);
            loadCommands();
            setLoadCommands(loadCommands);

            // Initial session backup now that we're authenticated
            backupSession(sessionDir);
        }
    });

    // ── Event bindings ────────────────────────────────────────────────────────
    client.ev.on('messages.upsert', (upsert) =>
        MessageHandler(upsert, client)
    );

    // ── Dashboard chat store — populate in real-time ──────────────────────────
    client.ev.on('messages.upsert', ({ messages }) => {
        for (const msg of messages) {
            const jid = msg.key?.remoteJid;
            if (!jid || jid === 'status@broadcast') continue;
            const m = msg.message || {};
            if (m.protocolMessage || m.reactionMessage?.key) continue; // skip ephemeral noise
            let type = 'unknown', body = '';
            if      (m.conversation)             { type = 'text';     body = m.conversation; }
            else if (m.extendedTextMessage)       { type = 'text';     body = m.extendedTextMessage.text || ''; }
            else if (m.imageMessage)              { type = 'image';    body = m.imageMessage.caption || '📷 Image'; }
            else if (m.videoMessage)              { type = 'video';    body = m.videoMessage.caption || '🎥 Video'; }
            else if (m.audioMessage)              { type = 'audio';    body = '🎵 Voice note'; }
            else if (m.stickerMessage)            { type = 'sticker';  body = '🎴 Sticker'; }
            else if (m.documentMessage)           { type = 'document'; body = `📄 ${m.documentMessage.fileName || 'Document'}`; }
            else if (m.reactionMessage)           { type = 'reaction'; body = m.reactionMessage.text || '❤️'; }
            else if (m.buttonsResponseMessage)    { type = 'text';     body = m.buttonsResponseMessage.selectedDisplayText || ''; }
            else if (m.listResponseMessage)       { type = 'text';     body = m.listResponseMessage.title || ''; }
            else {
                const keys = Object.keys(m);
                if (keys.length) { type = keys[0].replace('Message', ''); body = `[${type}]`; }
            }
            addMessage(jid, {
                id:          msg.key.id,
                jid,
                fromMe:      msg.key.fromMe,
                participant: msg.key.participant || null,
                pushName:    msg.pushName || null,
                ts:          (msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now()),
                type,
                body,
            });
            // Enrich chat name from contact store
            if (!jid.endsWith('@g.us')) {
                try {
                    const row = client.contactDB.get(jid);
                    if (row) {
                        const info = typeof row === 'string' ? JSON.parse(row) : (row || {});
                        const name = info.pushName || info.name || msg.pushName;
                        if (name) setChatName(jid, name);
                    } else if (msg.pushName) {
                        setChatName(jid, msg.pushName);
                    }
                } catch {}
            }
        }
    });

    client.ev.on('group-participants.update', (event) =>
        EventsHandler(event, client)
    );

    client.ev.on('contacts.update', (update) =>
        contact.saveContacts(update, client)
    );

    // Backup session on credential changes (debounced 15 s)
    client.ev.on('creds.update', () => {
        saveCreds();
        scheduleBackup(sessionDir);
    });

    // Periodic backup every 5 minutes as a safety net
    setInterval(() => backupSession(sessionDir), 5 * 60 * 1000);

    // ── Background game handlers (guard against re-registration on reconnect) ──
    if (!client._handlersRegistered) {
        client._handlersRegistered = true;
        await CardHandler(client);
        await PokeHandler(client);
    }

    return client;
};

// ─── Launch ───────────────────────────────────────────────────────────────────
start().catch((err) => {
    console.error(chalk.red('[FATAL] Startup failed:'), err);
    process.exit(1);
});

'use strict';

/**
 * Pokémon Bot — Web Dashboard Server
 * Serves the React SPA from dashboard/dist/ and exposes API routes.
 * setupWeb(app) → registers all routes
 * setClient(c)  → called once the Baileys connection is open
 */

const path = require('path');
const os   = require('fs') && require('os');
const fs   = require('fs');

const DIST   = path.join(__dirname, '..', 'dashboard', 'dist');
const PORT   = parseInt(process.env.POKE_DASH_PORT || '3001', 10);
const START  = Date.now();

// ── Log capture ───────────────────────────────────────────────────────────────
const MAX_LOGS  = 400;
const logBuffer = [];
const sseClients = new Set();

let sessionCmds   = 0;
let sessionErrors = 0;
const cmdHourly   = new Array(24).fill(0);

function _capture(isError, args) {
    const raw  = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!line) return;
    if (line.includes('~EXEC')) {
        sessionCmds++;
        cmdHourly[new Date().getHours()]++;
    }
    if (isError) sessionErrors++;
    const entry = { ts: Date.now(), line, error: isError };
    if (logBuffer.length >= MAX_LOGS) logBuffer.shift();
    logBuffer.push(entry);
    for (const c of sseClients) {
        try   { c.write(`data: ${JSON.stringify(entry)}\n\n`); }
        catch { sseClients.delete(c); }
    }
}
const _log = console.log;   console.log   = (...a) => { _log(...a);   _capture(false, a); };
const _err = console.error; console.error = (...a) => { _err(...a);   _capture(true,  a); };

// ── CPU tracking ──────────────────────────────────────────────────────────────
let _cpuLast = process.cpuUsage();
let _cpuTime = process.hrtime.bigint();
let cpuPercent = 0;
setInterval(() => {
    try {
        const now  = process.cpuUsage();
        const tnow = process.hrtime.bigint();
        const elMs = Number(tnow - _cpuTime) / 1e6;
        const cpuMs = (now.user - _cpuLast.user + now.system - _cpuLast.system) / 1000;
        cpuPercent  = Math.min(99, Math.round(cpuMs / Math.max(elMs, 1) * 100));
        _cpuLast = now; _cpuTime = tnow;
    } catch {}
}, 2000);

// ── Mutable client reference ──────────────────────────────────────────────────
let _client = null;
const setClient = (c) => { _client = c; };

// ── QR tracking ───────────────────────────────────────────────────────────────
let _qrData   = null;   // raw QR string (set by bot.js)
let _qrImg    = null;   // PNG buffer from qr-image
let _connected = false;

const setQR = (qrStr) => {
    _qrData = qrStr;
    _connected = false;
    try {
        const qrImage = require('qr-image');
        _qrImg = qrImage.imageSync(qrStr, { type: 'png' });
    } catch {}
};
const setConnected = (v) => {
    _connected = v;
    if (v) { _qrData = null; _qrImg = null; }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUptime(ms) {
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
}

// Count KV rows from the poke table matching a pattern
function dbCount(table, pattern) {
    try {
        const c = _client;
        if (!c) return 0;
        const rows = c[table]?.all?.() || [];
        if (!pattern) return rows.length;
        return rows.filter(r => String(r.id).endsWith(pattern)).length;
    } catch { return 0; }
}

function liveStats() {
    const mem = process.memoryUsage();
    const c   = _client;
    const activeBattles = c ? c.pokemonBattleResponse?.size || 0 : 0;
    const activeWilds   = c ? c.pokemonResponse?.size   || 0 : 0;

    // Total registered players
    let totalPlayers = 0;
    let totalPokemon = 0;
    try {
        const rows = c?.poke?.all?.() || [];
        const partyKeys = rows.filter(r => String(r.id).endsWith('_Party'));
        totalPlayers = partyKeys.length;
        totalPokemon = partyKeys.reduce((sum, r) => {
            try { return sum + (Array.isArray(r.value) ? r.value.length : 0); } catch { return sum; }
        }, 0);
    } catch {}

    return {
        connected:     _connected,
        uptimeSec:     Math.floor((Date.now() - START) / 1000),
        uptimeStr:     fmtUptime(Date.now() - START),
        totalPlayers,
        totalPokemon,
        activeBattles,
        activeWilds,
        cmdRun:        sessionCmds,
        errors:        sessionErrors,
        cpuPercent,
        memMB:         Math.round(mem.heapUsed  / 1048576),
        heapTotalMB:   Math.round(mem.heapTotal / 1048576),
        rssMB:         Math.round(mem.rss       / 1048576),
        nodeVersion:   process.version,
        platform:      process.platform,
        pid:           process.pid,
        hourlyData:    [...cmdHourly],
    };
}

// ── Route setup ───────────────────────────────────────────────────────────────
function setupWeb(app) {
    const express = require('express');
    app.use(express.json());

    // ── Static React build ────────────────────────────────────────────────
    if (fs.existsSync(DIST)) {
        app.use(express.static(DIST));
    }

    // ── QR image ──────────────────────────────────────────────────────────
    app.get('/qr', (req, res) => {
        if (_qrImg) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            return res.send(_qrImg);
        }
        res.status(404).json({ error: 'No QR available' });
    });

    // ── API ───────────────────────────────────────────────────────────────
    app.get('/api/stats', (req, res) => {
        res.json(liveStats());
    });

    app.get('/api/qr', (req, res) => {
        res.json({ connected: _connected, hasQR: !!_qrImg });
    });

    app.get('/api/logs', (req, res) => {
        // Return buffered logs or start SSE stream
        if (req.headers.accept?.includes('text/event-stream')) {
            res.setHeader('Content-Type',  'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection',    'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders?.();

            // Send backlog
            for (const e of logBuffer) {
                try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch {}
            }

            sseClients.add(res);
            req.on('close', () => sseClients.delete(res));
        } else {
            res.json({ logs: logBuffer.slice(-200) });
        }
    });

    app.get('/api/players', (req, res) => {
        try {
            const c = _client;
            if (!c) return res.json({ players: [] });
            const rows = c.poke?.all?.() || [];
            const partyMap = {};
            rows.forEach(r => {
                const m = String(r.id).match(/^(.+)_Party$/);
                if (m) partyMap[m[1]] = r.value;
            });
            const players = Object.entries(partyMap).map(([jid, party]) => ({
                jid,
                displayId: jid.split('@')[0],
                partySize: Array.isArray(party) ? party.length : 0,
                lead: Array.isArray(party) && party[0] ? { name: party[0].name, level: party[0].level } : null,
            }));
            res.json({ players });
        } catch (e) {
            res.json({ players: [], error: e.message });
        }
    });

    app.get('/api/battles', (req, res) => {
        try {
            const c = _client;
            if (!c) return res.json({ battles: [] });
            const battles = [];
            for (const [group, b] of (c.pokemonBattleResponse || [])) {
                battles.push({
                    group,
                    p1: b.player1?.user?.split('@')[0] || '?',
                    p2: b.player2?.user?.split('@')[0] || '?',
                    p1poke: b.player1?.activePokemon?.name || '?',
                    p2poke: b.player2?.activePokemon?.name || '?',
                    turn: b.turn,
                });
            }
            res.json({ battles });
        } catch (e) {
            res.json({ battles: [] });
        }
    });

    app.get('/api/groups', (req, res) => {
        try {
            const c = _client;
            if (!c) return res.json({ groups: [] });

            // Groups with wild-spawn enabled (stored as array under 'wild' key)
            let wildJids = [];
            try {
                const rows = c.poke?.all?.() || [];
                const wildRow = rows.find(r => String(r.id) === 'wild');
                if (wildRow) wildJids = Array.isArray(wildRow.value) ? wildRow.value : [];
            } catch {}

            // Active wilds and battles keyed by group JID
            const activeWildSet   = new Set(c.pokemonResponse     ? [...c.pokemonResponse.keys()]     : []);
            const activeBattleSet = new Set(c.pokemonBattleResponse ? [...c.pokemonBattleResponse.keys()] : []);

            // Union of all known groups
            const allJids = new Set([...wildJids, ...activeWildSet, ...activeBattleSet]);

            // Count players per group from DB
            const playerCountByGroup = {};
            try {
                const rows = c.poke?.all?.() || [];
                rows.filter(r => String(r.id).endsWith('_Party')).forEach(r => {
                    const jid = String(r.id).replace(/_Party$/, '');
                    // player JIDs don't carry group info directly; skip grouping by player here
                });
            } catch {}

            const groups = [...allJids].map(jid => {
                const battle = c.pokemonBattleResponse?.get?.(jid);
                return {
                    jid,
                    shortId:      jid.split('@')[0],
                    wildEnabled:  wildJids.includes(jid),
                    activeWild:   activeWildSet.has(jid),
                    activeBattle: activeBattleSet.has(jid),
                    wildPokemon:  c.pokemonResponse?.get?.(jid)?.name || null,
                    battleInfo:   battle ? {
                        p1:    battle.player1?.user?.split('@')[0] || '?',
                        p2:    battle.player2?.user?.split('@')[0] || '?',
                        turn:  battle.turn || 0,
                    } : null,
                };
            });

            res.json({ groups });
        } catch (e) {
            res.json({ groups: [], error: e.message });
        }
    });

    // ── Admin auth middleware ─────────────────────────────────────────────
    function adminAuth(req, res, next) {
        const envKey = process.env.ADMIN_KEY;
        if (!envKey) return next();                         // no key set → open
        if (req.headers['x-admin-key'] === envKey) return next();
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // Normalise a raw phone or JID → full WhatsApp JID
    function toJid(raw) {
        if (!raw) return null;
        raw = String(raw).trim();
        return raw.includes('@') ? raw : `${raw}@s.whatsapp.net`;
    }

    // ── POST /api/admin/spawn ─────────────────────────────────────────────
    app.post('/api/admin/spawn', adminAuth, async (req, res) => {
        try {
            const c = _client;
            if (!c) return res.json({ ok: false, error: 'Bot not connected' });

            const { spawnWild } = require('./data/pokemon');
            const utils         = require('./utils');
            const groupJid      = req.body?.groupJid ? toJid(req.body.groupJid) : null;

            const wildData = await spawnWild();
            const buffer   = await utils.getBuffer(wildData.image);
            const cap      = (s) => s.charAt(0).toUpperCase() + s.slice(1);

            let targets = groupJid ? [groupJid] : (c.DB?.get('wild') || []);
            if (!targets.length) {
                return res.json({ ok: false, error: 'No groups with wild-spawn enabled. Use !pg in a group first, or supply a groupJid.' });
            }

            let sent = 0;
            for (const jid of targets) {
                try {
                    c.pokemonResponse.set(jid, wildData);
                    await c.sendMessage(jid, {
                        image: buffer,
                        caption:
                            `🌟 *A Wild Pokémon Appeared!* 🌟\n` +
                            `🆔 ID: ${wildData.id}\n` +
                            `🔥 Types: ${wildData.types.map(cap).join(', ')}\n` +
                            `🔹 Level: ${wildData.level}\n\n` +
                            `[Use *!catch ${wildData.name}* to catch it!]`,
                    });
                    sent++;
                } catch (e) { console.error('[Admin/spawn] send:', e.message); }
            }

            res.json({ ok: true, pokemon: wildData.name, level: wildData.level, sent });
        } catch (e) { res.json({ ok: false, error: e.message }); }
    });

    // ── POST /api/admin/give-coins ────────────────────────────────────────
    app.post('/api/admin/give-coins', adminAuth, async (req, res) => {
        try {
            const { jid: rawJid, coins } = req.body || {};
            const jid = toJid(rawJid);
            if (!jid || typeof coins !== 'number' || isNaN(coins)) {
                return res.json({ ok: false, error: 'jid and coins (number) required' });
            }
            const EconomyModel = require('./database/economy')();
            const doc = await EconomyModel.findOrCreate({ userId: jid });
            doc.gem = (doc.gem || 0) + Math.round(coins);
            await doc.save();
            res.json({ ok: true, jid, newBalance: doc.gem });
        } catch (e) { res.json({ ok: false, error: e.message }); }
    });

    // ── POST /api/admin/give-item ─────────────────────────────────────────
    app.post('/api/admin/give-item', adminAuth, async (req, res) => {
        try {
            const { jid: rawJid, itemId, quantity } = req.body || {};
            const jid = toJid(rawJid);
            if (!jid || !itemId || typeof quantity !== 'number' || isNaN(quantity)) {
                return res.json({ ok: false, error: 'jid, itemId, and quantity (number) required' });
            }
            const qty = Math.round(quantity);
            if (itemId === 'pokeball') {
                // pokeball lives in the economy table
                const EconomyModel = require('./database/economy')();
                const doc = await EconomyModel.findOrCreate({ userId: jid });
                doc.pokeball = Math.max(0, (doc.pokeball || 0) + qty);
                await doc.save();
                res.json({ ok: true, jid, itemId, newQty: doc.pokeball });
            } else {
                // all other items → inventory KV table, key: jid_itemId
                const SQLiteKV = require('./database/kv');
                const inv  = new SQLiteKV('inventory');
                const key  = `${jid}_${itemId}`;
                const cur  = inv.get(key);
                const next = Math.max(0, (typeof cur === 'number' ? cur : 0) + qty);
                inv.set(key, next);
                res.json({ ok: true, jid, itemId, newQty: next });
            }
        } catch (e) { res.json({ ok: false, error: e.message }); }
    });

    // ── POST /api/admin/heal-party ────────────────────────────────────────
    app.post('/api/admin/heal-party', adminAuth, (req, res) => {
        try {
            const jid = toJid(req.body?.jid);
            if (!jid) return res.json({ ok: false, error: 'jid required' });
            const c = _client;
            if (!c) return res.json({ ok: false, error: 'Bot not connected' });

            const party = c.poke?.get(`${jid}_Party`);
            if (!Array.isArray(party) || !party.length) {
                return res.json({ ok: false, error: 'No party found for this trainer' });
            }

            const healed = party.map(p => ({
                ...p,
                hp:    p.maxHp  ?? p.hp,
                moves: Array.isArray(p.moves)
                    ? p.moves.map(m => ({ ...m, pp: m.maxPp ?? m.pp }))
                    : p.moves,
            }));

            c.poke.set(`${jid}_Party`, healed);
            res.json({ ok: true, jid, count: healed.length, pokemon: healed.map(p => p.name) });
        } catch (e) { res.json({ ok: false, error: e.message }); }
    });

    // ── SPA fallback ──────────────────────────────────────────────────────
    app.get('/{*splat}', (req, res) => {
        const idx = path.join(DIST, 'index.html');
        if (fs.existsSync(idx)) return res.sendFile(idx);
        res.status(503).send('Dashboard not built. Run: cd pokemon-bot/dashboard && npm run build');
    });
}

// ── Start server ──────────────────────────────────────────────────────────────
function startServer() {
    const express = require('express');
    const app = express();
    setupWeb(app);
    app.listen(PORT, () => {
        console.log(`📈 Pokémon Dashboard running on http://localhost:${PORT}`);
    });
    return app;
}

module.exports = { setupWeb, setClient, setQR, setConnected, startServer };

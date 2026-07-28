'use strict';

/**
 * EVE BOT — Web Server
 * Serves the React dashboard from dashboard/dist/ and provides all API routes.
 * setupWeb(app) → registers all routes
 * setClient(c)  → called on every (re)connect
 */

const crypto   = require('crypto');
const path     = require('path');
const os       = require('os');
const fs       = require('fs');
const Database = require('better-sqlite3');

// Central config — same mutable object used by aurora.js and all commands.
// Mutate in place so in-memory updates are visible everywhere without restart.
const cfg = require('../config');

// ── Immutable defaults (not user-editable) ────────────────────────────────────
const ADMIN_PASSWORD = '0000';
const SESSION_SECRET = 'eve-fallback-secret';

// ─── 1. Log capture & live stats tracking ─────────────────────────────────────
const MAX_LOGS   = 500;
const logBuffer  = [];
const sseClients = new Set();

const cmdHourly  = new Array(24).fill(0);
let sessionCmds  = 0;
let sessionErrors = 0;

// Per-command usage tracking  { commandName → count }
const cmdUsageMap = new Map();

function _capture(isError, args) {
    const raw  = args.map(a => typeof a === 'string' ? a : String(a)).join(' ');
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!line) return;
    if (line.includes('~EXEC')) {
        sessionCmds++;
        cmdHourly[new Date().getHours()]++;
        // Extract command name — format: "~EXEC <prefix><cmd> …"
        const m = line.match(/~EXEC\s+\S*?(\w+)/);
        if (m) cmdUsageMap.set(m[1], (cmdUsageMap.get(m[1]) || 0) + 1);
    }
    if (isError || line.includes('[FATAL]') || line.includes('Unhandled')) sessionErrors++;
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

// CPU tracking
let _cpuLast = process.cpuUsage();
let _cpuTime = process.hrtime ? process.hrtime.bigint() : BigInt(Date.now() * 1e6);
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

// Metrics history — one sample every 5 s, keep last 60 (= 5 min rolling window)
const METRICS_MAX   = 60;
const metricsHistory = [];
setInterval(() => {
    try {
        const mem = process.memoryUsage();
        metricsHistory.push({
            ts:    Date.now(),
            cpu:   cpuPercent,
            memMB: Math.round(mem.heapUsed / 1048576),
            rssMB: Math.round(mem.rss / 1048576),
            cmds:  sessionCmds,
        });
        if (metricsHistory.length > METRICS_MAX) metricsHistory.shift();
    } catch {}
}, 5000);

// Disk stats helper
function diskStats() {
    try {
        const s = fs.statfsSync('.');
        const total = s.blocks * s.bsize;
        const free  = s.bfree  * s.bsize;
        return { totalGB: +(total / 1073741824).toFixed(2), freeGB: +(free / 1073741824).toFixed(2), usedGB: +((total - free) / 1073741824).toFixed(2), pct: Math.round((total - free) / total * 100) };
    } catch { return null; }
}

// ─── 2. Mutable client reference ──────────────────────────────────────────────
let _client = null;
const setClient = (c) => { _client = c; };

// ─── 2a-ii. Scheduled broadcasts ──────────────────────────────────────────────
const SCHED_DB = path.join(process.cwd(), 'database.sqlite');

/** Open a short-lived connection, run callback, close. */
function withDb(fn, readonly = false) {
    const db = new Database(SCHED_DB, readonly ? { readonly: true } : undefined);
    try { return fn(db); } finally { db.close(); }
}

/** Ensure the scheduled_broadcasts table exists. */
function initScheduledTable() {
    try {
        withDb(db => db.exec(`
            CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
                id          TEXT PRIMARY KEY,
                message     TEXT NOT NULL,
                scheduleHHMM TEXT NOT NULL,
                recurDaily  INTEGER NOT NULL DEFAULT 0,
                createdAt   INTEGER NOT NULL,
                lastRun     INTEGER DEFAULT NULL
            );
        `));
    } catch (e) { console.error('[SCHED] Init error:', e.message); }
}
initScheduledTable();

// ─── 2a-iii. Analytics persistence ────────────────────────────────────────────
function initAnalyticsTables() {
    try {
        withDb(db => db.exec(`
            CREATE TABLE IF NOT EXISTS analytics_commands (
                date    TEXT NOT NULL,
                command TEXT NOT NULL,
                count   INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (date, command)
            );
            CREATE TABLE IF NOT EXISTS analytics_hourly (
                date  TEXT NOT NULL,
                hour  INTEGER NOT NULL,
                count INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (date, hour)
            );
            CREATE TABLE IF NOT EXISTS analytics_daily (
                date     TEXT PRIMARY KEY,
                commands INTEGER NOT NULL DEFAULT 0,
                errors   INTEGER NOT NULL DEFAULT 0
            );
        `));
    } catch (e) { console.error('[ANALYTICS] Init error:', e.message); }
}
initAnalyticsTables();

// Track what has already been flushed so we only write deltas
const _flushCmds   = new Map();     // cmd → count at last flush
const _flushHourly = new Array(24).fill(0);
let _flushCmdsTotal = 0;
let _flushErrors    = 0;
let _flushDate      = new Date().toISOString().slice(0, 10);

function flushAnalytics() {
    const today = new Date().toISOString().slice(0, 10);
    // Day rolled over — reset flush baseline (yesterday's session counts shouldn't re-appear)
    if (today !== _flushDate) {
        _flushCmds.clear();
        _flushHourly.fill(0);
        _flushCmdsTotal = 0;
        _flushErrors    = 0;
        _flushDate      = today;
    }
    try {
        const db = new Database(SCHED_DB);
        const upsertCmd  = db.prepare(`INSERT INTO analytics_commands (date, command, count) VALUES (?,?,?)
            ON CONFLICT(date, command) DO UPDATE SET count = count + excluded.count`);
        const upsertHour = db.prepare(`INSERT INTO analytics_hourly (date, hour, count) VALUES (?,?,?)
            ON CONFLICT(date, hour) DO UPDATE SET count = count + excluded.count`);
        const upsertDay  = db.prepare(`INSERT INTO analytics_daily (date, commands, errors) VALUES (?,?,?)
            ON CONFLICT(date) DO UPDATE SET commands = commands + excluded.commands, errors = errors + excluded.errors`);

        db.transaction(() => {
            // Per-command deltas
            for (const [cmd, count] of cmdUsageMap) {
                const last  = _flushCmds.get(cmd) || 0;
                const delta = count - last;
                if (delta > 0) {
                    upsertCmd.run(today, cmd, delta);
                    _flushCmds.set(cmd, count);
                }
            }
            // Hourly deltas
            for (let h = 0; h < 24; h++) {
                const delta = cmdHourly[h] - _flushHourly[h];
                if (delta > 0) {
                    upsertHour.run(today, h, delta);
                    _flushHourly[h] = cmdHourly[h];
                }
            }
            // Daily summary delta
            const cmdDelta = sessionCmds  - _flushCmdsTotal;
            const errDelta = sessionErrors - _flushErrors;
            if (cmdDelta > 0 || errDelta > 0) {
                upsertDay.run(today, Math.max(0, cmdDelta), Math.max(0, errDelta));
                _flushCmdsTotal = sessionCmds;
                _flushErrors    = sessionErrors;
            }
        })();
        db.close();
    } catch (e) { console.error('[ANALYTICS] Flush error:', e.message); }
}

// Flush every 5 minutes and on exit
setInterval(flushAnalytics, 5 * 60 * 1000);
process.on('exit',    () => { try { flushAnalytics(); } catch {} });
process.on('SIGTERM', () => { try { flushAnalytics(); } catch {} process.exit(0); });

/** Fire due scheduled broadcasts. */
async function fireDueScheduled() {
    if (!_client) return;
    const now  = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    let rows;
    try { rows = withDb(db => db.prepare('SELECT * FROM scheduled_broadcasts WHERE scheduleHHMM=?').all(hhmm), true); }
    catch { return; }

    for (const row of rows) {
        // Skip if already fired this minute
        if (row.lastRun) {
            const diff = Date.now() - row.lastRun;
            if (diff < 60000) continue;
        }
        try {
            const groups = await _client.groupFetchAllParticipating?.() || {};
            const jids = Object.keys(groups);
            let sent = 0;
            for (const jid of jids) {
                try { await _client.sendMessage(jid, { text: row.message }); sent++; } catch {}
            }
            console.log(`[SCHED] Fired "${row.id}" → ${sent} groups`);
            withDb(db => db.prepare('UPDATE scheduled_broadcasts SET lastRun=?, recurDaily=recurDaily WHERE id=?')
                .run(Date.now(), row.id));
            // Delete non-recurring broadcasts after firing
            if (!row.recurDaily) {
                withDb(db => db.prepare('DELETE FROM scheduled_broadcasts WHERE id=?').run(row.id));
            }
        } catch (e) { console.error('[SCHED] Fire error:', e.message); }
    }
}

// Check every minute
setInterval(fireDueScheduled, 60000);

// ─── 2b. Live command reload hook ─────────────────────────────────────────────
let _loadCommandsFn = null;
const setLoadCommands = (fn) => { _loadCommandsFn = fn; };

// ─── 2c. Chat & message in-memory store ──────────────────────────────────────
const MAX_MSG_PER_CHAT = 100;
const MAX_CHATS        = 300;
const chatStore    = new Map(); // jid → { jid, name, isGroup, lastMsg, ts, unread }
const messageStore = new Map(); // jid → Message[]
const chatSseClients = new Set();

function addMessage(jid, msg) {
    if (!jid) return;
    // Evict oldest chat when at capacity
    if (!chatStore.has(jid) && chatStore.size >= MAX_CHATS) {
        const [oldestJid] = [...chatStore.entries()]
            .sort((a, b) => a[1].ts - b[1].ts)[0] || [];
        if (oldestJid) { chatStore.delete(oldestJid); messageStore.delete(oldestJid); }
    }
    const prev = chatStore.get(jid) || { jid, name: '', isGroup: jid.endsWith('@g.us'), unread: 0, ts: 0 };
    chatStore.set(jid, {
        ...prev,
        lastMsg: msg.body || `[${msg.type}]`,
        ts:      msg.ts || Date.now(),
        unread:  prev.unread + (msg.fromMe ? 0 : 1),
    });
    if (!messageStore.has(jid)) messageStore.set(jid, []);
    const arr = messageStore.get(jid);
    arr.push(msg);
    if (arr.length > MAX_MSG_PER_CHAT) arr.shift();
    // Broadcast to chat SSE clients
    const payload = `data: ${JSON.stringify({ type: 'message', jid, msg })}\n\n`;
    for (const c of chatSseClients) {
        try { c.write(payload); } catch { chatSseClients.delete(c); }
    }
}

function setChatName(jid, name) {
    const chat = chatStore.get(jid);
    if (chat && name) chatStore.set(jid, { ...chat, name });
}

// ─── 3. Auth helpers ──────────────────────────────────────────────────────────
const COOKIE = 'eve_adm';

const signToken = p =>
    crypto.createHmac('sha256', SESSION_SECRET).update(p).digest('hex');

function parseCookies(req) {
    const out = {};
    (req.headers.cookie || '').split(';').forEach(p => {
        const i = p.indexOf('=');
        if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
}

function isAuthed(req) {
    const pass = ADMIN_PASSWORD;
    const tok = parseCookies(req)[COOKIE] || '';
    const exp = signToken(pass);
    if (tok.length !== exp.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(exp)); } catch { return false; }
}

const requireAuth    = (req, res, next) => isAuthed(req) ? next() : res.redirect('/login');
const requireApiAuth = (req, res, next) => isAuthed(req) ? next() : res.status(401).json({ error: 'Unauthorized' });

// ─── 4. Data helpers ──────────────────────────────────────────────────────────
function fmtUptime(s) {
    s = Math.floor(s);
    const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (d) return `${d}d ${h}h ${m}m`;
    if (h) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
}

function liveStats() {
    const c = _client;
    const mem = process.memoryUsage();
    return {
        connected:    !!c,
        botName:      c?.name   || '—',
        prefix:       c?.prefix || '—',
        mods:         c?.mods?.length ?? 0,
        commands:     c?.cmd?.size    ?? 0,
        users:        (() => { try { return c?.contactDB?.all()?.length ?? 0; } catch { return 0; }})(),
        cmdRun:       sessionCmds,
        errors:       sessionErrors,
        uptime:       fmtUptime(process.uptime()),
        uptimeSec:    Math.floor(process.uptime()),
        cpuPercent,
        memMB:        Math.round(mem.heapUsed / 1048576),
        heapMB:       Math.round(mem.heapUsed / 1048576),
        heapTotalMB:  Math.round(mem.heapTotal / 1048576),
        rssMB:        Math.round(mem.rss / 1048576),
        nodeVersion:  process.version,
        platform:     process.platform,
        pid:          process.pid,
        hourlyData:   [...cmdHourly],
        hourlyLabels: Array.from({length:24}, (_,i) => `${i}h`),
    };
}

function commandsByCategory() {
    if (!_client) return {};
    const disabled = (_client.DB.get('disable-commands') || []).map(d =>
        typeof d === 'string' ? d : d.command
    );
    const map = {};
    for (const cmd of _client.cmd.values()) {
        const cat = (cmd.category || 'misc').toLowerCase();
        if (!map[cat]) map[cat] = [];
        map[cat].push({ ...cmd, execute: undefined, isDisabled: disabled.includes(cmd.name) });
    }
    return map;
}

function getBanned() {
    if (!_client) return [];
    return (_client.DB.get('banned') || []).map(b =>
        typeof b === 'string' ? { user: b, reason: '—' } : b
    );
}

function queryLeaderboard(limit = 50) {
    try {
        const db   = new Database(path.join(process.cwd(), 'database.sqlite'), { readonly: true });
        const rows = db.prepare('SELECT userId, gem, treasury FROM economy ORDER BY gem DESC LIMIT ?').all(limit);
        db.close();
        return rows;
    } catch { return []; }
}

function dbTables() {
    try {
        const db   = new Database(path.join(process.cwd(), 'database.sqlite'), { readonly: true });
        const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
        const result = rows.map(r => {
            try { const cnt = db.prepare(`SELECT COUNT(*) as c FROM "${r.name}"`).get(); return { name: r.name, rows: cnt.c }; }
            catch { return { name: r.name, rows: 0 }; }
        });
        db.close();
        return result;
    } catch { return []; }
}

function dbTableData(table, limit = 200) {
    try {
        const db  = new Database(path.join(process.cwd(), 'database.sqlite'), { readonly: true });
        const safe = table.replace(/[^a-zA-Z0-9_]/g, '');
        const rows = db.prepare(`SELECT * FROM "${safe}" LIMIT ?`).all(limit);
        db.close();
        return rows;
    } catch { return []; }
}

function sessionInfo() {
    const sessionDir = path.join(process.cwd(), 'sessions');
    const backupDb   = path.join(process.cwd(), 'session-backup.db');
    let sessionFiles = 0, backupFiles = 0, lastBackup = null;
    try { sessionFiles = fs.readdirSync(sessionDir).filter(f => !f.startsWith('.')).length; } catch {}
    try {
        const db = new Database(backupDb, { readonly: true });
        const r  = db.prepare('SELECT COUNT(*) as c, MAX(saved_at) as t FROM session_files').get();
        backupFiles = r.c; lastBackup = r.t;
        db.close();
    } catch {}
    return { hasBackup: backupFiles > 0, lastBackup, sessionFiles, backupFiles };
}

// ─── 5. Express routes & API ───────────────────────────────────────────────────
const DIST = path.join(process.cwd(), 'dashboard', 'dist');

function setupWeb(app) {
    const express = require('express');
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // ── Serve static dashboard assets ─────────────────────────────────────────
    app.use(express.static(DIST, { maxAge: '1h', index: false }));

    // ── Auth check API ────────────────────────────────────────────────────────
    app.get('/api/auth', (req, res) => res.json({ authed: isAuthed(req) }));

    // ── JSON login/logout (used by React SPA) ─────────────────────────────────
    app.post('/api/login', (req, res) => {
        const pass = ADMIN_PASSWORD;
        const { password } = req.body;
        if (!password || signToken(password) !== signToken(pass))
            return res.status(401).json({ error: 'Incorrect password' });
        res.setHeader('Set-Cookie',
            `${COOKIE}=${signToken(pass)}; Path=/; HttpOnly; Max-Age=28800; SameSite=Strict`);
        res.json({ ok: true });
    });

    app.post('/api/logout', (req, res) => {
        res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
        res.json({ ok: true });
    });

    // ── QR endpoints ──────────────────────────────────────────────────────────
    app.get('/qr', (_req, res) => {
        if (_client?.QR) { res.setHeader('Content-Type','image/png'); return res.send(_client.QR); }
        res.status(404).send('No QR available.');
    });
    app.get('/api/qr', (_req, res) => res.json({
        connected: !!_client && !_client.QR,
        hasQR:     !!_client?.QR,
    }));

    // ── Public API ────────────────────────────────────────────────────────────
    app.get('/api/stats', (_req, res) => res.json(liveStats()));

    app.get('/api/commands', (_req, res) => {
        const cats = commandsByCategory();
        res.json({ categories: cats, prefix: _client?.prefix || '-' });
    });

    app.get('/api/leaderboard', (req, res) => {
        const limit = Math.min(parseInt(req.query?.limit || '50', 10) || 50, 200);
        res.json(queryLeaderboard(limit));
    });

    app.get('/api/session', requireApiAuth, (_req, res) => res.json(sessionInfo()));

    app.get('/api/bans', requireApiAuth, (_req, res) => res.json({ banned: getBanned() }));

    app.get('/api/database', requireApiAuth, (_req, res) => res.json(dbTables()));

    app.get('/api/database/:table', requireApiAuth, (req, res) => {
        const limit = Math.min(parseInt(req.query?.limit || '200', 10) || 200, 1000);
        res.json(dbTableData(req.params.table, limit));
    });

    // ── SSE logs ──────────────────────────────────────────────────────────────
    app.get('/api/logs', (req, res) => {
        res.setHeader('Content-Type',      'text/event-stream');
        res.setHeader('Cache-Control',     'no-cache');
        res.setHeader('Connection',        'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        // Send buffered logs first
        for (const e of logBuffer) res.write(`data: ${JSON.stringify(e)}\n\n`);
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
    });

    // ── Groups ────────────────────────────────────────────────────────────────
    app.get('/api/groups', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            const raw = await Promise.race([
                _client.groupFetchAllParticipating(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 8000)),
            ]);
            // Feature-enabled arrays
            const cardGroups  = (_client.DB.get('cards') || []);
            const wildGroups  = (_client.DB.get('wild')  || []);
            const modGroups   = (_client.DB.get('mod')   || []);
            const evtGroups   = (_client.DB.get('events')|| []);
            const groups = Object.entries(raw).map(([jid, meta]) => ({
                id:           jid,
                name:         meta.subject   || jid,
                description:  meta.desc      || '',
                memberCount:  (meta.participants || []).length,
                adminCount:   (meta.participants || []).filter(p => p.admin).length,
                creation:     meta.creation  || null,
                cardsEnabled: cardGroups.includes(jid),
                wildEnabled:  wildGroups.includes(jid),
                modEnabled:   modGroups.includes(jid),
                eventsEnabled:evtGroups.includes(jid),
            }));
            res.json(groups);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Contacts ──────────────────────────────────────────────────────────────
    app.get('/api/contacts', requireApiAuth, (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            const raw = _client.contactDB.all() || [];
            const contacts = raw.map(row => {
                let info = {};
                try { info = typeof row.value === 'string' ? JSON.parse(row.value) : (row.value || {}); } catch {}
                return { jid: row.id, name: info.pushName || info.name || '', notify: info.notify || '', ...info };
            });
            res.json(contacts);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Contacts — block ──────────────────────────────────────────────────────
    app.post('/api/contacts/:jid/block', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            await _client.updateBlockStatus(decodeURIComponent(req.params.jid), 'block');
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Contacts — unblock ────────────────────────────────────────────────────
    app.post('/api/contacts/:jid/unblock', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            await _client.updateBlockStatus(decodeURIComponent(req.params.jid), 'unblock');
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Developer tools ────────────────────────────────────────────────────────
    app.get('/api/dev/info', requireApiAuth, (req, res) => {
        const mem = process.memoryUsage();
        res.json({
            pid:         process.pid,
            nodeVersion: process.version,
            platform:    process.platform,
            arch:        process.arch,
            uptime:      process.uptime(),
            cpuPercent,
            heapUsed:    mem.heapUsed,
            heapTotal:   mem.heapTotal,
            rss:         mem.rss,
            external:    mem.external,
            cmdCount:    _client?.cmd?.size ?? 0,
            sessionErrors,
            sessionCmds,
        });
    });

    app.post('/api/dev/restart', requireApiAuth, (req, res) => {
        res.json({ ok: true, message: 'Bot restarting in 1s…' });
        setTimeout(() => process.exit(0), 1000);
    });

    app.post('/api/dev/reload', requireApiAuth, (req, res) => {
        if (_loadCommandsFn) {
            try { _loadCommandsFn(); res.json({ ok: true, message: 'Commands reloaded.' }); }
            catch (e) { res.status(500).json({ error: e.message }); }
        } else {
            res.status(503).json({ error: 'Bot not connected yet.' });
        }
    });

    // ── Config — read ─────────────────────────────────────────────────────────
    app.get('/api/config', requireApiAuth, (req, res) => {
        const { getOwners, ...plain } = cfg;
        res.json(plain);
    });

    // ── Database Studio — query execution (read + optional write) ────────────
    app.post('/api/database/query', requireApiAuth, (req, res) => {
        const { sql, allowWrite } = req.body;
        if (!sql?.trim()) return res.status(400).json({ error: 'No query provided' });
        const upper = sql.trim().toUpperCase();
        const isRead = upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('EXPLAIN') || upper.startsWith('WITH');
        if (!isRead && !allowWrite) {
            return res.status(400).json({ error: 'Write operations require Write Mode to be enabled in the SQL Studio.' });
        }
        try {
            const dbPath = path.join(process.cwd(), 'database.sqlite');
            const db     = new Database(dbPath, isRead ? { readonly: true } : undefined);
            const stmt   = db.prepare(sql.trim());
            if (isRead) {
                const rows = stmt.all();
                db.close();
                return res.json({ rows: rows.slice(0, 1000), total: rows.length, truncated: rows.length > 1000, type: 'select' });
            }
            const info = stmt.run();
            db.close();
            res.json({ rows: [], total: 0, type: 'write', changes: info.changes, lastInsertRowid: String(info.lastInsertRowid) });
        } catch (e) { res.status(400).json({ error: e.message }); }
    });

    // ── Database Studio — table schema ────────────────────────────────────────
    app.get('/api/database/:table/schema', requireApiAuth, (req, res) => {
        try {
            const safe = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
            const db   = new Database(path.join(process.cwd(), 'database.sqlite'), { readonly: true });
            const cols = db.prepare(`PRAGMA table_info("${safe}")`).all();
            const idxs = db.prepare(`PRAGMA index_list("${safe}")`).all();
            const fks  = db.prepare(`PRAGMA foreign_key_list("${safe}")`).all();
            db.close();
            res.json({ columns: cols, indexes: idxs, foreignKeys: fks });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Database Studio — SQL dump (full or single table) ────────────────────
    app.get('/api/database/export-sql', requireApiAuth, (req, res) => {
        try {
            const dbPath = path.join(process.cwd(), 'database.sqlite');
            const db     = new Database(dbPath, { readonly: true });
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
            let dump = `-- EVE BOT database dump\n-- Generated: ${new Date().toISOString()}\nPRAGMA foreign_keys=OFF;\n\n`;
            for (const { name } of tables) {
                const ddl = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(name);
                if (ddl?.sql) dump += `${ddl.sql};\n\n`;
                const rows = db.prepare(`SELECT * FROM "${name}"`).all();
                if (rows.length) {
                    const cols = Object.keys(rows[0]);
                    for (const row of rows) {
                        const vals = cols.map(c => row[c] == null ? 'NULL' : typeof row[c] === 'number' ? row[c] : `'${String(row[c]).replace(/'/g,"''")}'`);
                        dump += `INSERT INTO "${name}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES (${vals.join(',')});\n`;
                    }
                    dump += '\n';
                }
            }
            db.close();
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="eve-database-${Date.now()}.sql"`);
            res.send(dump);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Database Studio — export table as JSON ────────────────────────────────
    app.get('/api/database/:table/export-json', requireApiAuth, (req, res) => {
        try {
            const safe = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
            const db   = new Database(path.join(process.cwd(), 'database.sqlite'), { readonly: true });
            const rows = db.prepare(`SELECT * FROM "${safe}"`).all();
            db.close();
            res.setHeader('Content-Disposition', `attachment; filename="${safe}.json"`);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Asset Manager ─────────────────────────────────────────────────────────
    app.get('/api/assets', requireApiAuth, (req, res) => {
        const assetsRoot = path.join(process.cwd(), 'assets');
        const items = [];
        function walk(dir, rel = '') {
            try {
                for (const name of fs.readdirSync(dir)) {
                    if (name.startsWith('.')) continue;
                    const abs  = path.join(dir, name);
                    const relP = rel ? `${rel}/${name}` : name;
                    const stat = fs.statSync(abs);
                    if (stat.isDirectory()) {
                        walk(abs, relP);
                    } else {
                        const ext = path.extname(name).toLowerCase().slice(1);
                        items.push({
                            name, path: relP, size: stat.size,
                            modified: stat.mtimeMs,
                            type: /png|jpg|jpeg|gif|webp|svg/.test(ext) ? 'image'
                                : /mp4|webm|avi|mov/.test(ext) ? 'video'
                                : /json|txt|yaml/.test(ext) ? 'data'
                                : 'other',
                            ext,
                        });
                    }
                }
            } catch {}
        }
        walk(assetsRoot);
        items.sort((a, b) => a.path.localeCompare(b.path));
        res.json({ items, root: assetsRoot });
    });

    // ── Asset Manager — upload (base64 JSON body, no extra deps) ─────────────
    app.post('/api/assets/upload', requireApiAuth, (req, res) => {
        const { name, folder, data } = req.body;
        if (!name || !data) return res.status(400).json({ error: 'name and data are required' });
        if (/\.\./.test(name) || /\.\./.test(folder || ''))
            return res.status(400).json({ error: 'Invalid path' });
        const dir  = path.join(process.cwd(), 'assets', folder || '');
        const dest = path.join(dir, name);
        if (!dest.startsWith(path.join(process.cwd(), 'assets')))
            return res.status(400).json({ error: 'Path traversal denied' });
        try {
            const buf = Buffer.from(data, 'base64');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dest, buf);
            res.json({ ok: true, path: folder ? `${folder}/${name}` : name, size: buf.length });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Asset Manager — delete ─────────────────────────────────────────────
    app.delete('/api/assets', requireApiAuth, (req, res) => {
        const filePath = req.body?.path || req.query?.path;
        if (!filePath || /\.\./.test(filePath))
            return res.status(400).json({ error: 'Invalid path' });
        const abs = path.join(process.cwd(), 'assets', filePath);
        if (!abs.startsWith(path.join(process.cwd(), 'assets')))
            return res.status(400).json({ error: 'Path traversal denied' });
        try {
            if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File not found' });
            fs.unlinkSync(abs);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/assets/serve', requireApiAuth, (req, res) => {
        const filePath = req.query.path;
        if (!filePath || filePath.includes('..')) return res.status(400).send('Invalid path');
        const abs = path.join(process.cwd(), 'assets', filePath);
        if (!fs.existsSync(abs)) return res.status(404).send('Not found');
        res.sendFile(abs);
    });

    // ── Backup Center ─────────────────────────────────────────────────────────
    app.get('/api/backup/info', requireApiAuth, (req, res) => {
        const backupDb = path.join(process.cwd(), 'session-backup.db');
        let info = { exists: false, size: 0, fileCount: 0, lastBackup: null, oldestBackup: null };
        try {
            const stat = fs.statSync(backupDb);
            info.exists = true;
            info.size   = stat.size;
            const db = new Database(backupDb, { readonly: true });
            const r  = db.prepare('SELECT COUNT(*) as c, MAX(saved_at) as t, MIN(saved_at) as o FROM session_files').get();
            db.close();
            info.fileCount   = r.c;
            info.lastBackup  = r.t;
            info.oldestBackup= r.o;
        } catch {}
        res.json(info);
    });

    app.get('/api/backup/list', requireApiAuth, (req, res) => {
        const backupDb = path.join(process.cwd(), 'session-backup.db');
        try {
            const db   = new Database(backupDb, { readonly: true });
            const rows = db.prepare('SELECT filename, saved_at, LENGTH(content) as bytes FROM session_files ORDER BY filename').all();
            db.close();
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/backup/trigger', requireApiAuth, (req, res) => {
        try {
            const { backupSession } = require('./Helpers/sessionBackup');
            const sessionDir = path.join(process.cwd(), require('../config').SESSION_FOLDER);
            backupSession(sessionDir);
            res.json({ ok: true, message: 'Backup triggered successfully' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/backup/download', requireApiAuth, (req, res) => {
        const backupDb = path.join(process.cwd(), 'session-backup.db');
        if (!fs.existsSync(backupDb)) return res.status(404).json({ error: 'No backup file found' });
        res.download(backupDb, 'eve-session-backup.db');
    });

    // ── Backup — download live database.sqlite ────────────────────────────────
    app.get('/api/backup/db-download', requireApiAuth, (req, res) => {
        const dbPath = path.join(process.cwd(), 'database.sqlite');
        if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'database.sqlite not found' });
        res.download(dbPath, `eve-database-${Date.now()}.sqlite`);
    });

    // ── Backup — create a timestamped DB snapshot ─────────────────────────────
    app.post('/api/backup/db-snapshot', requireApiAuth, (req, res) => {
        try {
            const src   = path.join(process.cwd(), 'database.sqlite');
            const dir   = path.join(process.cwd(), 'backups');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const ts    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const dest  = path.join(dir, `database-${ts}.sqlite`);
            fs.copyFileSync(src, dest);
            // Keep last 10 snapshots
            const snaps = fs.readdirSync(dir)
                .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
                .sort();
            if (snaps.length > 10) {
                for (const old of snaps.slice(0, snaps.length - 10)) {
                    try { fs.unlinkSync(path.join(dir, old)); } catch {}
                }
            }
            const stat = fs.statSync(dest);
            res.json({ ok: true, name: path.basename(dest), size: stat.size, ts });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Backup — list DB snapshots ────────────────────────────────────────────
    app.get('/api/backup/db-snapshots', requireApiAuth, (req, res) => {
        const dir = path.join(process.cwd(), 'backups');
        try {
            if (!fs.existsSync(dir)) return res.json([]);
            const snaps = fs.readdirSync(dir)
                .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
                .sort().reverse()
                .map(name => {
                    const stat = fs.statSync(path.join(dir, name));
                    return { name, size: stat.size, mtime: stat.mtimeMs };
                });
            res.json(snaps);
        } catch { res.json([]); }
    });

    // ── Backup — download a specific DB snapshot ──────────────────────────────
    app.get('/api/backup/db-snapshots/:name', requireApiAuth, (req, res) => {
        const name = req.params.name.replace(/[^a-zA-Z0-9_.:-]/g, '');
        const f    = path.join(process.cwd(), 'backups', name);
        if (!fs.existsSync(f)) return res.status(404).json({ error: 'Snapshot not found' });
        res.download(f, name);
    });

    // ── Backup — delete a snapshot ────────────────────────────────────────────
    app.delete('/api/backup/db-snapshots/:name', requireApiAuth, (req, res) => {
        const name = req.params.name.replace(/[^a-zA-Z0-9_.:-]/g, '');
        const f    = path.join(process.cwd(), 'backups', name);
        try {
            if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' });
            fs.unlinkSync(f);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── API actions (auth required) ───────────────────────────────────────────
    app.post('/api/commands/toggle', requireApiAuth, (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const { command, action } = req.body;
        let disabled = _client.DB.get('disable-commands') || [];
        if (action === 'enable') {
            disabled = disabled.filter(d => (typeof d==='string'?d:d.command) !== command);
        } else {
            if (!disabled.some(d => (typeof d==='string'?d:d.command) === command)) {
                disabled.push({ command, disabledBy:'Admin Panel', disabledAt:new Date().toISOString(), reason:'' });
            }
        }
        _client.DB.set('disable-commands', disabled);
        res.json({ ok: true });
    });

    // ── Mods management ───────────────────────────────────────────────────────
    // GET  /api/mods        → { owner: [...], mods: [...] }
    // POST /api/mods        → add a mod by JID/number  { jid }
    // DELETE /api/mods      → remove a mod by JID/number { jid }
    // Each mutating call updates the DB then calls refreshMods() so the
    // in-memory client.mods array is immediately consistent.

    app.get('/api/mods', requireApiAuth, (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const dbMods = _client.DB.get('moderators') || [];
        res.json({ owner: _client.owner || [], mods: dbMods });
    });

    app.post('/api/mods', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const raw = (req.body?.jid || '').trim();
        if (!raw) return res.status(400).json({ error: 'jid is required' });
        // Normalise: strip leading + and ensure @s.whatsapp.net suffix
        const num = raw.replace(/^\+/, '').split('@')[0].split(':')[0];
        const jid = `${num}@s.whatsapp.net`;
        const current = _client.DB.get('moderators') || [];
        if (current.includes(jid)) return res.json({ ok: true, mods: current });
        const updated = [...current, jid];
        _client.DB.set('moderators', updated);
        await _client.refreshMods();
        res.json({ ok: true, mods: updated });
    });

    app.delete('/api/mods', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const raw = (req.body?.jid || '').trim();
        if (!raw) return res.status(400).json({ error: 'jid is required' });
        const num = raw.replace(/^\+/, '').split('@')[0].split(':')[0];
        const jid = `${num}@s.whatsapp.net`;
        const current = _client.DB.get('moderators') || [];
        const updated = current.filter(m => m.split('@')[0].split(':')[0] !== num);
        _client.DB.set('moderators', updated);
        await _client.refreshMods();
        res.json({ ok: true, mods: updated });
    });

    app.post('/api/bans/unban', requireApiAuth, (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const { userId } = req.body;
        const banned = _client.DB.get('banned') || [];
        _client.DB.set('banned', banned.filter(b => (typeof b==='string'?b:b.user) !== userId));
        res.json({ ok: true });
    });

    app.post('/api/broadcast', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Empty message' });
        try {
            const groups = await _client.getAllGroups();
            let sent = 0;
            for (const jid of groups) {
                try { await _client.sendMessage(jid, { text: message.trim() }); sent++; } catch {}
            }
            res.json({ ok: true, sent });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Config — save ─────────────────────────────────────────────────────────
    app.post('/api/config', requireApiAuth, (req, res) => {
        const ALLOWED = ['BOT_NAME', 'PREFIX'];
        const updates = req.body || {};

        // 1. Mutate in-memory object (all requires share the same reference)
        for (const key of ALLOWED) {
            if (key in updates) cfg[key] = String(updates[key] ?? '');
        }

        // 2. Propagate identity changes to live client immediately
        if (_client) {
            _client.name   = cfg.BOT_NAME;
            _client.prefix = cfg.PREFIX;
        }

        // 3. Persist to config.js on disk
        try {
            const content =
                `'use strict';\n\n` +
                `/**\n * EVE BOT — Central Configuration\n` +
                ` * Edit here or through the web dashboard. Restart the bot after saving.\n` +
                ` *\n * Owner is auto-assigned from the logged-in WhatsApp account on every connect.\n */\n\n` +
                `module.exports = ${JSON.stringify({ BOT_NAME: cfg.BOT_NAME, PREFIX: cfg.PREFIX }, null, 4)};\n`;
            fs.writeFileSync(path.join(process.cwd(), 'config.js'), content);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: `Saved in memory but could not write config.js: ${e.message}` });
        }
    });

    app.post('/api/session/backup', requireApiAuth, (req, res) => {
        try {
            const { backupSession } = require('./Helpers/sessionBackup');
            const sessionDir = require('path').join(process.cwd(), require('../config').SESSION_FOLDER);
            backupSession(sessionDir);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/session/restore', requireApiAuth, (req, res) => {
        try {
            const { restoreSession } = require('./Helpers/sessionBackup');
            const sessionDir = require('path').join(process.cwd(), require('../config').SESSION_FOLDER);
            const restored = restoreSession(sessionDir);
            res.json({ ok: true, restored });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Chats — SSE event stream ──────────────────────────────────────────────
    app.get('/api/chats/events', requireApiAuth, (req, res) => {
        res.setHeader('Content-Type',      'text/event-stream');
        res.setHeader('Cache-Control',     'no-cache');
        res.setHeader('Connection',        'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        // Heartbeat every 25s to keep connection alive through proxies
        const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
        chatSseClients.add(res);
        req.on('close', () => { chatSseClients.delete(res); clearInterval(hb); });
    });

    // ── Chats — list ─────────────────────────────────────────────────────────
    app.get('/api/chats', requireApiAuth, (req, res) => {
        const list = [...chatStore.values()]
            .sort((a, b) => b.ts - a.ts)
            .map(chat => {
                // Enrich name from contactDB / group store if blank
                let name = chat.name;
                if (!name && _client) {
                    if (chat.isGroup) {
                        name = chat.jid; // filled lazily when groups API is called
                    } else {
                        try {
                            const row = _client.contactDB.get(chat.jid);
                            if (row) {
                                const info = typeof row === 'string' ? JSON.parse(row) : (row || {});
                                name = info.pushName || info.name || '';
                            }
                        } catch {}
                    }
                }
                return { ...chat, name: name || chat.jid.split('@')[0] };
            });
        res.json(list);
    });

    // ── Chats — messages for a JID ────────────────────────────────────────────
    app.get('/api/chats/:jid/messages', requireApiAuth, (req, res) => {
        const jid  = req.params.jid;
        const msgs = messageStore.get(jid) || [];
        // Mark chat as read
        const chat = chatStore.get(jid);
        if (chat) chatStore.set(jid, { ...chat, unread: 0 });
        res.json({ jid, messages: msgs });
    });

    // ── Send a message to any JID ─────────────────────────────────────────────
    app.post('/api/send', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const { jid, text } = req.body;
        if (!jid || !text?.trim()) return res.status(400).json({ error: 'jid and text are required' });
        try {
            await _client.sendMessage(jid, { text: text.trim() });
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Chats — delete from cache ─────────────────────────────────────────────
    app.delete('/api/chats/:jid', requireApiAuth, (req, res) => {
        const jid = decodeURIComponent(req.params.jid);
        chatStore.delete(jid);
        messageStore.delete(jid);
        res.json({ ok: true });
    });

    // ── Chats — export messages ───────────────────────────────────────────────
    app.get('/api/chats/:jid/export', requireApiAuth, (req, res) => {
        const jid  = decodeURIComponent(req.params.jid);
        const msgs = messageStore.get(jid) || [];
        const name = (chatStore.get(jid)?.name || jid.split('@')[0]).replace(/[^a-z0-9_-]/gi, '_');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="chat-${name}.json"`);
        res.json({ jid, exported: new Date().toISOString(), count: msgs.length, messages: msgs });
    });

    // ── Chats — mark as read ──────────────────────────────────────────────────
    app.post('/api/chats/:jid/read', requireApiAuth, (req, res) => {
        const jid  = decodeURIComponent(req.params.jid);
        const chat = chatStore.get(jid);
        if (chat) chatStore.set(jid, { ...chat, unread: 0 });
        res.json({ ok: true });
    });

    // ── Groups — member list ──────────────────────────────────────────────────
    app.get('/api/groups/:jid/members', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            const meta = await Promise.race([
                _client.groupMetadata(req.params.jid),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 8000)),
            ]);
            const members = (meta.participants || []).map(p => ({
                jid:   p.id,
                admin: p.admin || null,
                phone: p.id.split('@')[0],
            }));
            res.json({ jid: req.params.jid, name: meta.subject, members });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Groups — send message ─────────────────────────────────────────────────
    app.post('/api/groups/:jid/message', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
        try {
            await _client.sendMessage(req.params.jid, { text: text.trim() });
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Groups — leave ────────────────────────────────────────────────────────
    app.post('/api/groups/:jid/leave', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            await _client.groupLeave(req.params.jid);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Groups — invite link ──────────────────────────────────────────────────
    app.get('/api/groups/:jid/invite', requireApiAuth, async (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        try {
            const code = await Promise.race([
                _client.groupInviteCode(req.params.jid),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 8000)),
            ]);
            res.json({ link: `https://chat.whatsapp.com/${code}` });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Groups — toggle feature ───────────────────────────────────────────────
    app.post('/api/groups/:jid/features', requireApiAuth, (req, res) => {
        if (!_client) return res.status(503).json({ error: 'Bot not connected' });
        const { feature, enabled } = req.body;
        const validFeatures = ['cards', 'wild', 'mod', 'events'];
        if (!validFeatures.includes(feature)) return res.status(400).json({ error: 'Invalid feature' });
        try {
            const jid = decodeURIComponent(req.params.jid);
            const list = _client.DB.get(feature) || [];
            const updated = enabled
                ? (list.includes(jid) ? list : [...list, jid])
                : list.filter(g => g !== jid);
            _client.DB.set(feature, updated);
            res.json({ ok: true, feature, enabled, jid });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Metrics history ───────────────────────────────────────────────────────
    app.get('/api/metrics/history', requireApiAuth, (_req, res) => {
        res.json(metricsHistory);
    });

    // ── Top commands ─────────────────────────────────────────────────────────
    app.get('/api/metrics/top-commands', requireApiAuth, (_req, res) => {
        const sorted = [...cmdUsageMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        res.json(sorted);
    });

    // ── Scheduled broadcasts ─────────────────────────────────────────────────
    app.get('/api/scheduled-broadcasts', requireApiAuth, (_req, res) => {
        try { res.json(withDb(db => db.prepare('SELECT * FROM scheduled_broadcasts ORDER BY scheduleHHMM').all(), true)); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/scheduled-broadcasts', requireApiAuth, (req, res) => {
        const { message, scheduleHHMM, recurDaily = false } = req.body;
        if (!message?.trim())    return res.status(400).json({ error: 'message required' });
        if (!/^\d{2}:\d{2}$/.test(scheduleHHMM)) return res.status(400).json({ error: 'scheduleHHMM must be HH:MM' });
        const id = crypto.randomUUID();
        try {
            withDb(db => db.prepare(
                'INSERT INTO scheduled_broadcasts(id,message,scheduleHHMM,recurDaily,createdAt) VALUES(?,?,?,?,?)'
            ).run(id, message.trim(), scheduleHHMM, recurDaily ? 1 : 0, Date.now()));
            res.json({ id, message: message.trim(), scheduleHHMM, recurDaily, createdAt: Date.now() });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/scheduled-broadcasts/:id', requireApiAuth, (req, res) => {
        try {
            const info = withDb(db => db.prepare('DELETE FROM scheduled_broadcasts WHERE id=?').run(req.params.id));
            if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Error log timeline ────────────────────────────────────────────────────
    app.get('/api/logs/errors', requireApiAuth, (_req, res) => {
        const errors = logBuffer.filter((e) => e.error).slice(-100);
        res.json(errors);
    });

    // ── SQLite table statistics ───────────────────────────────────────────────
    app.get('/api/db/stats', requireApiAuth, (_req, res) => {
        try {
            const dbPath = path.join(process.cwd(), 'database.sqlite');
            const db = new Database(dbPath, { readonly: true });
            const tables = db.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).all().map(({ name }) => {
                const count = db.prepare(`SELECT COUNT(*) as n FROM "${name}"`).get().n;
                return { name, rows: count };
            });
            const fileSizeBytes = (() => { try { return fs.statSync(dbPath).size; } catch { return 0; } })();
            db.close();
            res.json({ tables, fileSizeBytes });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Disk stats ────────────────────────────────────────────────────────────
    app.get('/api/metrics/disk', requireApiAuth, (_req, res) => {
        const disk = diskStats();
        const sysMem = {
            totalMB: Math.round(os.totalmem() / 1048576),
            freeMB:  Math.round(os.freemem()  / 1048576),
            usedMB:  Math.round((os.totalmem() - os.freemem()) / 1048576),
            pct:     Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100),
        };
        res.json({ disk, sysMem });
    });

    // ── Dev — hot-reload commands ─────────────────────────────────────────────
    app.post('/api/dev/reload', requireApiAuth, (req, res) => {
        if (!_loadCommandsFn) return res.status(503).json({ error: 'Bot not ready' });
        try {
            _loadCommandsFn();
            res.json({ ok: true, commands: _client?.cmd?.size ?? 0 });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Analytics ─────────────────────────────────────────────────────────────
    app.get('/api/analytics', requireApiAuth, (req, res) => {
        const range = Math.min(Math.max(parseInt(req.query.range) || 7, 1), 30);
        try {
            // Build the date list for the requested range
            const today = new Date().toISOString().slice(0, 10);
            const dates = [];
            for (let i = range - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * 86400000);
                dates.push(d.toISOString().slice(0, 10));
            }
            const rangeStart = dates[0];
            const heatStart  = dates.slice(-7)[0]; // always last 7 days for heatmap

            // Historical data from SQLite
            let dailyTrend  = dates.map(d => ({ date: d, commands: 0, errors: 0 }));
            let heatmapData = {};            // date → number[] (24 slots)
            let histCommands = {};           // cmd → total count

            try {
                const db = new Database(SCHED_DB, { readonly: true });

                // Daily trend
                const dailyRows = db.prepare(
                    'SELECT date, commands, errors FROM analytics_daily WHERE date >= ? ORDER BY date ASC'
                ).all(rangeStart);
                dailyTrend = dates.map(d => {
                    const row = dailyRows.find(r => r.date === d) || { commands: 0, errors: 0 };
                    const isToday = d === today;
                    return {
                        date:     d,
                        commands: row.commands + (isToday ? Math.max(0, sessionCmds  - _flushCmdsTotal) : 0),
                        errors:   row.errors   + (isToday ? Math.max(0, sessionErrors - _flushErrors)    : 0),
                    };
                });

                // Heatmap (last 7 days × 24 hours)
                const heatDates = dates.slice(-7);
                const hourRows  = db.prepare(
                    'SELECT date, hour, count FROM analytics_hourly WHERE date >= ? ORDER BY date, hour'
                ).all(heatStart);
                for (const d of heatDates) {
                    heatmapData[d] = new Array(24).fill(0);
                    for (const r of hourRows) {
                        if (r.date === d) heatmapData[d][r.hour] = r.count;
                    }
                    // Merge live in-memory data for today
                    if (d === today) {
                        for (let h = 0; h < 24; h++) {
                            heatmapData[d][h] += Math.max(0, cmdHourly[h] - _flushHourly[h]);
                        }
                    }
                }

                // Top commands from history
                const cmdRows = db.prepare(
                    'SELECT command, SUM(count) as total FROM analytics_commands WHERE date >= ? GROUP BY command ORDER BY total DESC LIMIT 20'
                ).all(rangeStart);
                for (const r of cmdRows) histCommands[r.command] = r.total;

                db.close();
            } catch (e) { console.error('[ANALYTICS] query error:', e.message); }

            // Merge live session deltas into histCommands
            for (const [cmd, count] of cmdUsageMap) {
                const flushed = _flushCmds.get(cmd) || 0;
                const delta   = count - flushed;
                if (delta > 0) histCommands[cmd] = (histCommands[cmd] || 0) + delta;
            }
            // If history is empty (first run), fall back to live session
            if (Object.keys(histCommands).length === 0) {
                for (const [cmd, count] of cmdUsageMap) histCommands[cmd] = count;
            }

            // Economy stats
            let economyStats = { totalUsers: 0, totalGems: 0, avgGems: 0, topUsers: [] };
            try {
                const db = new Database(SCHED_DB, { readonly: true });
                const eco    = db.prepare('SELECT COUNT(*) as users, SUM(gem) as gems, AVG(gem) as avg FROM economy').get();
                const topEco = db.prepare('SELECT userId, gem FROM economy ORDER BY gem DESC LIMIT 10').all();
                db.close();
                economyStats = {
                    totalUsers: eco.users || 0,
                    totalGems:  eco.gems  || 0,
                    avgGems:    Math.round(eco.avg || 0),
                    topUsers:   topEco,
                };
            } catch {}

            // Live session top groups / contacts
            const topGroups = [...chatStore.values()]
                .filter(c => c.isGroup)
                .map(c => ({ jid: c.jid, name: c.name || c.jid.split('@')[0], messages: (messageStore.get(c.jid) || []).length, unread: c.unread || 0 }))
                .sort((a, b) => b.messages - a.messages).slice(0, 10);

            const topContacts = [...chatStore.values()]
                .filter(c => !c.isGroup)
                .map(c => ({ jid: c.jid, name: c.name || c.jid.split('@')[0], messages: (messageStore.get(c.jid) || []).length, unread: c.unread || 0 }))
                .sort((a, b) => b.messages - a.messages).slice(0, 10);

            res.json({
                session: {
                    cmdRun:   sessionCmds,
                    errors:   sessionErrors,
                    chats:    chatStore.size,
                    messages: [...messageStore.values()].reduce((s, m) => s + m.length, 0),
                },
                topCommands: Object.entries(histCommands)
                    .sort((a, b) => b[1] - a[1]).slice(0, 15)
                    .map(([name, count]) => ({ name, count })),
                topGroups,
                topContacts,
                hourlyActivity: [...cmdHourly],
                economyStats,
                tables:   dbTables(),
                history:  metricsHistory.slice(-60),
                errorCount: logBuffer.filter(l => l.error).length,
                // Historical data
                historical: {
                    range,
                    dates,
                    dailyTrend,
                    heatmapData,   // { 'YYYY-MM-DD': [24 counts] }
                    heatDates:     dates.slice(-7),
                },
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // ── Notification events (SSE) ──────────────────────────────────────────────
    // Reuses the /api/logs SSE stream — notifications page subscribes to that.

    // ── Legacy redirects ──────────────────────────────────────────────────────
    app.get('/admin/login',  (_req, res) => res.redirect('/login'));
    app.post('/admin/login', (req, res) => {
        // Legacy form POST — forward to JSON handler logic then redirect
        const pass = ADMIN_PASSWORD;
        if (!req.body.password || signToken(req.body.password) !== signToken(pass))
            return res.redirect('/login');
        res.setHeader('Set-Cookie',
            `${COOKIE}=${signToken(pass)}; Path=/; HttpOnly; Max-Age=28800; SameSite=Strict`);
        res.redirect('/');
    });
    app.get('/admin/logout', (_req, res) => {
        res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
        res.redirect('/login');
    });

    // ── SPA catch-all — serve index.html for all non-API routes ──────────────
    app.get(/^\/(?!api\/).*/, (_req, res) => {
        const index = require('path').join(DIST, 'index.html');
        if (require('fs').existsSync(index)) {
            res.sendFile(index);
        } else {
            res.status(503).send(
                '<html><body style="font:14px sans-serif;padding:40px;background:#030309;color:#f1f5f9">' +
                '<h2>⚡ EVE BOT</h2><p>Dashboard is building… please wait and refresh.</p>' +
                '<script>setTimeout(()=>location.reload(),3000)</script></body></html>'
            );
        }
    });
}

// ─── 6. Exports ───────────────────────────────────────────────────────────────
module.exports = { setupWeb, setClient, setLoadCommands, addMessage, setChatName };

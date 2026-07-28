'use strict';

/**
 * sessionBackup.js — SQLite-backed session persistence for Replit.
 *
 * Baileys writes auth state to sessions/ (multi-file). On a fresh
 * container that folder is empty and a new QR scan is required. This
 * module backs up every file in sessions/ to a dedicated SQLite table so
 * auth survives container recreation.
 *
 *   restoreSession(sessionDir) — call BEFORE useMultiFileAuthState()
 *   backupSession(sessionDir)  — call in creds.update handler (debounced)
 */

const Database   = require('better-sqlite3');
const { join }   = require('path');
const fs         = require('fs');
const chalk      = require('chalk');

const BACKUP_DB  = join(process.cwd(), 'session-backup.db');

// ─── helpers ─────────────────────────────────────────────────────────────────

function openDb() {
    const db = new Database(BACKUP_DB);
    db.pragma('journal_mode = WAL');
    db.exec(`
        CREATE TABLE IF NOT EXISTS session_files (
            filename TEXT    PRIMARY KEY,
            content  TEXT    NOT NULL,
            saved_at INTEGER NOT NULL
        )
    `);
    return db;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Restore session files from SQLite into sessionDir.
 * @returns {boolean} true if any files were restored.
 */
function restoreSession(sessionDir) {
    try {
        if (!fs.existsSync(BACKUP_DB)) return false;

        const db   = openDb();
        const rows = db.prepare('SELECT filename, content FROM session_files').all();
        db.close();

        if (!rows.length) return false;

        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        for (const { filename, content } of rows) {
            fs.writeFileSync(join(sessionDir, filename), content, 'utf8');
        }

        console.log(chalk.green(`[SESSION] ✓ Restored ${rows.length} file(s) from backup — no QR needed`));
        return true;
    } catch (err) {
        console.error(chalk.yellow(`[SESSION] Could not restore backup: ${err.message}`));
        return false;
    }
}

/**
 * Backup all files in sessionDir to SQLite.
 * Silent on errors — backup is best-effort.
 */
function backupSession(sessionDir) {
    try {
        if (!fs.existsSync(sessionDir)) return;

        const files = fs.readdirSync(sessionDir).filter(f => !f.startsWith('.'));
        if (!files.length) return;

        const db   = openDb();
        const stmt = db.prepare(
            'INSERT OR REPLACE INTO session_files (filename, content, saved_at) VALUES (?, ?, ?)'
        );
        const now = Date.now();

        const tx = db.transaction(() => {
            for (const file of files) {
                try {
                    const content = fs.readFileSync(join(sessionDir, file), 'utf8');
                    stmt.run(file, content, now);
                } catch { /* skip unreadable files */ }
            }
        });
        tx();
        db.close();
    } catch { /* silent */ }
}

// ─── debounced backup ─────────────────────────────────────────────────────────
// Baileys fires creds.update on every message; debounce so we don't
// hammer SQLite on every single event.

let _backupTimer = null;

/**
 * Debounced backup — waits 15 s of inactivity before writing.
 */
function scheduleBackup(sessionDir) {
    clearTimeout(_backupTimer);
    _backupTimer = setTimeout(() => backupSession(sessionDir), 15_000);
}

module.exports = { restoreSession, backupSession, scheduleBackup };

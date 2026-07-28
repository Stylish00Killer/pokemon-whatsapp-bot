'use strict';

/**
 * SQLite-backed key-value store (copied from eve-bot).
 * API: get / set / delete / push / pull / add / sub / all / table / clear
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(process.cwd(), 'pokemon.sqlite');

let _db = null;
function getDb() {
    if (_db) return _db;
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    return _db;
}

class SQLiteKV {
    constructor(tableName = 'kv') {
        this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
        this._db = getDb();
        this._init();
        this._prepareStmts();
    }

    _init() {
        this._db.prepare(
            `CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
        ).run();
    }

    _prepareStmts() {
        const t = this.tableName;
        this._stmtGet   = this._db.prepare(`SELECT value FROM \`${t}\` WHERE key = ?`);
        this._stmtSet   = this._db.prepare(`INSERT OR REPLACE INTO \`${t}\` (key, value) VALUES (?, ?)`);
        this._stmtDel   = this._db.prepare(`DELETE FROM \`${t}\` WHERE key = ?`);
        this._stmtAll   = this._db.prepare(`SELECT key, value FROM \`${t}\``);
        this._stmtClear = this._db.prepare(`DELETE FROM \`${t}\``);
    }

    get(key) {
        const row = this._stmtGet.get(String(key));
        if (!row) return null;
        try { return JSON.parse(row.value); } catch { return row.value; }
    }

    set(key, value) {
        this._stmtSet.run(String(key), JSON.stringify(value));
        return value;
    }

    delete(key) { this._stmtDel.run(String(key)); return true; }

    all() {
        return this._stmtAll.all().map(row => {
            let value;
            try { value = JSON.parse(row.value); } catch { value = row.value; }
            return { id: row.key, value };
        });
    }

    push(key, item) {
        const arr  = this.get(key);
        const next = Array.isArray(arr) ? arr : [];
        next.push(item);
        return this.set(key, next);
    }

    pull(key, item) {
        const arr = this.get(key) || [];
        const next = arr.filter(v => JSON.stringify(v) !== JSON.stringify(item));
        return this.set(key, next);
    }

    add(key, amount) {
        const cur = this.get(key);
        const val = (typeof cur === 'number' ? cur : 0) + amount;
        this.set(key, val);
        return val;
    }

    sub(key, amount) { return this.add(key, -amount); }

    table(name) { return new SQLiteKV(name); }

    clear() { this._stmtClear.run(); }
}

module.exports = SQLiteKV;

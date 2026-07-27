'use strict';

/**
 * SQLite-backed key-value store using better-sqlite3.
 * API mirrors QuickDB: get / set / delete / push / add / sub / all / table / clear.
 *
 * Each "table" is its own SQLite table inside a single database.sqlite file.
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(process.cwd(), 'database.sqlite');

// Singleton connection shared across all SQLiteKV instances
let _db = null;

function getDb() {
    if (_db) return _db;
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    // WAL mode for better concurrent read performance
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    return _db;
}

class SQLiteKV {
    /**
     * @param {string} tableName
     */
    constructor(tableName = 'kv') {
        this.tableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
        this._db = getDb();
        this._init();
        this._prepareStmts();
    }

    _init() {
        this._db.prepare(
            `CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )`
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

    /** @returns {any|null} */
    get(key) {
        const row = this._stmtGet.get(String(key));
        if (!row) return null;
        try { return JSON.parse(row.value); } catch { return row.value; }
    }

    /** @returns {any} the stored value */
    set(key, value) {
        this._stmtSet.run(String(key), JSON.stringify(value));
        return value;
    }

    /** @returns {boolean} */
    delete(key) {
        this._stmtDel.run(String(key));
        return true;
    }

    /**
     * Returns all rows as [{id, value}] – mirrors QuickDB.all()
     * @returns {Array<{id:string, value:any}>}
     */
    all() {
        return this._stmtAll.all().map((row) => {
            let value;
            try { value = JSON.parse(row.value); } catch { value = row.value; }
            return { id: row.key, value };
        });
    }

    /**
     * Appends item to an array stored at key; creates if missing.
     * @returns {any[]}
     */
    push(key, item) {
        const arr  = this.get(key);
        const next = Array.isArray(arr) ? arr : [];
        next.push(item);
        return this.set(key, next);
    }

    /**
     * Adds amount to the number stored at key (defaults to 0).
     * @returns {number}
     */
    add(key, amount) {
        const cur = this.get(key);
        const val = (typeof cur === 'number' ? cur : 0) + amount;
        this.set(key, val);
        return val;
    }

    /** @returns {number} */
    sub(key, amount) {
        return this.add(key, -amount);
    }

    /** Return a new KV scoped to its own SQLite table. */
    table(name) {
        return new SQLiteKV(name);
    }

    /** Wipe all data. */
    clear() {
        this._stmtClear.run();
    }
}

module.exports = SQLiteKV;

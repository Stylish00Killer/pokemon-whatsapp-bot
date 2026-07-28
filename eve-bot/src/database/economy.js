'use strict';

/**
 * SQLite-backed Economy model using better-sqlite3.
 * Mirrors the Mongoose API used throughout the bot:
 *   new EconomyModel(data)             → unsaved doc
 *   await doc.save()                   → upsert
 *   await EconomyModel.findOne({userId})
 *   await EconomyModel.create(data)
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(process.cwd(), 'database.sqlite');

let _db = null;
function getDb() {
    if (_db) return _db;
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    return _db;
}

function createEconomyModel() {
    const db = getDb();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS economy (
            userId      TEXT PRIMARY KEY,
            gem         INTEGER NOT NULL DEFAULT 0,
            treasury    INTEGER NOT NULL DEFAULT 0,
            luckPotion  INTEGER NOT NULL DEFAULT 0,
            pepperSpray INTEGER NOT NULL DEFAULT 0,
            pokeball    INTEGER NOT NULL DEFAULT 0,
            lastBonus   TEXT,
            lastDaily   TEXT,
            lastRob     TEXT
        )
    `).run();

    const stmtUpsert = db.prepare(`
        INSERT INTO economy (userId, gem, treasury, luckPotion, pepperSpray, pokeball, lastBonus, lastDaily, lastRob)
        VALUES (@userId, @gem, @treasury, @luckPotion, @pepperSpray, @pokeball, @lastBonus, @lastDaily, @lastRob)
        ON CONFLICT(userId) DO UPDATE SET
            gem         = excluded.gem,
            treasury    = excluded.treasury,
            luckPotion  = excluded.luckPotion,
            pepperSpray = excluded.pepperSpray,
            pokeball    = excluded.pokeball,
            lastBonus   = excluded.lastBonus,
            lastDaily   = excluded.lastDaily,
            lastRob     = excluded.lastRob
    `);

    const stmtFind = db.prepare('SELECT * FROM economy WHERE userId = ?');

    const defaults = (data) => ({
        userId:      data.userId      ?? null,
        gem:         data.gem         ?? 0,
        treasury:    data.treasury    ?? 0,
        luckPotion:  data.luckPotion  ?? 0,
        pepperSpray: data.pepperSpray ?? 0,
        pokeball:    data.pokeball    ?? 0,
        lastBonus:   data.lastBonus   ?? null,
        lastDaily:   data.lastDaily   ?? null,
        lastRob:     data.lastRob     ?? null,
    });

    class EconomyModel {
        constructor(data) {
            Object.assign(this, defaults(data));
        }

        async save() {
            if (!this.userId) throw new Error('EconomyModel.save: userId is required');
            stmtUpsert.run(defaults(this));
        }

        static async findOne({ userId }) {
            const row = stmtFind.get(userId);
            return row ? new EconomyModel(row) : null;
        }

        static async create(data) {
            const doc = new EconomyModel(data);
            await doc.save();
            return doc;
        }
    }

    return EconomyModel;
}

module.exports = createEconomyModel;

'use strict';

/**
 * SQLite-backed Economy model (ported from eve-bot/src/database/economy.js).
 * Tracks pokéballs, gems, and item cooldowns per user.
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
    return _db;
}

function createEconomyModel() {
    const db = getDb();

    db.prepare(`
        CREATE TABLE IF NOT EXISTS economy (
            userId      TEXT PRIMARY KEY,
            gem         INTEGER NOT NULL DEFAULT 0,
            treasury    INTEGER NOT NULL DEFAULT 0,
            pokeball    INTEGER NOT NULL DEFAULT 5,
            lastBonus   TEXT,
            lastDaily   TEXT
        )
    `).run();

    const stmtUpsert = db.prepare(`
        INSERT INTO economy (userId, gem, treasury, pokeball, lastBonus, lastDaily)
        VALUES (@userId, @gem, @treasury, @pokeball, @lastBonus, @lastDaily)
        ON CONFLICT(userId) DO UPDATE SET
            gem       = excluded.gem,
            treasury  = excluded.treasury,
            pokeball  = excluded.pokeball,
            lastBonus = excluded.lastBonus,
            lastDaily = excluded.lastDaily
    `);

    const stmtFind    = db.prepare('SELECT * FROM economy WHERE userId = ?');
    const stmtGetGem  = db.prepare('SELECT gem FROM economy WHERE userId = ?');
    const stmtSetGem  = db.prepare('UPDATE economy SET gem = ? WHERE userId = ?');

    /**
     * Atomically transfer gems from one player to another.
     * computeGold(loserGems, winnerGems) → integer gold amount.
     * Fully synchronous — better-sqlite3 transaction, no await needed.
     * Returns the actual gold amount transferred.
     */
    const _transferTx = db.transaction((winnerId, loserId, computeGold) => {
        const wRow  = stmtGetGem.get(winnerId);
        const lRow  = stmtGetGem.get(loserId);
        const wGems = wRow ? wRow.gem : 0;
        const lGems = lRow ? lRow.gem : 0;
        const gold  = Math.max(0, computeGold(lGems, wGems));
        if (wRow) stmtSetGem.run(wGems + gold, winnerId);
        if (lRow) stmtSetGem.run(Math.max(0, lGems - gold), loserId);
        return gold;
    });

    const defaults = (data) => ({
        userId:    data.userId    ?? null,
        gem:       data.gem       ?? 0,
        treasury:  data.treasury  ?? 0,
        pokeball:  data.pokeball  ?? 5,
        lastBonus: data.lastBonus ?? null,
        lastDaily: data.lastDaily ?? null,
    });

    class EconomyModel {
        constructor(data) {
            Object.assign(this, defaults(data));
        }

        async save() {
            if (!this.userId) throw new Error('EconomyModel.save: userId required');
            stmtUpsert.run(defaults(this));
        }

        static async findOne({ userId }) {
            const row = stmtFind.get(userId);
            return row ? new EconomyModel(row) : null;
        }

        static async findOrCreate({ userId }) {
            let doc = await EconomyModel.findOne({ userId });
            if (!doc) {
                doc = new EconomyModel({ userId });
                await doc.save();
            }
            return doc;
        }

        static async create(data) {
            const doc = new EconomyModel(data);
            await doc.save();
            return doc;
        }

        /**
         * Atomically transfer gems from loser → winner inside a single
         * better-sqlite3 transaction (no race conditions between concurrent
         * battles ending at the same time).
         *
         * computeGold(loserGems, winnerGems) → number
         *   Called inside the transaction with current DB values so the
         *   calculation is always based on up-to-date balances.
         *
         * Returns the gold amount actually transferred.
         */
        static atomicTransfer(winnerId, loserId, computeGold) {
            return _transferTx(winnerId, loserId, computeGold);
        }
    }

    return EconomyModel;
}

module.exports = createEconomyModel;

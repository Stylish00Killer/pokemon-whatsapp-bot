'use strict';

const SQLiteKV           = require('./kv');
const createEconomyModel = require('./economy');

let _kv      = null;
let _Economy = null;

/**
 * Initialise (or return cached) database instances.
 * @returns {{ kv: SQLiteKV, Economy: ReturnType<createEconomyModel> }}
 */
function initDatabase() {
    if (_kv) return { kv: _kv, Economy: _Economy };

    _kv      = new SQLiteKV('kv');
    _Economy = createEconomyModel();

    return { kv: _kv, Economy: _Economy };
}

module.exports = initDatabase;

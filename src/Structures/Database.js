'use strict';

/**
 * Legacy Database class – replaced by src/database/index.js (SQLite).
 * Kept as a stub so any leftover imports don't crash.
 */
module.exports = class Database {
    constructor() {}
    async getSession() { return null; }
};

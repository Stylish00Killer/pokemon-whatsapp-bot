'use strict';

/**
 * Command router — dispatches messages that start with the bot prefix (!)
 * to the appropriate handler.
 *
 * To add a new command, create a handler in this directory and register it
 * in the COMMANDS map below.
 */

const startCmd = require('./start');
const pvpCmd   = require('./pvp');
const pveCmd   = require('./pve');
const fightCmd = require('./fight');

const PREFIX = '!';

const COMMANDS = {
    start: startCmd,
    pvp:   pvpCmd,
    pve:   pveCmd,
    fight: fightCmd,
};

/**
 * Extract the plain-text body from any supported message type.
 * @param {object} msg  Baileys raw message
 * @returns {string}
 */
function getBody(msg) {
    const m = msg.message;
    if (!m) return '';
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        ''
    );
}

/**
 * Resolve the actual sender JID (participant in groups, remoteJid in DMs).
 * @param {object} msg
 * @returns {string}
 */
function getSender(msg) {
    return msg.key.participant || msg.key.remoteJid;
}

/**
 * Main message handler — called on every messages.upsert notify event.
 * @param {object} client  Baileys socket
 * @param {object} msg     Raw Baileys message
 */
module.exports = async function handleMessage(client, msg) {
    try {
        const body = getBody(msg).trim();
        if (!body.startsWith(PREFIX)) return;

        const from   = msg.key.remoteJid;
        const sender = getSender(msg);
        const isGroup = from.endsWith('@g.us');

        // Ignore messages from the bot itself
        if (msg.key.fromMe) return;

        const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
        const cmdName = rawCmd.toLowerCase();

        const handler = COMMANDS[cmdName];
        if (!handler) return; // unknown command — stay silent

        const ctx = { client, msg, from, sender, args, isGroup, body };
        await handler(ctx);

    } catch (err) {
        console.error('[Handler error]', err.message);
    }
};

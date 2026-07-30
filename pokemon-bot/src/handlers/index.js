'use strict';

/**
 * Command router — dispatches messages that start with the bot prefix (!)
 * to the appropriate handler.
 */

const PREFIX = '!';

const COMMANDS = {
    // Onboarding
    'start':            require('./start'),
    // Catching & spawning
    'catch':            require('./catch'),
    'pg':               require('./pg'),
    // Economy & items
    'daily':            require('./daily'),
    'heal':             require('./heal'),
    // Party & storage
    'party':            require('./party'),
    'pss':              require('./pss'),
    // Pokédex
    'dex':              require('./dex'),
    // Battle — PVE
    'pve':              require('./pve'),
    // Battle — PVP (full system)
    'challenge':        require('./challenge'),
    'battle':           require('../engine/battle'),
    // Move management
    'learn':            require('./learn'),
    'cancel-evolution': require('./cancel_evolution'),
    // Legacy simple PVP (fight sub-command from old engine)
    'pvp':              require('./pvp'),
    'fight':            require('./fight'),
    // Help
    'help':             require('./help'),
};

/**
 * Extract the plain-text body from any supported message type.
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
 * Resolve the actual sender JID.
 */
function getSender(msg) {
    return msg.key.participant || msg.key.remoteJid;
}

/**
 * Main message handler.
 */
module.exports = async function handleMessage(client, msg) {
    try {
        const body = getBody(msg).trim();
        if (!body.startsWith(PREFIX)) return;

        const from   = msg.key.remoteJid;
        const sender = getSender(msg);
        const isGroup = from.endsWith('@g.us');

        if (msg.key.fromMe) return;

        const [rawCmd, ...args] = body.slice(PREFIX.length).trim().split(/\s+/);
        const cmdName = rawCmd.toLowerCase();

        const handler = COMMANDS[cmdName];
        if (!handler) return;

        const ctx = { client, msg, from, sender, args, isGroup, body };
        await handler(ctx);

    } catch (err) {
        console.error('[Handler error]', err.message);
    }
};

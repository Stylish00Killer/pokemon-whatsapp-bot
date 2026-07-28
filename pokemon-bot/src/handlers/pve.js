'use strict';

/**
 * !pve — Spawn a wild Pokémon encounter using real PokéAPI data.
 * Updated to use data/pokemon.js spawnWild() and the new battle engine.
 */

const { spawnWild } = require('../data/pokemon');
const utils = require('../utils');

// In-memory PVE sessions: groupJid::senderJid → { player, wild }
const pveSessions = new Map();

function sessionKey(groupJid, playerJid) {
    return `${groupJid}::${playerJid}`;
}

module.exports = async function pveHandler({ client, msg, from, sender, isGroup }) {
    if (!isGroup)
        return client.sendMessage(from, { text: '❌ PVE battles can only be started in a group chat.' }, { quoted: msg });

    const party = client.poke.get(`${sender}_Party`) || [];
    if (!party.length || !party.some(p => p.hp > 0))
        return client.sendMessage(from, {
            text: '❌ You need healthy Pokémon to battle! Use *!start* to register and *!heal* if they\'re fainted.',
        }, { quoted: msg });

    if (pveSessions.has(sessionKey(from, sender)))
        return client.sendMessage(from, { text: '❌ You already have an active PVE battle! Use *!fight <number>* to continue.' }, { quoted: msg });

    await client.sendMessage(from, { text: '⏳ Summoning a wild Pokémon…' }, { quoted: msg });

    try {
        const wild   = await spawnWild();
        const player = party.find(p => p.hp > 0);

        pveSessions.set(sessionKey(from, sender), { player, wild, groupJid: from, senderJid: sender });

        const buffer = await utils.getBuffer(wild.image).catch(() => null);
        const caption =
            `🌿 *A wild ${utils.capitalize(wild.name)} appeared!*\n\n` +
            `🔥 Types: ${wild.types.map(utils.capitalize).join(', ')}\n` +
            `🔹 Level: ${wild.level}\n` +
            `❤️ HP: ${wild.hp}/${wild.maxHp} | ⚔️ ATK: ${wild.attack} | 🛡️ DEF: ${wild.defense}\n\n` +
            `Your ${utils.capitalize(player.name)} (Lv. ${player.level}) — HP: ${player.hp}/${player.maxHp}\n` +
            `📋 Moves: ${player.moves.map((m, i) => `${i + 1}. ${m.name.split('-').map(utils.capitalize).join(' ')}`).join(' | ')}\n\n` +
            `Use *!fight <number>* to attack! e.g. *!fight 1*`;

        if (buffer) {
            await client.sendMessage(from, { image: buffer, caption }, { quoted: msg });
        } else {
            await client.sendMessage(from, { text: caption }, { quoted: msg });
        }
    } catch (err) {
        pveSessions.delete(sessionKey(from, sender));
        console.error('[pve]', err);
        return client.sendMessage(from, { text: `❌ Failed to summon a wild Pokémon: ${err.message}` }, { quoted: msg });
    }
};

// Export pveSessions so fight.js can use them
module.exports.pveSessions = pveSessions;
module.exports.sessionKey  = sessionKey;

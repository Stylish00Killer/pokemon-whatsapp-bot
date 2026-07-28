'use strict';

/**
 * !pve — Spawn a wild Pokémon encounter.
 *
 * Usage:
 *   !pve   → encounter a random wild Pokémon and start a PVE battle
 *
 * After this command the player uses *!fight [move]* to attack.
 * The wild Pokémon retaliates automatically after each player move.
 */

const { spawnWild } = require('../data/pokemon');
const { players } = require('../store/players');
const { hasSession, createPVE } = require('../engine/battle');

module.exports = async function pveHandler({ client, msg, from, sender, isGroup }) {
    if (!isGroup) {
        return client.sendMessage(from, { text: '❌ PVE battles can only be started in a group chat.' }, { quoted: msg });
    }

    // Ensure player is registered
    const player = players.get(sender);
    if (!player?.pokemon) {
        return client.sendMessage(from, {
            text: '❌ You need to register first! Use *!start* to choose your starter Pokémon.',
        }, { quoted: msg });
    }

    // Prevent starting if already in a battle
    if (hasSession(from, sender)) {
        return client.sendMessage(from, {
            text: '❌ You already have an active battle!\nUse *!fight [move]* to continue, or ask your opponent to *!pvp cancel*.',
        }, { quoted: msg });
    }

    // Spawn a wild Pokémon
    const wild = spawnWild();

    createPVE(from, sender, player.pokemon, wild);

    return client.sendMessage(from, {
        text:
            `🌿 *A wild ${wild.name} appeared!* ${wild.emoji}\n\n` +
            `❤️ HP: ${wild.hp}/${wild.maxHp} | ⚔️ ATK: ${wild.attack} | 🛡️ DEF: ${wild.defense}\n\n` +
            `Your ${player.pokemon.emoji} *${player.pokemon.name}* (HP: ${player.pokemon.hp}/${player.pokemon.maxHp})\n` +
            `📋 Moves: ${player.pokemon.moves.join(', ')}\n\n` +
            `Use *!fight [move]* to attack!\nExample: *!fight ${player.pokemon.moves[0]}*`,
    }, { quoted: msg });
};

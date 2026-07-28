'use strict';

/**
 * !start — Register a player and choose a starter Pokémon.
 *
 * Usage:
 *   !start              → show starter options
 *   !start bulbasaur    → choose Bulbasaur
 *   !start charmander   → choose Charmander
 *   !start squirtle     → choose Squirtle
 */

const { STARTERS, getStarter } = require('../data/pokemon');
const { players } = require('../store/players');

module.exports = async function startHandler({ client, msg, from, sender, args }) {
    const existing = players.get(sender);

    // If already registered, show their current Pokémon
    if (existing && existing.pokemon && !args[0]) {
        const p = existing.pokemon;
        return client.sendMessage(from, {
            text:
                `✅ You're already registered!\n\n` +
                `${p.emoji} *${p.name}* (${p.type})\n` +
                `❤️ HP: ${p.hp}/${p.maxHp} | ⚔️ ATK: ${p.attack} | 🛡️ DEF: ${p.defense}\n` +
                `📋 Moves: ${p.moves.join(', ')}\n\n` +
                `Use *!pve* to fight a wild Pokémon or *!pvp @user* to challenge someone.`,
        }, { quoted: msg });
    }

    const choice = args[0]?.toLowerCase();

    // No choice yet — show menu
    if (!choice) {
        const lines = ['🌟 *Welcome to Pokémon Bot!*\n', 'Choose your starter Pokémon:'];
        for (const [slug, p] of Object.entries(STARTERS)) {
            lines.push(`${p.emoji} *${p.name}* (${p.type}) — \`!start ${slug}\``);
            lines.push(`   ❤️ ${p.maxHp} HP | ⚔️ ${p.attack} ATK | 🛡️ ${p.defense} DEF`);
            lines.push(`   Moves: ${p.moves.join(', ')}`);
        }
        return client.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
    }

    // Validate choice
    const starter = getStarter(choice);
    if (!starter) {
        return client.sendMessage(from, {
            text: `❌ Unknown starter *${choice}*.\nChoose: bulbasaur | charmander | squirtle`,
        }, { quoted: msg });
    }

    // Allow switching starter only if player has no active battle
    if (existing && existing.pokemon && existing.pokemon.name.toLowerCase() !== choice) {
        // Register the switch
    }

    // Register / update player
    players.set(sender, { jid: sender, pokemon: starter });

    return client.sendMessage(from, {
        text:
            `🎉 You chose *${starter.name}*! ${starter.emoji}\n\n` +
            `❤️ HP: ${starter.maxHp} | ⚔️ ATK: ${starter.attack} | 🛡️ DEF: ${starter.defense}\n` +
            `📋 Moves: ${starter.moves.join(', ')}\n\n` +
            `Ready to battle!\n` +
            `• *!pve* — fight a wild Pokémon\n` +
            `• *!pvp @user* — challenge a group member`,
    }, { quoted: msg });
};

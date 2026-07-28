'use strict';

/**
 * !start — Register a player and choose a starter Pokémon.
 * Fetches real data from PokéAPI at level 5.
 *
 * Usage:
 *   !start              → show starter options
 *   !start bulbasaur    → choose Bulbasaur
 *   !start charmander   → choose Charmander
 *   !start squirtle     → choose Squirtle
 */

const { buildStarter, STARTER_SLUGS } = require('../data/pokemon');
const utils = require('../utils');

module.exports = async function startHandler({ client, msg, from, sender, args }) {
    const choice = args[0]?.toLowerCase();
    const party  = client.poke.get(`${sender}_Party`) || [];

    // Already registered with no re-pick requested
    if (party.length > 0 && !choice) {
        const p = party[0];
        return client.sendMessage(from, {
            text:
                `✅ You're already registered!\n\n` +
                `🎴 *${utils.capitalize(p.name)}* (Lv. ${p.level})\n` +
                `❤️ HP: ${p.hp}/${p.maxHp} | ⚔️ ATK: ${p.attack} | 🛡️ DEF: ${p.defense}\n` +
                `📋 Moves: ${p.moves.map(m => m.name.split('-').map(utils.capitalize).join(' ')).join(', ')}\n\n` +
                `Use *!pve* to fight a wild Pokémon or *!challenge @user* to fight someone.`,
        }, { quoted: msg });
    }

    // No choice yet — show menu
    if (!choice) {
        const lines = [
            '🌟 *Welcome to Pokémon Bot!*\n',
            'Choose your starter Pokémon:',
            '🌿 *Bulbasaur* → `!start bulbasaur`',
            '🔥 *Charmander* → `!start charmander`',
            '💧 *Squirtle* → `!start squirtle`',
        ];
        return client.sendMessage(from, { text: lines.join('\n') }, { quoted: msg });
    }

    if (!STARTER_SLUGS.includes(choice)) {
        return client.sendMessage(from, {
            text: `❌ Unknown starter *${choice}*.\nChoose: bulbasaur | charmander | squirtle`,
        }, { quoted: msg });
    }

    const loadingMsg = await client.sendMessage(from, {
        text: `⏳ Fetching *${utils.capitalize(choice)}* from PokéAPI…`,
    }, { quoted: msg });

    try {
        const starter = await buildStarter(choice);

        client.poke.set(`${sender}_Party`, [starter]);
        client.poke.set(`${sender}_PSS`, client.poke.get(`${sender}_PSS`) || []);

        const buffer = await utils.getBuffer(starter.image);
        await client.sendMessage(from, {
            image: buffer,
            caption:
                `🎉 You chose *${utils.capitalize(starter.name)}*!\n\n` +
                `🔥 Types: ${starter.types.map(utils.capitalize).join(', ')}\n` +
                `❤️ HP: ${starter.maxHp} | ⚔️ ATK: ${starter.attack} | 🛡️ DEF: ${starter.defense}\n` +
                `📋 Moves: ${starter.moves.map(m => m.name.split('-').map(utils.capitalize).join(' ')).join(', ')}\n\n` +
                `Ready to battle!\n• *!pve* — fight a wild Pokémon\n• *!challenge @user* — challenge a group member\n• *!heal* — restore HP`,
        }, { quoted: msg });
    } catch (err) {
        console.error('[start]', err);
        return client.sendMessage(from, { text: `❌ Failed to fetch starter data: ${err.message}` }, { quoted: msg });
    }
};

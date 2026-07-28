'use strict';

/**
 * !party [index] [--moves] — View your Pokémon party.
 * Ported from eve-bot/src/Commands/Pokemons/party.js
 *
 * !party           → list all party members
 * !party 2         → detailed stats for slot 2
 * !party 2 --moves → detailed stats + move list for slot 2
 */

const utils = require('../utils');

module.exports = async function partyHandler({ client, msg, from, sender, args }) {
    const party = client.poke.get(`${sender}_Party`) || [];
    if (!party.length)
        return client.sendMessage(from, { text: '📭 Your Pokémon party is empty! Use *!start* to begin.' }, { quoted: msg });

    const indexArg = args[0] ? parseInt(args[0], 10) : NaN;
    const showMoves = args.includes('--moves');

    if (!isNaN(indexArg)) {
        // ── Detail view for one Pokémon ───────────────────────────────────────
        if (indexArg <= 0 || indexArg > party.length)
            return client.sendMessage(from, { text: `❌ Invalid index. Your party has ${party.length} Pokémon.` }, { quoted: msg });

        const p       = party[indexArg - 1];
        const nextLvl = utils.getExpByLevel(p.level + 1);
        const state   = p.hp <= 0 ? 'Fainted' : p.state?.status ? utils.capitalize(p.state.status) : 'Fine';

        let text =
            `🟩 *${utils.capitalize(p.name)}* (#${p.id}) [${p.tag}]\n\n` +
            `🌿 *Gender:* ${p.female ? 'Female ♀' : 'Male ♂'}\n` +
            `🟧 *Types:* ${p.types.map(utils.capitalize).join(', ')}\n` +
            `🟨 *Level:* ${p.level}\n` +
            `🟦 *XP:* ${p.displayExp} / ${nextLvl}\n` +
            `♻ *State:* ${state}\n` +
            `🟢 *HP:* ${p.hp} / ${p.maxHp}\n` +
            `⬜ *Speed:* ${p.speed} / ${p.maxSpeed}\n` +
            `🛡 *Defense:* ${p.defense} / ${p.maxDefense}\n` +
            `🟥 *Attack:* ${p.attack} / ${p.maxAttack}\n` +
            `⬛ *Moves:* ${p.moves.map(m => m.name.split('-').map(utils.capitalize).join(' ')).join(', ')}`;

        if (showMoves) {
            text += '\n\n*── Move Details ──*';
            p.moves.forEach((m, i) => {
                text += `\n\n*#${i + 1}* ${m.name.split('-').map(utils.capitalize).join(' ')}\n〽 PP: ${m.pp}/${m.maxPp} | 🎗 Type: ${utils.capitalize(m.type)} | 🎃 Power: ${m.power} | 🎐 Acc: ${m.accuracy}\n🧧 ${m.description}`;
            });
        }

        text += `\n\n*[Use !party ${indexArg} --moves for full move details]*`;

        try {
            const buffer = await utils.getBuffer(p.image);
            return client.sendMessage(from, { image: buffer, caption: text }, { quoted: msg });
        } catch {
            return client.sendMessage(from, { text }, { quoted: msg });
        }
    }

    // ── Overview list ─────────────────────────────────────────────────────────
    let text = `⚗ *Your Party*\n\n`;
    party.forEach((p, i) => {
        const state = p.hp <= 0 ? '💀 Fainted' : `❤️ ${p.hp}/${p.maxHp}`;
        text += `*#${i + 1}* ${utils.capitalize(p.name)} — Lv. ${p.level} — ${state}\n`;
    });
    text += `\n*[Use !party <number> for details, e.g. !party 1]*`;

    return client.sendMessage(from, { text }, { quoted: msg });
};

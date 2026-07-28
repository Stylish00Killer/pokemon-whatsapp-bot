'use strict';

/**
 * !dex [name|id] [--sort] — Pokédex entries and collection viewer.
 * Ported from eve-bot/src/Commands/Pokemons/dex.js
 *
 * !dex              → show your total caught collection
 * !dex pikachu      → look up Pokémon info from PokéAPI
 * !dex --sort       → sort your collection by level tiers
 */

const axios = require('axios');
const utils = require('../utils');
const path  = require('path');
const fs    = require('fs');

module.exports = async function dexHandler({ client, msg, from, sender, args }) {
    const term = args[0]?.toLowerCase();

    // ── Pokédex lookup ────────────────────────────────────────────────────────
    if (term && !term.startsWith('--')) {
        try {
            const { data: res } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${term}`);

            const party  = client.poke.get(`${sender}_Party`) || [];
            const pc     = client.poke.get(`${sender}_PSS`)   || [];
            const all    = [...party, ...pc];
            const owned  = all.filter(p => p.name === res.name).length;
            const inParty = party.map((p, i) => p.name === res.name ? i + 1 : null).filter(Boolean);
            const inPC    = pc.map((p, i) => p.name === res.name ? i + 1 : null).filter(Boolean);

            const text =
                `🎈 *Name:* ${utils.capitalize(res.name)}\n\n` +
                `🧧 *Pokédex ID:* ${res.id}\n\n` +
                `🎗 *${res.types.length > 1 ? 'Types' : 'Type'}:* ${res.types.map(t => utils.capitalize(t.type.name)).join(', ')}\n\n` +
                `🎏 *${res.abilities.length > 1 ? 'Abilities' : 'Ability'}:* ${res.abilities.map(a => utils.capitalize(a.ability.name)).join(', ')}\n\n` +
                `🎐 *Owned:* ${owned}\n\n` +
                `⚗ *In Party:* ${inParty.length ? inParty.join(', ') : 'None'}\n\n` +
                `💻 *In PC:* ${inPC.length ? inPC.join(', ') : 'None'}`;

            const imageBuffer = await utils.getBuffer(res.sprites.other['official-artwork'].front_default);
            return client.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
        } catch (err) {
            return client.sendMessage(from, { text: `❌ Pokémon *${term}* not found.` }, { quoted: msg });
        }
    }

    // ── Collection overview ───────────────────────────────────────────────────
    const pc     = client.poke.get(`${sender}_PSS`)   || [];
    const party  = client.poke.get(`${sender}_Party`) || [];
    const all    = [...pc, ...party];

    if (!all.length)
        return client.sendMessage(from, { text: '📭 Your Pokémon collection is empty! Catch some first.' }, { quoted: msg });

    const sort = args.includes('--sort');
    let response = `*Pokédex*\n🔑 Total Pokémon: ${all.length}\n\n`;

    if (sort) {
        const tiers = { '1-10': [], '11-20': [], '21-30': [], '31-40': [], '41-50': [], '51-100': [] };
        all.forEach(p => {
            if (p.level <= 10) tiers['1-10'].push(p);
            else if (p.level <= 20) tiers['11-20'].push(p);
            else if (p.level <= 30) tiers['21-30'].push(p);
            else if (p.level <= 40) tiers['31-40'].push(p);
            else if (p.level <= 50) tiers['41-50'].push(p);
            else tiers['51-100'].push(p);
        });
        for (const [range, list] of Object.entries(tiers)) {
            if (list.length) {
                response += `🔢 *Level ${range}*\n`;
                list.forEach((p, i) => { response += `${i + 1}) ${utils.capitalize(p.name)} (Lv. ${p.level})\n`; });
                response += '\n';
            }
        }
    } else {
        all.forEach((p, i) => { response += `${i + 1}) ${utils.capitalize(p.name)} (Lv. ${p.level})\n`; });
    }

    response += `\n*[Use !dex <name> to look up any Pokémon | !dex --sort to sort by level]*`;

    // Show with video if available
    const vidPath = path.join(__dirname, '..', '..', 'assets', 'Videos', 'pokemon.mp4');
    if (fs.existsSync(vidPath)) {
        const vid = fs.readFileSync(vidPath);
        return client.sendMessage(from, { video: vid, gifPlayback: true, caption: response }, { quoted: msg });
    }
    return client.sendMessage(from, { text: response }, { quoted: msg });
};

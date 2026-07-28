'use strict';

/**
 * !catch <name> — Catch the currently spawned wild Pokémon.
 * Ported from eve-bot/src/Commands/Pokemons/catch.js
 *
 * Catch rate: base 30%, +10% per pokéball in inventory (up to 80%).
 * Pokéballs are consumed from the economy table.
 */

const utils = require('../utils');

module.exports = async function catchHandler({ client, msg, from, sender, args, isGroup }) {
    if (!isGroup)
        return client.sendMessage(from, { text: '❌ You can only catch Pokémon in a group chat.' }, { quoted: msg });

    if (!client.pokemonResponse.has(from))
        return client.sendMessage(from, { text: '🟥 *There are no wild Pokémon here right now!*' }, { quoted: msg });

    const name = args[0]?.trim().toLowerCase();
    if (!name)
        return client.sendMessage(from, { text: '❌ Provide the Pokémon\'s name.\nExample: *!catch pikachu*' }, { quoted: msg });

    const data = client.pokemonResponse.get(from);
    if (name !== data.name.toLowerCase())
        return client.sendMessage(from, { text: `❌ Wrong Pokémon! Try *!catch ${data.name}*` }, { quoted: msg });

    // Check pokéballs
    const econ = await client.econ.findOrCreate({ userId: sender });
    if (econ.pokeball <= 0)
        return client.sendMessage(from, { text: '❌ You have no Pokéballs left! Use *!daily* to get more.' }, { quoted: msg });

    // Catch rate: 30% base + 5% per ball above 1, max 85%
    const catchChance = Math.min(0.30 + (econ.pokeball - 1) * 0.05, 0.85);
    econ.pokeball -= 1;
    await econ.save();

    const caught = Math.random() < catchChance;
    if (!caught) {
        await client.sendMessage(from, {
            text: `😤 *${utils.capitalize(data.name)}* broke free! (${econ.pokeball} Pokéballs left)`,
        }, { quoted: msg });
        return;
    }

    client.pokemonResponse.delete(from);

    let party = client.poke.get(`${sender}_Party`) || [];
    let pc    = client.poke.get(`${sender}_PSS`)   || [];

    const sentToPC = party.length >= 6;
    if (sentToPC) {
        pc.push(data);
    } else {
        party.push(data);
    }

    client.poke.set(`${sender}_Party`, party);
    client.poke.set(`${sender}_PSS`, pc);

    const buffer = await utils.getBuffer(data.image).catch(() => null);
    const caption =
        `✅ *Gotcha! ${utils.capitalize(data.name)} was caught!*\n\n` +
        `🔥 Types: ${data.types.map(utils.capitalize).join(', ')}\n` +
        `🔹 Level: ${data.level}\n` +
        `❤️ HP: ${data.maxHp} | ⚔️ ATK: ${data.attack} | 🛡️ DEF: ${data.defense}\n` +
        (sentToPC ? `\n📦 Your party is full — *${utils.capitalize(data.name)}* was sent to your PC!\nUse *!pss* to manage your storage.` : '') +
        `\n\n🎯 Pokéballs remaining: ${econ.pokeball}`;

    if (buffer) {
        await client.sendMessage(from, { image: buffer, caption }, { quoted: msg });
    } else {
        await client.sendMessage(from, { text: caption }, { quoted: msg });
    }

    // Award XP to lead party Pokémon
    const filteredParty = (client.poke.get(`${sender}_Party`) || []).filter(x => x.hp > 0);
    if (!filteredParty.length) return;

    const lead = filteredParty[0];
    if (lead.level >= 100) return;

    const resultExp = Math.round(data.exp / 8);
    lead.exp        += resultExp;
    lead.displayExp += resultExp;

    const newLevel = utils.getLevelByExp(lead.exp);
    if (newLevel > lead.level) {
        lead.level      = newLevel;
        lead.displayExp = lead.exp - utils.calculatePokeExp(newLevel);
        const M = { from, sender };
        utils.handlePokemonStats(client, M, lead, false, 'player1', sender);
    }

    const updatedParty = client.poke.get(`${sender}_Party`) || [];
    const idx = updatedParty.findIndex(x => x.tag === lead.tag);
    if (idx >= 0) { updatedParty[idx] = lead; client.poke.set(`${sender}_Party`, updatedParty); }
};

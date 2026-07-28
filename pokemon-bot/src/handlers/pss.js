'use strict';

/**
 * !pss [p<n> pc<n> | pc<n> p<n> | p<n> | pc<n>]
 * Pokémon Storage System — swap/transfer between party and PC.
 * Ported from eve-bot/src/Commands/Pokemons/swap.js
 *
 * Examples:
 *   !pss             → show party and PC overview
 *   !pss p2          → move party slot 2 → PC
 *   !pss pc3         → move PC slot 3 → party
 *   !pss p1 p3       → swap party slots 1 and 3
 *   !pss p2 pc1      → swap party slot 2 with PC slot 1
 */

const utils = require('../utils');

module.exports = async function pssHandler({ client, msg, from, sender, args }) {
    let party = client.poke.get(`${sender}_Party`) || [];
    let pc    = client.poke.get(`${sender}_PSS`)   || [];

    // No args → show overview
    if (!args.length) {
        let text = `💻 *Pokémon Storage System*\n\n⚗ *Party (${party.length}/6):*\n`;
        if (party.length) party.forEach((p, i) => { text += `  ${i + 1}. ${utils.capitalize(p.name)} Lv.${p.level} ${p.hp > 0 ? '❤️' : '💀'}\n`; });
        else text += '  (empty)\n';
        text += `\n💾 *PC (${pc.length}):*\n`;
        if (pc.length) pc.forEach((p, i) => { text += `  ${i + 1}. ${utils.capitalize(p.name)} Lv.${p.level}\n`; });
        else text += '  (empty)\n';
        text += '\n*Usage: !pss p<n> to send to PC | !pss pc<n> to retrieve | !pss p<n> pc<n> to swap*';
        return client.sendMessage(from, { text }, { quoted: msg });
    }

    const save = async () => {
        client.poke.set(`${sender}_Party`, party);
        client.poke.set(`${sender}_PSS`, pc);
    };

    if (args.length === 1) {
        const raw    = args[0];
        const isPC   = raw.startsWith('pc');
        const prefix = isPC ? 'pc' : raw[0];
        const index  = parseInt(raw.slice(isPC ? 2 : 1), 10) - 1;

        if (isNaN(index)) return client.sendMessage(from, { text: '❌ Invalid index.' }, { quoted: msg });

        if (prefix === 'p') {
            if (index < 0 || index >= party.length)
                return client.sendMessage(from, { text: '❌ Invalid party index.' }, { quoted: msg });
            const pkmn = party.splice(index, 1)[0];
            pc.push(pkmn);
            await save();
            return client.sendMessage(from, { text: `✔ *${utils.capitalize(pkmn.name)}* moved from party to PC.` }, { quoted: msg });
        } else if (isPC) {
            if (index < 0 || index >= pc.length)
                return client.sendMessage(from, { text: '❌ Invalid PC index.' }, { quoted: msg });
            if (party.length >= 6)
                return client.sendMessage(from, { text: '❌ Your party is full (6/6). Move one to PC first.' }, { quoted: msg });
            const pkmn = pc.splice(index, 1)[0];
            party.push(pkmn);
            await save();
            return client.sendMessage(from, { text: `✔ *${utils.capitalize(pkmn.name)}* retrieved from PC to party.` }, { quoted: msg });
        }
        return client.sendMessage(from, { text: '❌ Use "p" for party and "pc" for PC.' }, { quoted: msg });
    }

    if (args.length === 2) {
        const [a1, a2] = args;
        const isPC1 = a1.startsWith('pc'), isPC2 = a2.startsWith('pc');
        const prefix1 = isPC1 ? 'pc' : a1[0];
        const prefix2 = isPC2 ? 'pc' : a2[0];
        const idx1 = parseInt(a1.slice(isPC1 ? 2 : 1), 10) - 1;
        const idx2 = parseInt(a2.slice(isPC2 ? 2 : 1), 10) - 1;

        if (isNaN(idx1) || isNaN(idx2))
            return client.sendMessage(from, { text: '❌ Invalid indices.' }, { quoted: msg });

        if (prefix1 === 'p' && prefix2 === 'p') {
            if (idx1 < 0 || idx1 >= party.length || idx2 < 0 || idx2 >= party.length)
                return client.sendMessage(from, { text: '❌ One or both party indices out of range.' }, { quoted: msg });
            [party[idx1], party[idx2]] = [party[idx2], party[idx1]];
            await save();
            return client.sendMessage(from, { text: `✔ Swapped party slot ${idx1 + 1} *(${party[idx1].name})* ↔ slot ${idx2 + 1} *(${party[idx2].name})*.` }, { quoted: msg });
        }
        if (isPC1 && isPC2) {
            if (idx1 < 0 || idx1 >= pc.length || idx2 < 0 || idx2 >= pc.length)
                return client.sendMessage(from, { text: '❌ One or both PC indices out of range.' }, { quoted: msg });
            [pc[idx1], pc[idx2]] = [pc[idx2], pc[idx1]];
            await save();
            return client.sendMessage(from, { text: `✔ Swapped PC slot ${idx1 + 1} ↔ slot ${idx2 + 1}.` }, { quoted: msg });
        }
        if (prefix1 === 'p' && isPC2) {
            if (idx1 < 0 || idx1 >= party.length || idx2 < 0 || idx2 >= pc.length)
                return client.sendMessage(from, { text: '❌ Index out of range.' }, { quoted: msg });
            [party[idx1], pc[idx2]] = [pc[idx2], party[idx1]];
            await save();
            return client.sendMessage(from, { text: `✔ Swapped party #${idx1 + 1} *(${utils.capitalize(party[idx1].name)})* with PC #${idx2 + 1} *(${utils.capitalize(pc[idx2].name)})*.` }, { quoted: msg });
        }
        if (isPC1 && prefix2 === 'p') {
            if (idx1 < 0 || idx1 >= pc.length || idx2 < 0 || idx2 >= party.length)
                return client.sendMessage(from, { text: '❌ Index out of range.' }, { quoted: msg });
            [pc[idx1], party[idx2]] = [party[idx2], pc[idx1]];
            await save();
            return client.sendMessage(from, { text: `✔ Swapped PC #${idx1 + 1} *(${utils.capitalize(pc[idx1].name)})* with party #${idx2 + 1} *(${utils.capitalize(party[idx2].name)})*.` }, { quoted: msg });
        }
        return client.sendMessage(from, { text: '❌ Use "p" for party and "pc" for PC.' }, { quoted: msg });
    }

    return client.sendMessage(from, { text: '❌ Provide one or two slot references. Usage: *!pss*' }, { quoted: msg });
};

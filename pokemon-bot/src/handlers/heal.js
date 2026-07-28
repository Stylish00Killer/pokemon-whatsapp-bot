'use strict';

/**
 * !heal — Restore all party Pokémon to full HP.
 * Ported from eve-bot/src/Commands/Pokemons/heal.js
 * Cooldown: 45 minutes.
 */

const utils = require('../utils');

const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes

module.exports = async function healHandler({ client, msg, from, sender }) {
    const cd = client.DB.get(`${sender}_heal_cd`) || 0;

    if (cd && Date.now() - cd < COOLDOWN_MS) {
        const timeLeft = utils.convertMs(COOLDOWN_MS - (Date.now() - cd), 'minutes');
        return client.sendMessage(from, {
            text: `⏳ You healed your Pokémon recently. Come back in *${timeLeft}* ${timeLeft >= 2 ? 'minutes' : 'minute'}.`,
        }, { quoted: msg });
    }

    let party = client.poke.get(`${sender}_Party`) || [];
    if (!party.length)
        return client.sendMessage(from, { text: "❌ You don't have any Pokémon in your party." }, { quoted: msg });

    for (let i = 0; i < party.length; i++) {
        party[i].hp      = party[i].maxHp;
        party[i].attack  = party[i].maxAttack;
        party[i].defense = party[i].maxDefense;
        party[i].speed   = party[i].maxSpeed;
        party[i].state   = { status: '', movesUsed: 0 };
        for (let j = 0; j < party[i].moves.length; j++) {
            party[i].moves[j].pp = party[i].moves[j].maxPp;
        }
    }

    client.poke.set(`${sender}_Party`, party);
    client.DB.set(`${sender}_heal_cd`, Date.now());

    return client.sendMessage(from, {
        text: `💊 All your Pokémon have been fully healed!\n\n${party.map((p, i) => `${i + 1}. ${utils.capitalize(p.name)} — ❤️ ${p.hp}/${p.maxHp}`).join('\n')}`,
    }, { quoted: msg });
};

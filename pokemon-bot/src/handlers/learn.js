'use strict';

/**
 * !learn --<moveName> | --cancel
 * Replace an old move with the pending new one after leveling up.
 * Ported from eve-bot/src/Commands/Pokemons/learn.js
 *
 * Only usable when a pending move-learn prompt is active (set by handlePokemonStats).
 */

const utils = require('../utils');

module.exports = async function learnHandler({ client, msg, from, sender, args }) {
    const pending = client.pokemonMoveLearningResponse.get(`${from}${sender}`);

    if (!pending)
        return client.sendMessage(from, { text: "❌ You don't have a pending move to learn right now." }, { quoted: msg });

    const flag = args[0]?.replace('--', '').toLowerCase();

    if (!flag)
        return client.sendMessage(from, { text: 'Usage: *!learn --<move-to-replace>* or *!learn --cancel*' }, { quoted: msg });

    const { data: pkmn, move: newMove } = pending;
    let party = client.poke.get(`${sender}_Party`) || [];
    const i   = party.findIndex(x => x.name === pkmn.name && x.level === pkmn.level);

    client.pokemonMoveLearningResponse.delete(`${from}${sender}`);

    const newMoveName = newMove.name.split('-').map(utils.capitalize).join(' ');

    if (flag === 'cancel') {
        if (i >= 0) {
            party[i].rejectedMoves.push(newMove.name);
            client.poke.set(`${sender}_Party`, party);
        }
        return client.sendMessage(from, { text: `❌ Cancelled learning *${newMoveName}*.` }, { quoted: msg });
    }

    if (i < 0)
        return client.sendMessage(from, { text: '❌ Could not find the Pokémon in your party.' }, { quoted: msg });

    const moveIdx = party[i].moves.findIndex(m => m.name === flag);
    if (moveIdx < 0)
        return client.sendMessage(from, { text: `❌ Move *${flag}* not found. Check the move names and try again.` }, { quoted: msg });

    const oldMoveName = party[i].moves[moveIdx].name.split('-').map(utils.capitalize).join(' ');
    party[i].rejectedMoves.push(party[i].moves[moveIdx].name);
    party[i].moves[moveIdx] = newMove;
    client.poke.set(`${sender}_Party`, party);

    // Sync to active battle if in one
    const battleGroup = client.pokemonBattlePlayerMap.get(from);
    if (battleGroup) {
        const bdata = client.pokemonBattleResponse.get(battleGroup);
        if (bdata) {
            const turn = bdata.player1.user === sender ? 'player1' : 'player2';
            if (party[i].tag === bdata[turn].activePokemon.tag) {
                bdata[turn].activePokemon = party[i];
                client.pokemonBattleResponse.set(battleGroup, bdata);
            }
        }
    }

    return client.sendMessage(from, {
        text: `✅ *${utils.capitalize(party[i].name)}* forgot *${oldMoveName}* and learned *${newMoveName}*!`,
    }, { quoted: msg });
};

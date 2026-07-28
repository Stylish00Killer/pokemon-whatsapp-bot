'use strict';

/**
 * Wild Pokémon auto-spawner — ported from eve-bot/src/Handlers/pokemon.js
 * Spawns a random Pokémon every 5 minutes in every registered group.
 * Groups register themselves with !pg command.
 */

const cron      = require('node-cron');
const axios     = require('axios');
const { PokemonClient } = require('pokenode-ts');
const utils     = require('./utils');

module.exports = function startSpawner(client) {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const wilds     = client.DB.get('wild') || [];
            if (!wilds.length) return;

            const id    = utils.getRandomInt(1, 898);
            const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const level = Math.floor(Math.random() * (10 - 5) + 5);
            const exp   = utils.calculatePokeExp(level);
            const image = data.sprites.other['official-artwork'].front_default;
            const { hp, attack, defense, speed } = await utils.getPokemonStats(data.id, level);
            const { moves, rejectedMoves } = await utils.assignPokemonMoves(data.name, level);

            const server = new PokemonClient();
            const { gender_rate } = await server.getPokemonSpeciesByName(data.name);
            let female = false;
            if (gender_rate >= 8) female = true;
            else if (gender_rate > 0) female = Math.random() < 0.5;

            const wildData = {
                name: data.name,
                level,
                exp,
                image,
                id: data.id,
                displayExp: 0,
                hp, attack, defense, speed,
                maxHp: hp, maxDefense: defense, maxAttack: attack, maxSpeed: speed,
                types: data.types.map(t => t.type.name),
                moves,
                rejectedMoves,
                state: { status: '', movesUsed: 0 },
                female,
                tag: utils.generateRandomUniqueTag(10),
            };

            for (const jid of wilds) {
                try {
                    client.pokemonResponse.set(jid, wildData);
                    const buffer = await utils.getBuffer(image);
                    await client.sendMessage(jid, {
                        image: buffer,
                        caption:
                            `🌟 *A Wild Pokémon Appeared!* 🌟\n` +
                            `🆔 ID: ${data.id}\n` +
                            `🔥 Types: ${data.types.map(t => utils.capitalize(t.type.name)).join(', ')}\n` +
                            `🔹 Level: ${level}\n\n` +
                            `[Use *!catch ${data.name}* to catch it!]`,
                    });
                } catch (e) {
                    console.error('[Spawner] send error:', e.message);
                }
            }
        } catch (e) {
            console.error('[Spawner] error:', e.message);
        }
    });

    console.log('[SPAWN] Wild Pokémon scheduler started (every 5 min).');
};

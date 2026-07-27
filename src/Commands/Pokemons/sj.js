'use strict';

const axios = require('axios');
const { PokemonClient } = require('pokenode-ts');

module.exports = {
    name: 'start-journey',
    aliases: ['start-journey', 'sj'],
    category: 'pokemon',
    description: 'Start your Pokémon journey by choosing a starter Pokémon.',
    async execute(client, arg, M) {
        try {
            const companion = await client.poke.get(`${M.sender}_Companion`);

            if (companion) {
                return M.reply(`You have already started your journey with ${companion}.`);
            }

            const regions = {
                kanto:  [1, 4, 7],
                johto:  [152, 155, 158],
                hoenn:  [252, 255, 258],
                sinnoh: [387, 390, 393],
                unova:  [495, 498, 501],
                kalos:  [650, 653, 656],
                alola:  [722, 725, 728],
                galar:  [810, 813, 816],
            };

            if (!arg) {
                let text = '🌟 *Choose a starter Pokémon to begin your journey:* 🌟\n\n';
                for (const region in regions) {
                    text += `🌍 *${client.utils.capitalize(region)} Region*:\n`;
                    for (const id of regions[region]) {
                        const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
                        text += `🔹 *${client.utils.capitalize(data.name)}* (ID: ${data.id}) — ${data.types.map(t => client.utils.capitalize(t.type.name)).join(', ')}\n`;
                        text += `   Use: \`-start-journey --${data.name} --choose\`\n\n`;
                    }
                }
                return await M.reply(text);
            }

            if (arg.includes('--choose')) {
                const pokemonName = arg.split('--')[1].trim().toLowerCase();
                const starterIds  = Object.values(regions).flat();

                const { data: pokemonData } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);

                if (!starterIds.includes(pokemonData.id)) {
                    return M.reply('❌ You can only choose a Pokémon from the starters list. Use -start-journey to see the full list.');
                }

                await client.poke.set(`${M.sender}_Companion`, pokemonName);

                const data   = pokemonData;
                const image  = data.sprites.other['official-artwork'].front_default;
                const { hp, attack, defense, speed } = await client.utils.getPokemonStats(data.id, 5);
                const moves  = await client.utils.getStarterPokemonMoves(data.name);

                const server      = new PokemonClient();
                const { gender_rate } = await server.getPokemonSpeciesByName(data.name);
                let female = gender_rate >= 8;
                if (!female && gender_rate > 0) {
                    female = Math.random() < 0.5;
                }

                // Use local exp calculation — no external API needed
                const exp   = client.utils.calculatePokeExp(5);
                const party = (await client.poke.get(`${M.sender}_Party`)) || [];

                party.push({
                    name:        data.name,
                    level:       5,
                    exp,
                    image,
                    id:          data.id,
                    displayExp:  0,
                    hp,
                    attack,
                    defense,
                    speed,
                    maxHp:       hp,
                    maxDefense:  defense,
                    maxAttack:   attack,
                    maxSpeed:    speed,
                    types:       data.types.map(t => t.type.name),
                    moves,
                    rejectedMoves: [],
                    state: { status: '', movesUsed: 0 },
                    female,
                    tag: '0',
                });

                await client.poke.set(`${M.sender}_Party`, party);

                return M.reply(
                    `🎉 *Congratulations!* You have started your Pokémon journey with *${client.utils.capitalize(pokemonName)}*!\n\nUse *-party* to see your party, and *-dex ${pokemonName}* to learn more about your partner.`
                );
            }

            // Show info for a specific pokemon (--name without --choose)
            const pokemonName = arg.split('--')[1]?.trim();
            if (pokemonName) {
                const { data: res } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
                let text = `🎈 *${client.utils.capitalize(res.name)}*\n\n`;
                text += `🧧 Pokédex ID: ${res.id}\n`;
                text += `🎗 Type(s): ${res.types.map(t => client.utils.capitalize(t.type.name)).join(', ')}\n`;
                text += `🎏 Abilities: ${res.abilities.map(a => client.utils.capitalize(a.ability.name)).join(', ')}\n\n`;
                text += `_Use \`-start-journey --${res.name} --choose\` to pick this Pokémon._`;

                const imgBuf = await client.utils.getBuffer(res.sprites.other['official-artwork'].front_default);
                return await client.sendMessage(M.from, { image: imgBuf, caption: text });
            }
        } catch (err) {
            console.error('[start-journey]', err.message);
            await M.reply('An error occurred while starting your Pokémon journey.').catch(() => {});
        }
    },
};

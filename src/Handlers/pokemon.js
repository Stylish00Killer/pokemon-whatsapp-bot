const cron = require("node-cron");
const axios = require("axios");
const { PokemonClient } = require('pokenode-ts');
module.exports = async function PokeHandler(client, M) {
    try {
        let wilds = await client.DB.get('wild');
        const wild = wilds || [];

        for (let i = 0; i < wild.length; i++) {
            const jid = wild[i];

            if (wild.includes(jid)) {
                cron.schedule('*/5 * * * *', async () => {
                    try {
                       const id = client.utils.getRandomInt(1, 898)

                        // Fetch data for today's selected Pokémon
                        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
                        const data = response.data;
                        const level = Math.floor(Math.random() * (10 - 5) + 5);

                        // Calculate exp locally using the built-in formula
                        const exp = client.utils.calculatePokeExp(level);

                        const image = data.sprites.other['official-artwork'].front_default;
                        const { hp, attack, defense, speed } = await client.utils.getPokemonStats(data.id, level);
                        const { moves, rejectedMoves } = await client.utils.assignPokemonMoves(data.name, level);
                        const server = new PokemonClient();
                        const genders = ['female', 'male'];
                        const { gender_rate } = await server.getPokemonSpeciesByName(data.name);
                        let female = false;
                        if (gender_rate >= 8) female = true;
                        if (gender_rate < 8 && gender_rate > 0)
                            female = genders[Math.floor(Math.random() * genders.length)] === 'female';

                        await client.pokemonResponse.set(jid, {
                            name: data.name,
                            level,
                            exp,
                            image,
                            id: data.id,
                            displayExp: 0,
                            hp,
                            attack,
                            defense,
                            speed,
                            maxHp: hp,
                            maxDefense: defense,
                            maxAttack: attack,
                            maxSpeed: speed,
                            types: data.types.map((type) => type.type.name),
                            moves,
                            rejectedMoves,
                            state: {
                                status: '',
                                movesUsed: 0
                            },
                            female,
                            tag: client.utils.generateRandomUniqueTag(10)
                        });

                        const buffer = await client.utils.getBuffer(image);
                        await client.sendMessage(jid, {
                            image: buffer,
                            caption: `🌟 A Wild Pokémon Appeared! 🌟\n🆔 ID: ${data.id}\n🔥 Types: ${data.types.map((type) => type.type.name).join(', ')}\n🔹 Level: ${level}\n\n[Use *${client.prefix}catch  <name>* to catch this Pokémon and add it to your party!]`
                        });
                    } catch (err) {
                        console.log(err);
                        console.error('[PokeHandler] Spawn error:', err.message);
                    }
                });
            }
        }
    } catch (error) {
        console.log(error);
    }
};
